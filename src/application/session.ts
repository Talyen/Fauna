import { createCloud, initialCloudView, type CloudView } from "./cloud";
import { createDiagnostics } from "./diagnostics";
import { createStore } from "zustand/vanilla";
import { createGame, dispatch } from "../game/engine";
import { decodeSave, encodeSave } from "../game/save";
import type { Command, GameEvent, GameState } from "../game/types";
import type { Platform } from "../platform/ports";
export interface SessionView {
  game: GameState;
  cloud: CloudView;
  overlayActive: boolean;
  ready: boolean;
  closing: boolean;
  loadFailed: boolean;
  error: string;
  saveStatus: "saved" | "saving" | "error";
  events: GameEvent[];
  committedCommand: Command | null;
}
export function createSession(platform: Platform, seed = 1, capabilities: { development?: boolean } = {}) {
  const diagnostics = createDiagnostics(platform.diagnostics);
  const store = createStore<SessionView>(() => ({
    game: createGame(seed),
    cloud: initialCloudView,
    overlayActive: false,
    ready: false,
    closing: false,
    loadFailed: false,
    error: "",
    saveStatus: "saved",
    events: [],
    committedCommand: null,
  }));
  let writes = Promise.resolve();
  let disposed = false;
  let generation = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleSaveRetry = () => {
    if (disposed || retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      if (!disposed && !store.getState().closing) save(store.getState().game);
    }, 5000);
  };
  const readCandidates = async (retry = false) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        Promise.resolve()
          .then(() => platform.saves.readCandidates())
          .catch((error) => {
            if (retry) return platform.saves.readCandidates();
            throw error;
          }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Local save read timed out.")), 5000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  const writeLocal = async (data: string) => {
    // Do not rotate unreadable storage until access has recovered.
    if (store.getState().loadFailed) {
      await readCandidates();
      if (!disposed) store.setState({ loadFailed: false });
    }
    await platform.saves.write(data);
  };
  const cloud = createCloud(
    platform.cloud,
    (view) => {
      if (!disposed) {
        const previous = store.getState();
        if (view.error && view.error !== previous.cloud.error)
          diagnostics.record("cloud", view.error, previous.game);
        store.setState({ cloud: view });
      }
    },
    async (data) => {
      if (disposed || store.getState().closing) throw new Error("Session is closing.");
      const game = decodeSave(data);
      const installation = writes
        .then(() => writeLocal(data))
        .then(() => {
          if (!disposed)
            store.setState({
              game,
              loadFailed: false,
              saveStatus: "saved",
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
    if (!disposed) store.setState({ overlayActive });
  });
  const save = (game: GameState, committed: Partial<SessionView> = {}) => {
    const data = encodeSave(game);
    writes = writes
      .then(() => writeLocal(data))
      .then(() => {
        if (!disposed && store.getState().game.revision === game.revision) {
          clearTimeout(retryTimer);
          retryTimer = undefined;
          store.setState({ saveStatus: "saved", error: "" });
        }
        return cloud.commit(data);
      })
      .catch((error) => {
        diagnostics.record("save-write", error, store.getState().game);
        if (!disposed) {
          store.setState({ saveStatus: "error", error: "" });
          scheduleSaveRetry();
        }
      });
    // Admit persistence before subscribers can issue another command or dispose.
    store.setState({ ...committed, saveStatus: "saving" });
  };
  async function load() {
    const current = store.getState();
    if (disposed || current.closing || current.ready) return;
    const token = ++generation;
    store.setState({ ready: false, error: "", loadFailed: false });
    const startCloud = async (data: string | null) => {
      await cloud.start(data);
      if (!disposed && !store.getState().closing && token === generation) store.setState({ ready: true });
    };
    try {
      const candidates = await readCandidates(true);
      if (disposed || store.getState().closing || token !== generation) return;
      for (const candidate of candidates) {
        try {
          const game = decodeSave(candidate.data);
          store.setState({
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
        store.setState({
          loadFailed: true,
          error: "",
        });
      if (!disposed && !store.getState().closing && token === generation) await startCloud(null);
    }
  }
  const prepareClose = async () => {
    if (disposed) return true;
    store.setState({ closing: true });
    await writes;
    if (store.getState().saveStatus === "error") {
      save(store.getState().game);
      await writes;
    }
    await cloud.flush();
    return true;
  };
  const removeCloseListener = platform.onCloseRequested?.(prepareClose);
  return {
    store: { getState: store.getState, getInitialState: store.getInitialState, subscribe: store.subscribe },
    diagnostics,
    display: platform.display,
    load,
    command(command: Command) {
      const view = store.getState();
      if (disposed || view.closing || view.overlayActive || view.cloud.blocking || !view.ready) return false;
      const result = dispatch(view.game, command, capabilities.development === true);
      if (!result.accepted) {
        store.setState({ error: result.reason }); // Internal command diagnostics only.
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
      await writes;
      return store.getState().saveStatus !== "error";
    },
    async quit() {
      if (!platform.quit || disposed) return;
      if (await prepareClose()) await platform.quit?.();
    },
    dispose() {
      disposed = true;
      clearTimeout(retryTimer);
      store.setState({ ready: false, closing: true });
      diagnostics.dispose();
      const cloudWrites = cloud.dispose();
      removeOverlay?.();
      removeCloseListener?.();
      generation++;
      return Promise.all([writes, cloudWrites]).then(() => {});
    },
  };
}
export type Session = ReturnType<typeof createSession>;
