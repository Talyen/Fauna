import { createStore } from "zustand/vanilla";
import { createGame, dispatch } from "../game/engine";
import { decodeSave, encodeSave } from "../game/save";
import type { Command, GameEvent, GameState } from "../game/types";
import type { Platform } from "../platform/ports";
export interface SessionView {
  game: GameState;
  ready: boolean;
  closing: boolean;
  recoveryRequired: boolean;
  loadFailed: boolean;
  notice: string;
  error: string;
  saveStatus: "saved" | "saving" | "error";
  events: GameEvent[];
}
export function createSession(platform: Platform, seed = 1) {
  const store = createStore<SessionView>(() => ({
    game: createGame(seed),
    ready: false,
    closing: false,
    recoveryRequired: false,
    loadFailed: false,
    notice: "",
    error: "",
    saveStatus: "saved",
    events: [],
  }));
  let writes = Promise.resolve();
  let disposed = false;
  let generation = 0;
  const save = (game: GameState) => {
    const data = encodeSave(game);
    store.setState({ saveStatus: "saving" });
    writes = writes
      .then(() => platform.saves.write(data))
      .then(() => {
        if (!disposed && store.getState().game.revision === game.revision)
          store.setState({ saveStatus: "saved", error: "" });
      })
      .catch(() => {
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
          if (
            (candidate.source === "primary" || candidate.source === "fauna.save.v1") &&
            JSON.parse(candidate.data).version !== game.version
          )
            save(game);
          return;
        } catch {
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
    } catch {
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
    if (!saved) store.setState({ closing: false });
    return saved;
  };
  const removeCloseListener = platform.onCloseRequested?.(prepareClose);
  return {
    store: { getState: store.getState, getInitialState: store.getInitialState, subscribe: store.subscribe },
    load,
    command(command: Command) {
      const view = store.getState();
      if (disposed || view.closing || !view.ready || view.recoveryRequired || view.loadFailed) return false;
      const result = dispatch(view.game, command);
      if (!result.accepted) {
        store.setState({ error: result.reason });
        return false;
      }
      store.setState({ game: result.state, events: result.events, error: "" });
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
      removeCloseListener?.();
      generation++;
      return writes;
    },
  };
}
export type Session = ReturnType<typeof createSession>;
