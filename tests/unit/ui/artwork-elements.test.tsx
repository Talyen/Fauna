// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { Suspense } from "react";
import { createPortal } from "react-dom";
import { createArtworkCache } from "../../../src/ui/shared/artwork-cache";
import { ArtworkContext, useArtwork } from "../../../src/ui/shared/artwork";
import { ArtCard } from "../../../src/ui/shared/cards/art-card";
import { registerArtworkElement, replaceVisualArtwork } from "../../../src/ui/shared/artwork-elements";
import { visualClone } from "../../../src/ui/shared/visual-clone";

let images: HTMLImageElement[];
let cache: ReturnType<typeof createArtworkCache>;
beforeEach(() => {
  vi.useFakeTimers();
  images = [];
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  vi.stubGlobal("Image", function () {
    const image = document.createElement("img");
    Object.defineProperties(image, {
      complete: { value: false },
      naturalWidth: { value: 120 },
      naturalHeight: { value: 160 },
    });
    image.decode = vi.fn().mockResolvedValue(undefined);
    image.checkVisibility = () => true;
    images.push(image);
    return image;
  });
  cache = createArtworkCache(vi.fn());
});
afterEach(() => {
  cleanup();
  cache.dispose();
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const tick = () => vi.advanceTimersByTimeAsync(1);
async function load(image: HTMLImageElement) {
  image.dispatchEvent(new Event("load"));
  await tick();
}
async function prepare(urls: string[]) {
  const ready = cache.prepare(urls);
  for (let index = 0; index < urls.length; index++) {
    await tick();
    await load(images[index]!);
  }
  await ready;
}

it("mounts the exact decoded elements and keeps same-source consumers separate across Suspense retries", async () => {
  await prepare(["art"]);
  expect(cache.canAcquire(["art"])).toBe(true);
  expect(cache.canAcquire(["art", "art"])).toBe(false);
  const view = render(
    <ArtworkContext value={cache}>
      <Suspense fallback={<p>Preparing</p>}>
        <ArtCard artwork="art" aspect="action" presentation />
        <ArtCard artwork="art" aspect="action" presentation />
      </Suspense>
    </ArtworkContext>,
  );
  expect(view.queryByText("Preparing")).toBeTruthy();
  await act(tick);
  await act(async () => {
    await load(images[1]!);
    await vi.advanceTimersByTimeAsync(500);
  });
  const mounted = [...view.container.querySelectorAll("img")];
  expect(mounted).toHaveLength(2);
  expect(new Set(mounted)).toEqual(new Set(images.slice(0, 2)));
  expect(view.queryByText("Preparing")).toBeNull();
});

it("borrows ready elements for snapshots and skips a copy when its spare is still decoding", async () => {
  await prepare(["front"]);
  const original = cache.mount(cache.acquire("front"));
  const root = document.createElement("div");
  root.append(original.image);
  document.body.append(root);
  registerArtworkElement(original.image, (url) => cache.borrow(url));
  await vi.advanceTimersByTimeAsync(100);
  await load(images[1]!);
  const clone = visualClone(root)!;
  expect(clone.querySelector("img")).toBe(images[1]);
  expect(original.image.parentElement).toBe(root);
  expect(visualClone(root)).toBeNull();
  clone.remove();
  expect(images[1]!.parentElement).toBeNull();
  const revisited = visualClone(root)!;
  expect(revisited.querySelector("img")).toBe(images[1]);
  revisited.remove();
  original.release();
});

it("flips a decorative face using a ready element without mutating any cached source URL", async () => {
  await prepare(["front", "back"]);
  const original = cache.mount(cache.acquire("front"));
  const root = document.createElement("div");
  root.append(original.image);
  document.body.append(root);
  registerArtworkElement(original.image, (url) => cache.borrow(url));
  await vi.advanceTimersByTimeAsync(100);
  await load(images[2]!);
  const clone = visualClone(root)!;
  const front = clone.querySelector("img")!;
  const back = replaceVisualArtwork(clone, front, "back");
  expect(back).toBe(images[1]);
  expect(front.getAttribute("src")).toBe("front");
  expect(original.image.getAttribute("src")).toBe("front");
  clone.remove();
  original.release();
});

it("prepares a portal's additional consumer before creating any of its visible surface", async () => {
  await prepare(["art"]);
  const existing = cache.mount(cache.acquire("art"));
  function Detail() {
    useArtwork(["art"], true);
    return createPortal(
      <div data-testid="detail">
        <ArtCard artwork="art" aspect="action" presentation />
      </div>,
      document.body,
    );
  }
  const view = render(
    <ArtworkContext value={cache}>
      <Suspense fallback={<p>Previous surface</p>}>
        <Detail />
      </Suspense>
    </ArtworkContext>,
  );
  expect(view.queryByText("Previous surface")).toBeTruthy();
  expect(view.queryByTestId("detail")).toBeNull();
  await act(tick);
  await act(async () => {
    await load(images[1]!);
    await vi.advanceTimersByTimeAsync(500);
  });
  expect(view.getByTestId("detail").querySelector("img")).toBe(images[1]);
  expect(existing.image.parentElement).toBeNull();
  existing.release();
});
