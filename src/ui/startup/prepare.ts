import type { Session } from "../../application/session";
import type { StartupSplash } from "./splash";
import { likelyArtwork, battleArtwork, startupBaseArtwork } from "./artwork";
import { waitForFonts } from "./images";
import { createArtworkCache } from "../shared/artwork-cache";

/** One navigation owns preparation; React recovery only observes its settled promise. */
export function prepareStartup(session: Session, splash: StartupSplash, validate: () => void) {
  const lifetime = new AbortController();
  const { signal } = lifetime;
  const artwork = createArtworkCache((message) => session.diagnostics.record("startup", message));
  let releaseEssential: (() => void) | undefined;
  let releaseUpcoming: (() => void) | undefined;
  let removeSubscription: (() => void) | undefined;
  let selection = "";
  const report = (message: string) => session.diagnostics.record("startup", message);
  const prefetch = () => {
    const urls = document.hidden ? [] : likelyArtwork(session.store.getState().game);
    const next = JSON.stringify(urls);
    if (next === selection || signal.aborted) return;
    selection = next;
    releaseUpcoming?.();
    releaseUpcoming = artwork.prefetch(urls);
  };
  const base = artwork.prepare(startupBaseArtwork);
  const fonts = waitForFonts(signal, report);
  const resources = (async () => {
    let source: "validation" | "startup" = "validation";
    try {
      validate();
      source = "startup";
      if (signal.aborted) return;
      await session.load();
      if (signal.aborted || !session.store.getState().ready) return;
      const essential = battleArtwork(session.store.getState().game);
      await base;
      if (signal.aborted) return;
      await artwork.prepare(essential.filter((url) => !startupBaseArtwork.includes(url)));
      if (signal.aborted) return;
      releaseEssential = artwork.retain(essential);
      prefetch();
      removeSubscription = session.store.subscribe((current, previous) => {
        if (current.game !== previous.game) prefetch();
      });
      document.addEventListener("visibilitychange", prefetch);
    } catch (error) {
      if (!signal.aborted) session.diagnostics.record(source, error);
      throw error;
    }
  })();
  return {
    ready: Promise.all([resources, fonts, splash.minimum, base]),
    artwork,
    releaseImages() {
      releaseEssential?.();
      releaseEssential = undefined;
    },
    dispose() {
      lifetime.abort();
      releaseUpcoming?.();
      artwork.dispose();
      removeSubscription?.();
      document.removeEventListener("visibilitychange", prefetch);
      releaseEssential?.();
      releaseEssential = undefined;
    },
  };
}
