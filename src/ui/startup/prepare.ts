import type { Session } from "../../application/session";
import type { StartupSplash } from "./splash";
import { allArtwork, immediateArtwork, startupBaseArtwork } from "./artwork";
import { warmImages, waitForFonts } from "./images";

/** One navigation owns preparation; React recovery only observes its settled promise. */
export function prepareStartup(session: Session, splash: StartupSplash, validate: () => void) {
  const lifetime = new AbortController();
  const { signal } = lifetime;
  const retained = new Set<HTMLImageElement>();
  const report = (message: string) => session.diagnostics.record("startup", message);
  const base = warmImages(startupBaseArtwork, signal, report, retained);
  const fonts = waitForFonts(signal, report);
  let retry: ReturnType<typeof setTimeout> | undefined;
  let finishValidation = () => {};
  const validation = new Promise<void>((resolve) => {
    finishValidation = resolve;
    const attempt = () => {
      if (signal.aborted) {
        resolve();
        return;
      }
      try {
        validate();
        resolve();
      } catch (error) {
        session.diagnostics.record("validation", error);
        retry = setTimeout(attempt, 5000);
      }
    };
    attempt();
  });
  const resources = (async () => {
    await validation;
    if (signal.aborted) return;
    await session.load();
    if (signal.aborted || !session.store.getState().ready) return;
    const essential = immediateArtwork(session.store.getState().game);
    await base;
    if (signal.aborted) return;
    await warmImages(
      essential.filter((url) => !startupBaseArtwork.includes(url)),
      signal,
      report,
      retained,
    );
    if (signal.aborted) return;
    const selected = new Set(essential);
    void warmImages(
      allArtwork.filter((url) => !selected.has(url)),
      signal,
      report,
    );
  })();
  return {
    ready: Promise.all([resources, fonts, splash.minimum]),
    releaseImages: () => retained.clear(),
    dispose() {
      lifetime.abort();
      clearTimeout(retry);
      finishValidation();
      retained.clear();
    },
  };
}
