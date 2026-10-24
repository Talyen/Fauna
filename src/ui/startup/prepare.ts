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
  const resources = (async () => {
    let source: "validation" | "startup" = "validation";
    try {
      validate();
      source = "startup";
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
    } catch (error) {
      if (!signal.aborted) session.diagnostics.record(source, error);
      throw error;
    }
  })();
  return {
    ready: Promise.all([resources, fonts, splash.minimum]),
    releaseImages: () => retained.clear(),
    dispose() {
      lifetime.abort();
      retained.clear();
    },
  };
}
