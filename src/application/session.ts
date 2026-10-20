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
  recoveryRequired: boolean;
  loadFailed: boolean;
  notice: string;
  error: string;
  saveStatus: "saved" | "saving" | "error";
  events: GameEvent[];
  committedCommand: Command | null;
}
export function createSession(platform: Platform, seed = 1, capabilities: { development?: boolean } = {}) {
  const diagnostics = createDiagnostics(
    platform.diagnostics,
    typeof __FAUNA_BUILD__ === "string" ? __FAUNA_BUILD__ : "test",
  );
  const store = createStore<SessionView>(() => ({
    game: createGame(seed),
    cloud: initialCloudView,
    overlayActive: false,
    ready: false,
    closing: false,
    recoveryRequired: false,
    loadFailed: false,
    notice: "",
    error: "",
    saveStatus: "saved",
    events: [],
    committedCommand: null,
  }));
  let writes = Promise.resolve();
  let disposed = false;
  let generation = 0;
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
        .then(() => platform.saves.write(data))
        .then(() => {
          if (!disposed)
            store.setState({
              game,
              ready: true,
              recoveryRequired: false,
              loadFailed: false,
              saveStatus: "saved",
              events: [],
              committedCommand: null,
              notice: "",
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
  const save = (game: GameState) => {
    const data = encodeSave(game);
    store.setState({ saveStatus: "saving" });
    writes = writes
      .then(() => platform.saves.write(data))
      .then(() => {
        if (!disposed && store.getState().game.revision === game.revision)
          store.setState({ saveStatus: "saved", error: "" });
        return cloud.commit(data);
      })
      .catch((error) => {
        diagnostics.record("save-write", error, store.getState().game);
        if (!disposed)
          store.setState({ saveStatus: "error", error: "Could not save. Keep the game open and retry." });
      });
  };
  async function load() {
    const current = store.getState();
    if (disposed || current.closing || (current.ready && !current.loadFailed)) return;
    const token = ++generation;
    store.setState({ ready: false, error: "", loadFailed: false });
    try {
      const candidates = await platform.saves.readCandidates();
      if (disposed || token !== generation) return;
      for (const candidate of candidates) {
        try {
          const game = decodeSave(candidate.data);
          store.setState({
            game,
            ready: true,
            recoveryRequired: false,
            notice:
              candidate.source === "primary" || candidate.source === "fauna.save.v1"
                ? ""
                : "Recovered your journey from a backup.",
            saveStatus: "saved",
          });
          await cloud.start(encodeSave(game));
          return;
        } catch {
          diagnostics.record("validation", "Invalid current-format save candidate.", store.getState().game);
          /* Try the next intact backup. */
        }
      }
      store.setState({
        ready: true,
        recoveryRequired: candidates.length > 0,
        notice: candidates.length
          ? "Your previous save could not be read. Start fresh to continue; the old data will be rotated into backups."
          : "",
      });
      await cloud.start(null);
    } catch (error) {
      diagnostics.record("save-read", error, store.getState().game);
      if (!disposed && token === generation)
        store.setState({
          ready: true,
          loadFailed: true,
          error: "Could not read your save. Retry before continuing.",
        });
    }
  }
  const prepareClose = async () => {
    if (disposed) return true;
    store.setState({ closing: true });
    await writes;
    const saved = store.getState().saveStatus !== "error";
    if (saved) await cloud.flush();
    if (!saved) store.setState({ closing: false });
    return saved;
  };
  const removeCloseListener = platform.onCloseRequested?.(prepareClose);
  return {
    store: { getState: store.getState, getInitialState: store.getInitialState, subscribe: store.subscribe },
    diagnostics,
    display: platform.display,
    load,
    cloud: {
      offline: () => cloud.offline(),
      choose: (id: string) => cloud.choose(id),
      importStandalone: (use: boolean) => cloud.importStandalone(use),
      async retry() {
        if (
          disposed ||
          store.getState().closing ||
          store.getState().loadFailed ||
          store.getState().saveStatus === "error"
        )
          return;
        store.setState({ cloud: { ...store.getState().cloud, blocking: true } });
        await writes;
        if (!disposed) await cloud.retry();
      },
    },
    command(command: Command) {
      const view = store.getState();
      if (
        disposed ||
        view.closing ||
        view.overlayActive ||
        view.cloud.blocking ||
        !view.ready ||
        view.recoveryRequired ||
        view.loadFailed
      )
        return false;
      const result = dispatch(view.game, command, capabilities.development === true);
      if (!result.accepted) {
        store.setState({ error: result.reason });
        return false;
      }
      store.setState({
        game: result.state,
        events: result.events,
        committedCommand: Object.freeze({ ...command }),
        error: "",
      });
      save(result.state);
      return true;
    },
    startFresh() {
      if (disposed || store.getState().closing || !store.getState().recoveryRequired) return;
      store.setState({ recoveryRequired: false, notice: "A fresh journal is ready." });
      save(store.getState().game);
    },
    retrySave() {
      const view = store.getState();
      if (disposed || !view.ready || view.loadFailed || view.recoveryRequired || view.closing) return;
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
      store.setState({ ready: false, closing: true });
      diagnostics.dispose();
      cloud.dispose();
      removeOverlay?.();
      removeCloseListener?.();
      generation++;
      return writes;
    },
  };
}
export type Session = ReturnType<typeof createSession>;
