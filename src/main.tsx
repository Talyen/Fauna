import { assetUrl } from "./ui/assets";
import { DiagnosticViewer, GameErrorBoundary } from "./ui/diagnostics";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import { createSession } from "./application/session";
import { createPlatform } from "./platform";
import { validateContent } from "./game/save";
import { App } from "./ui/App";
import "@fontsource-variable/inter/wght.css";
import "./ui/styles.css";
for (const name of ["full", "empty"])
  document.documentElement.style.setProperty(`--mana-${name}-image`, `url("${assetUrl(`mana.${name}`)}")`);
const platform = createPlatform();
const session = createSession(platform, Date.now() >>> 0);
let contentValid = true;
try {
  validateContent();
} catch (error) {
  contentValid = false;
  session.diagnostics.record("validation", error);
}
const onError = (event: ErrorEvent) => session.diagnostics.record("global", event.error ?? event.message);
const onRejection = (event: PromiseRejectionEvent) => session.diagnostics.record("global", event.reason);
window.addEventListener("error", onError);
window.addEventListener("unhandledrejection", onRejection);
const onPageHide = (event: PageTransitionEvent) => {
  if (event.persisted) return;
  window.removeEventListener("error", onError);
  window.removeEventListener("unhandledrejection", onRejection);
};
window.addEventListener("pagehide", onPageHide);
const root = createRoot(document.getElementById("root")!);
root.render(
  <MotionConfig reducedMotion="user" transition={{ duration: 0.15 }}>
    <GameErrorBoundary diagnostics={session.diagnostics}>
      {contentValid ? (
        <App session={session} desktop={platform.desktop} />
      ) : (
        <main className="recovery">
          <h1>Game content unavailable</h1>
          <DiagnosticViewer diagnostics={session.diagnostics} desktop={platform.desktop} />
        </main>
      )}
    </GameErrorBoundary>
  </MotionConfig>,
);
if (contentValid) void session.load();
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    root.unmount();
    void session.dispose();
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    window.removeEventListener("pagehide", onPageHide);
  });
