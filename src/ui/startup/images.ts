const IMAGE_TIMEOUT_MS = 15000;
export const FONT_TIMEOUT_MS = 10000;
type Report = (message: string) => void;

/** Fetch and decode share one deadline, including cached and synchronously failed images. */
export function warmImage(src: string, signal: AbortSignal, report: Report) {
  return new Promise<HTMLImageElement | undefined>((resolve) => {
    if (signal.aborted) {
      resolve(undefined);
      return;
    }
    const image = new Image();
    let settled = false;
    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      image.removeEventListener("load", load);
      image.removeEventListener("error", fail);
      signal.removeEventListener("abort", abort);
      if (!ready) {
        image.removeAttribute("src");
        if (!signal.aborted) report(`Artwork warmup failed: ${src}`);
      }
      resolve(ready ? image : undefined);
    };
    const fail = () => finish(false);
    const abort = () => finish(false);
    const load = () => {
      try {
        if (typeof image.decode === "function") void image.decode().then(() => finish(true), fail);
        else finish(image.naturalWidth > 0);
      } catch {
        fail();
      }
    };
    const timer = setTimeout(fail, IMAGE_TIMEOUT_MS);
    image.addEventListener("load", load, { once: true });
    image.addEventListener("error", fail, { once: true });
    signal.addEventListener("abort", abort, { once: true });
    image.decoding = "async";
    image.src = src;
    if (image.complete) load();
  });
}

function yieldFrame(signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    let frame: number | undefined;
    const finish = () => {
      clearTimeout(timer);
      if (frame !== undefined) cancelAnimationFrame(frame);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    // Background tabs suspend RAF; the timeout lets warmup and shutdown still settle.
    const timer = setTimeout(finish, 100);
    signal.addEventListener("abort", finish, { once: true });
    if (signal.aborted) finish();
    else frame = requestAnimationFrame(finish);
  });
}

export async function warmImages(
  urls: readonly string[],
  signal: AbortSignal,
  report: Report,
  retain?: Set<HTMLImageElement>,
) {
  const unique = [...new Set(urls)];
  for (let index = 0; index < unique.length && !signal.aborted; index += 4) {
    await Promise.all(
      unique.slice(index, index + 4).map(async (src) => {
        const image = await warmImage(src, signal, report);
        if (image && !signal.aborted) retain?.add(image);
      }),
    );
    if (index + 4 < unique.length && !signal.aborted) await yieldFrame(signal);
  }
}

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
