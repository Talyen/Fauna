const IMAGE_TIMEOUT_MS = 15000;
type Report = (message: string) => void;

/** Fetch and decode share one deadline, including cached and synchronously failed images. */
export function warmImage(
  src: string,
  signal: AbortSignal,
  report: Report,
  priority: "high" | "low" = "high",
) {
  return new Promise<HTMLImageElement | undefined>((resolve) => {
    if (signal.aborted) {
      resolve(undefined);
      return;
    }
    const image = new Image();
    let settled = false;
    let decoding = false;
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
      if (decoding || settled) return;
      decoding = true;
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
    image.fetchPriority = priority;
    image.src = src;
    if (image.complete) load();
  });
}
