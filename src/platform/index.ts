import { browserDiagnostics } from "./preferences";
import { createBrowserPlatform } from "./browser";
import type { Platform } from "./ports";
export function createPlatform(): Platform {
  const bridge = window.faunaDesktop;
  if (!bridge) return createBrowserPlatform();
  return {
    desktop: true,
    diagnostics: browserDiagnostics(),
    steam: { available: false },
    saves: { readCandidates: () => bridge.readCandidates(), write: (data) => bridge.writeSave(data) },
    quit: () => bridge.quit(),
    onCloseRequested: (listener) => bridge.onCloseRequested(listener),
  };
}
