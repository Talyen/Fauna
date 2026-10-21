import { Screen } from "./ui/screen";
import { assetUrl } from "./ui/assets";
import { GameErrorBoundary } from "./ui/diagnostics";
import { createRoot } from "react-dom/client";
import { createSession } from "./application/session";
import { createPlatform } from "./platform";
import { validateContent } from "./game/save";
import { App } from "./ui/App";
import "@fontsource-variable/inter/wght.css";
import "./ui/styles.css";
for (const name of ["full", "empty"])
  document.documentElement.style.setProperty(`--mana-${name}-image`, `url("${assetUrl(`mana.${name}`)}")`);
const platform = createPlatform();
const session = createSession(platform, Date.now() >>> 0, { development: import.meta.env.DEV });
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
  <GameErrorBoundary diagnostics={session.diagnostics}>
    {contentValid ? (
      <App session={session} desktop={platform.desktop} />
    ) : (
      <Screen className="recovery">
        <h1>Game content unavailable</h1>
        <p>Close and reopen the game to retry.</p>
      </Screen>
    )}
  </GameErrorBoundary>,
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
