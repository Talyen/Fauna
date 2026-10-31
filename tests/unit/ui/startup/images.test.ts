// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { warmImage, warmImages, waitForFonts } from "../../../../src/ui/startup/images";
let images: HTMLImageElement[];
let lifetime: AbortController;
const report = vi.fn();
beforeEach(() => {
  vi.useFakeTimers();
  lifetime = new AbortController();
  images = [];
  report.mockClear();
  vi.stubGlobal("Image", function () {
    const image = document.createElement("img");
    Object.defineProperty(image, "complete", { value: false });
    image.decode = vi.fn().mockResolvedValue(undefined);
    images.push(image);
    return image;
  });
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) =>
    setTimeout(() => fn(performance.now()), 16),
  );
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
});
afterEach(() => {
  lifetime.abort();
  Reflect.deleteProperty(document, "fonts");
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("waits for decode after load, retains success and cleans its timeout", async () => {
  let decoded = () => {};
  const pending = warmImage("art.webp", lifetime.signal, report);
  images[0]!.decode = () =>
    new Promise<void>((resolve) => {
      decoded = resolve;
    });
  images[0]!.dispatchEvent(new Event("load"));
  let done = false;
  void pending.then(() => {
    done = true;
  });
  await Promise.resolve();
  expect(done).toBe(false);
  decoded();
  expect(await pending).toBe(images[0]);
  expect(report).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
it("decodes a complete cached image only once when its load event also fires", async () => {
  let decoded = () => {};
  vi.stubGlobal("Image", function () {
    const image = document.createElement("img");
    Object.defineProperty(image, "complete", { value: true });
    image.decode = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          decoded = resolve;
        }),
    );
    images.push(image);
    return image;
  });
  const pending = warmImage("cached.webp", lifetime.signal, report);
  images[0]!.dispatchEvent(new Event("load"));
  expect(images[0]!.decode).toHaveBeenCalledOnce();
  decoded();
  expect(await pending).toBe(images[0]);
  expect(report).not.toHaveBeenCalled();
});
it.each(["error", "decode-rejection", "load-timeout", "decode-timeout"])(
  "settles optional artwork failure: %s",
  async (mode) => {
    const pending = warmImage("bad.webp", lifetime.signal, report);
    if (mode === "error") images[0]!.dispatchEvent(new Event("error"));
    if (mode === "decode-rejection") {
      images[0]!.decode = () => Promise.reject(new Error("decode"));
      images[0]!.dispatchEvent(new Event("load"));
    }
    if (mode === "decode-timeout") {
      images[0]!.decode = () => new Promise(() => {});
      images[0]!.dispatchEvent(new Event("load"));
    }
    await vi.advanceTimersByTimeAsync(15000);
    expect(await pending).toBeUndefined();
    expect(report).toHaveBeenCalledOnce();
    expect(images[0]!.hasAttribute("src")).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  },
);
it("deduplicates and limits batches to four, yielding before the next group", async () => {
  const retained = new Set<HTMLImageElement>();
  const pending = warmImages(["a", "a", "b", "c", "d", "e"], lifetime.signal, report, retained);
  expect(images).toHaveLength(4);
  images.forEach((image) => image.dispatchEvent(new Event("load")));
  await vi.advanceTimersByTimeAsync(15);
  expect(images).toHaveLength(4);
  await vi.advanceTimersByTimeAsync(1);
  expect(images).toHaveLength(5);
  images[4]!.dispatchEvent(new Event("load"));
  await pending;
  expect(retained.size).toBe(5);
});
it("cancels pending images without diagnostics or starting another batch", async () => {
  const pending = warmImages(["a", "b", "c", "d", "e"], lifetime.signal, report);
  lifetime.abort();
  await pending;
  expect(images).toHaveLength(4);
  expect(images.every((image) => !image.hasAttribute("src"))).toBe(true);
  expect(report).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
it("settles font timeouts, rejection, missing APIs and cancellation", async () => {
  await waitForFonts(lifetime.signal, report);
  Object.defineProperty(document, "fonts", { configurable: true, value: { ready: new Promise(() => {}) } });
  const pending = waitForFonts(lifetime.signal, report);
  await vi.advanceTimersByTimeAsync(10000);
  await pending;
  expect(report).toHaveBeenCalledWith("Font loading timed out");
  const cancelled = waitForFonts(lifetime.signal, report);
  lifetime.abort();
  await cancelled;
  expect(vi.getTimerCount()).toBe(0);
  const next = new AbortController();
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { ready: Promise.reject(new Error("font")) },
  });
  await waitForFonts(next.signal, report);
  expect(report).toHaveBeenCalledWith("Font loading failed");
});
