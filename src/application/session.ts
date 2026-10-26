import { createCloud, initialCloudView, type CloudView } from "./cloud";
import { createDiagnostics } from "./diagnostics";
import { createStore } from "zustand/vanilla";
import { freeze } from "immer";
import { createGame, dispatch } from "../game/engine";
import { decodeSave, encodeSave } from "../game/save";
import type { Command, GameEvent, GameState } from "../game/types";
import type { Platform } from "../platform/ports";
import { startPerformanceSpan, type PerformanceRecorder } from "../lib/performance";
export interface SessionView {
  game: GameState;
  cloud: CloudView;
  overlayActive: boolean;
  ready: boolean;
  closing: boolean;
  loadFailed: boolean;
  error: string;
  saveStatus: "saved" | "saving" | "error";
  saveUnavailable: boolean;
  events: GameEvent[];
  committedCommand: Command | null;
}
export function createSession(
  platform: Platform,
  seed = 1,
  capabilities: { development?: boolean; performance?: PerformanceRecorder } = {},
) {
  const span = (name: string, revision: number) =>
    startPerformanceSpan(name, { revision }, capabilities.performance ?? (() => undefined));
  const development = capabilities.development === true;
  const diagnostics = createDiagnostics(platform.diagnostics);
  const store = createStore<SessionView>(() =>
    freeze(
      {
        game: createGame(seed),
        cloud: initialCloudView,
        overlayActive: false,
        ready: false,
        closing: false,
        loadFailed: false,
        error: "",
        saveStatus: "saved",
        saveUnavailable: false,
        events: [],
        committedCommand: null,
      },
      true,
    ),
  );
  type Listener = Parameters<typeof store.subscribe>[0];
  const listeners = new Set<Listener>();
  const notifications: { view: SessionView; previous: SessionView; listeners: Listener[] }[] = [];
  let notifying = false;
  const publish = (patch: Partial<SessionView>) => {
    const end = span("state-publication", patch.game?.revision ?? store.getState().game.revision);
    // Replace the complete view so Zustand does not merge into a mutable snapshot.
    try {
      const previous = store.getState();
      const view = freeze({ ...previous, ...patch }, true);
      store.setState(view, true);
      notifications.push({ view, previous, listeners: [...listeners] });
      // Commit immediately, but finish delivering each snapshot before reentrant updates.
      if (notifying) return;
      notifying = true;
      try {
        while (notifications.length) {
          const notification = notifications.shift()!;
          for (const listener of notification.listeners) {
            if (!listeners.has(listener)) continue;
            try {
              listener(notification.view, notification.previous);
            } catch (error) {
              diagnostics.record("render", error, notification.view.game);
            }
          }
        }
      } finally {
        notifying = false;
        if (disposed) listeners.clear();
      }
    } finally {
      end();
    }
  };
  let writes = Promise.resolve();
  let disposed = false;
  let disposal: Promise<void> | undefined;
  let generation = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let saveFailures = 0;
  const scheduleSaveRetry = () => {
    if (disposed || retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      if (!disposed && !store.getState().closing) save(store.getState().game);
    }, 5000);
  };
  const readCandidates = async (retry = false, owns = () => true) => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        Promise.resolve()
          .then(() => (owns() ? platform.saves.readCandidates() : []))
          .catch((error) => {
            if (retry && active && !disposed && !store.getState().closing && owns())
              return platform.saves.readCandidates();
            throw error;
          }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Local save read timed out.")), 5000);
        }),
      ]);
    } finally {
      active = false;
      clearTimeout(timer);
    }
  };
  const writeLocal = async (data: string) => {
    // Do not rotate unreadable storage until access has recovered.
    if (store.getState().loadFailed) {
      await readCandidates();
      if (!disposed) publish({ loadFailed: false });
    }
    await platform.saves.write(data, (candidate) => {
      try {
        decodeSave(candidate);
        return true;
      } catch {
        return false;
      }
    });
  };
  const cloud = createCloud(
    platform.cloud,
    (view) => {
      if (!disposed) {
        const previous = store.getState();
        if (view.error && view.error !== previous.cloud.error)
          diagnostics.record("cloud", view.error, previous.game);
        publish({ cloud: view });
      }
    },
    async (data, owns = () => true) => {
      if (disposed || store.getState().closing || !owns()) throw new Error("Session is closing.");
      const game = decodeSave(data);
      const installation = writes
        .then(() => {
          if (disposed || store.getState().closing || !owns()) throw new Error("Cloud installation expired.");
          return writeLocal(data);
        })
        .then(() => {
          if (!owns()) return;
          saveFailures = 0;
          if (!disposed && !store.getState().closing)
            publish({
              game,
              loadFailed: false,
              saveStatus: "saved",
              saveUnavailable: false,
              events: [],
              committedCommand: null,
              error: "",
            });
        });
      writes = installation.catch(() => {});
      await installation;
    },
  );
  const removeOverlay = platform.onOverlay?.((overlayActive) => {
    if (!disposed) publish({ overlayActive });
  });
  const save = (game: GameState, committed: Partial<SessionView> = {}) => {
    const encoded = span("save-encoding", game.revision);
    let data: string;
    try {
      data = encodeSave(game);
    } finally {
      encoded();
    }
    const queued = span("save-queue-wait", game.revision);
    writes = writes
      .then(async () => {
        queued();
        const written = span("save-write-wait", game.revision);
        try {
          await writeLocal(data);
          written();
        } catch (error) {
          written("failed");
          throw error;
        }
      })
      .then(() => {
        saveFailures = 0;
        if (!disposed && store.getState().game.revision === game.revision) {
          clearTimeout(retryTimer);
          retryTimer = undefined;
          publish({ saveStatus: "saved", saveUnavailable: false, error: "" });
        }
        // Cloud metadata has its own serialized lane and bounded shutdown flush.
        // A stalled sync must not prevent the next gameplay snapshot reaching disk.
        void cloud.commit(data);
      })
      .catch((error) => {
        diagnostics.record("save-write", error, store.getState().game);
        if (!disposed) {
          saveFailures++;
          publish({
            saveStatus: "error",
            saveUnavailable: store.getState().saveUnavailable || saveFailures >= 2,
            error: "",
          });
          scheduleSaveRetry();
        }
      });
    // Admit persistence before subscribers can issue another command or dispose.
    publish({ ...committed, saveStatus: "saving" });
  };
  let loading: Promise<void> | undefined;
  function load() {
    // Assign ownership before load publishes to synchronous subscribers.
    return (loading ??= Promise.resolve()
      .then(loadOnce)
      .finally(() => {
        loading = undefined;
      }));
  }
  async function loadOnce() {
    const current = store.getState();
    if (disposed || current.closing || current.ready) return;
    const token = ++generation;
    publish({ ready: false, error: "", loadFailed: false });
    const startCloud = async (data: string | null) => {
      await cloud.start(data);
      if (!disposed && !store.getState().closing && token === generation) publish({ ready: true });
    };
    try {
      const candidates = await readCandidates(
        true,
        () => !disposed && !store.getState().closing && token === generation,
      );
      if (disposed || store.getState().closing || token !== generation) return;
      for (const candidate of candidates) {
        try {
          const game = decodeSave(candidate.data);
          publish({
            game,
            saveStatus: "saved",
          });
          await startCloud(encodeSave(game));
          return;
        } catch {
          diagnostics.record("validation", "Invalid current-format save candidate.", store.getState().game);
          /* Try the next intact backup. */
        }
      }
      await startCloud(null);
    } catch (error) {
      diagnostics.record("save-read", error, store.getState().game);
      if (!disposed && token === generation)
        publish({
          loadFailed: true,
          saveUnavailable: true,
          error: "",
        });
      if (!disposed && !store.getState().closing && token === generation) await startCloud(null);
    }
  }
  const drainWrites = async () => {
    let pending: Promise<void>;
    do {
      pending = writes;
      await pending;
    } while (pending !== writes);
  };
  let closing: Promise<boolean> | undefined;
  let quitting: Promise<void> | undefined;
  const prepareClose = () => {
    if (closing) return closing;
    if (disposed) return Promise.resolve(true);
    // Own the handshake before synchronous subscribers can request close again.
    closing = Promise.resolve().then(async () => {
      await drainWrites();
      if (!disposed && store.getState().saveStatus === "error") {
        save(store.getState().game);
        await drainWrites();
      }
      await cloud.flush();
      return true;
    });
    publish({ closing: true });
    return closing;
  };
  const removeCloseListener = platform.onCloseRequested?.(prepareClose);
  return {
    store: {
      getState: store.getState,
      getInitialState: store.getInitialState,
      subscribe(listener: Listener) {
        if (disposed) return () => {};
        const subscription: Listener = (view, previous) => listener(view, previous);
        listeners.add(subscription);
        return () => {
          listeners.delete(subscription);
        };
      },
    },
    diagnostics,
    display: platform.display,
    load,
    command(command: Command) {
      const view = store.getState();
      if (disposed || view.closing || view.overlayActive || view.cloud.blocking || !view.ready) return false;
      const end = startPerformanceSpan(
        "command-resolution",
        { command: command.type, revision: view.game.revision },
        capabilities.performance ?? (() => undefined),
      );
      let result: ReturnType<typeof dispatch>;
      try {
        result = dispatch(view.game, command, development);
        end();
      } catch (error) {
        end("failed");
        throw error;
      }
      if (!result.accepted) {
        publish({ error: result.reason }); // Internal command diagnostics only.
        return false;
      }
      save(result.state, {
        game: result.state,
        events: result.events,
        committedCommand: Object.freeze({ ...command }),
        error: "",
      });
      return true;
    },
    retrySave() {
      const view = store.getState();
      if (disposed || !view.ready || view.closing) return;
      save(view.game);
    },
    async flush() {
      await drainWrites();
      return store.getState().saveStatus !== "error";
    },
    quit() {
      if (!platform.quit || disposed) return Promise.resolve();
      if (quitting) return quitting;
      // Own native quit before prepareClose publishes to subscribers.
      quitting = Promise.resolve().then(async () => {
        if ((await prepareClose()) && !disposed) await platform.quit?.();
      });
      void prepareClose();
      return quitting;
    },
    dispose() {
      if (disposal) return disposal;
      let complete!: (result: Promise<void>) => void;
      // Retain teardown ownership before notifying synchronous store subscribers.
      disposal = new Promise<void>((resolve) => {
        complete = resolve;
      });
      disposed = true;
      clearTimeout(retryTimer);
      publish({ ready: false, closing: true });
      const cloudWrites = cloud.dispose();
      for (const remove of [removeOverlay, removeCloseListener]) {
        try {
          remove?.();
        } catch (error) {
          diagnostics.record("global", error, store.getState().game);
        }
      }
      diagnostics.dispose();
      generation++;
      complete(Promise.all([writes, cloudWrites]).then(() => {}));
      return disposal;
    },
  };
}
export type Session = ReturnType<typeof createSession>;
