import { browserDiagnostics } from "./preferences";
import { createBrowserPlatform } from "./browser";
import type { Platform } from "./ports";
export function createPlatform(): Platform {
  const bridge = window.faunaDesktop;
  if (!bridge) return createBrowserPlatform();
  return {
    desktop: true,
    display: bridge.display,
    cloud: bridge.cloud,
    onOverlay: bridge.onOverlay,
    diagnostics: browserDiagnostics(),
    steam: { available: false, getLanguage: bridge.getSteamLanguage },
    saves: {
      readCandidates: () => bridge.readCandidates(),
      async write(data, isRecoverable) {
        const recoverable: string[] = [];
        if (isRecoverable)
          for (const candidate of await bridge.readCandidates()) {
            try {
              if (isRecoverable(candidate.data)) recoverable.push(candidate.data);
            } catch {
              // A failed validation cannot promote a checkpoint into recovery storage.
            }
          }
        await bridge.writeSave(data, recoverable);
      },
    },
    quit: () => bridge.quit(),
    onCloseRequested: (listener) => bridge.onCloseRequested(listener),
  };
}
