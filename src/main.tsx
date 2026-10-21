import { Screen } from "./ui/screen";
import { useEffect, useState } from "react";
import { Loading } from "./ui/loading";
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
function Game() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let alive = true;
    const start = () => {
      try {
        validateContent();
        setReady(true);
        void session.load();
      } catch (error) {
        session.diagnostics.record("validation", error);
        if (alive) timer = setTimeout(start, 5000);
      }
    };
    start();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);
  return ready ? (
    <App session={session} desktop={platform.desktop} />
  ) : (
    <Screen className="loading">
      <Loading />
    </Screen>
  );
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
    <Game />
  </GameErrorBoundary>,
);
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    root.unmount();
    void session.dispose();
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    window.removeEventListener("pagehide", onPageHide);
  });
