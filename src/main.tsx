import { useLayoutEffect } from "react";
import { assetUrl } from "./ui/shared/assets";
import { GameErrorBoundary } from "./ui/shared/diagnostics";
import { createRoot } from "react-dom/client";
import { createSession } from "./application/session";
import { createPlatform } from "./platform";
import { rendererPerformanceRecorder } from "./platform/performance";
import { installPerformanceRecorder } from "./lib/performance";
import { validateContent } from "./game/content-validation";
import { App } from "./ui/App";
import { prepareStartup } from "./ui/startup/prepare";
import type { StartupSplash } from "./ui/startup/splash";
import "@fontsource-variable/inter/wght-italic.css";
import "./ui/styles.css";
for (const name of ["full", "empty"])
  document.documentElement.style.setProperty(`--mana-${name}-image`, `url("${assetUrl(`mana.${name}`)}")`);
export function mountGame(splash: StartupSplash) {
  const platform = createPlatform();
  const releasePerformance = installPerformanceRecorder(rendererPerformanceRecorder);
  const session = createSession(platform, Date.now() >>> 0, {
    development: import.meta.env.DEV,
    performance: rendererPerformanceRecorder,
  });
  const startup = prepareStartup(session, splash, validateContent);
  let disposed = false;
  function Game() {
    useLayoutEffect(() => {
      splash.dismiss();
      startup.releaseImages();
    }, []);
    return (
      <GameErrorBoundary diagnostics={session.diagnostics}>
        <App session={session} desktop={platform.desktop} />
      </GameErrorBoundary>
    );
  }
  const onError = (event: ErrorEvent) => session.diagnostics.record("global", event.error ?? event.message);
  const onRejection = (event: PromiseRejectionEvent) => session.diagnostics.record("global", event.reason);
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  const onPageHide = (event: PageTransitionEvent) => {
    if (event.persisted) return;
    disposed = true;
    releasePerformance();
    startup.dispose();
    splash.dispose();
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
  window.addEventListener("pagehide", onPageHide);
  const root = createRoot(document.getElementById("root")!);
  void startup.ready.then(
    () => {
      if (!disposed && session.store.getState().ready) root.render(<Game />);
    },
    () => {
      if (disposed) return;
      startup.dispose();
      splash.fail();
    },
  );
  const dispose = async () => {
    disposed = true;
    releasePerformance();
    startup.dispose();
    splash.dispose();
    root.unmount();
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    window.removeEventListener("pagehide", onPageHide);
    await session.dispose();
  };
  if (import.meta.hot) import.meta.hot.dispose(() => void dispose());
  return dispose;
}
