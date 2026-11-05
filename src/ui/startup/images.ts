const FONT_TIMEOUT_MS = 10000;
type Report = (message: string) => void;

export function waitForFonts(signal: AbortSignal, report: Report) {
  if (!("fonts" in document) || signal.aborted) return Promise.resolve();
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = (warning?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      if (warning) report(warning);
      resolve();
    };
    const abort = () => finish();
    const timer = setTimeout(() => finish("Font loading timed out"), FONT_TIMEOUT_MS);
    signal.addEventListener("abort", abort, { once: true });
    void document.fonts.ready.then(
      () => finish(),
      () => finish("Font loading failed"),
    );
  });
}
