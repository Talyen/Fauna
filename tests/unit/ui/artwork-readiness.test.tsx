// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { startTransition, Suspense, useState } from "react";
import { createArtworkCache } from "../../../src/ui/shared/artwork-cache";
import { ArtworkContext, useArtwork } from "../../../src/ui/shared/artwork";
import { battleArtwork, immediateArtwork } from "../../../src/ui/startup/artwork";
import { definition, GENERATED_CARDS } from "../../../src/game/content";
import { assetUrl } from "../../../src/ui/shared/assets";
import { run, starterJourney } from "../../support/game";
import { encounterSource } from "../../../src/game/encounters";

let images: HTMLImageElement[];
let cache: ReturnType<typeof createArtworkCache>;
const report = vi.fn();
beforeEach(() => {
  vi.useFakeTimers();
  report.mockClear();
  images = [];
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  vi.stubGlobal("Image", function () {
    const image = document.createElement("img");
    Object.defineProperties(image, {
      complete: { value: false },
      naturalWidth: { value: 4 },
      naturalHeight: { value: 4 },
    });
    image.decode = vi.fn().mockResolvedValue(undefined);
    images.push(image);
    return image;
  });
  cache = createArtworkCache(report);
});
afterEach(() => {
  cleanup();
  cache.dispose();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const tick = () => vi.advanceTimersByTimeAsync(1);
const loaded = async (image: HTMLImageElement) => {
  image.dispatchEvent(new Event("load"));
  await tick();
};

it("deduplicates fetch/decode, preempts speculation and yields between images", async () => {
  const release = cache.prefetch(["optional", "unused"]);
  await vi.advanceTimersByTimeAsync(100);
  expect(images.map((image) => image.getAttribute("src"))).toEqual(["optional"]);
  expect(images[0]!.fetchPriority).toBe("low");
  const ready = cache.prepare(["urgent", "urgent"]);
  await tick();
  expect(images[0]!.hasAttribute("src")).toBe(false);
  expect(images[1]!.getAttribute("src")).toBe("urgent");
  expect(images[1]!.fetchPriority).toBe("high");
  await loaded(images[1]!);
  await ready;
  await cache.prepare(["urgent"]);
  expect(images).toHaveLength(2);
  await vi.advanceTimersByTimeAsync(100);
  expect(images[2]!.getAttribute("src")).toBe("optional");
  release();
  await tick();
  expect(images[2]!.hasAttribute("src")).toBe(false);
  expect(report).not.toHaveBeenCalled();
});

it("keeps a complete, interactive previous screen until the entire next group has decoded", async () => {
  const first = cache.prepare(["first"]);
  await tick();
  await loaded(images[0]!);
  await first;
  function Gallery() {
    const [next, select] = useState(false);
    useArtwork(next ? ["second", "third"] : ["first"]);
    return (
      <>
        <h1>{next ? "Next" : "First"}</h1>
        <button onClick={() => startTransition(() => select(true))}>Next page</button>
      </>
    );
  }
  render(
    <ArtworkContext value={cache}>
      <Suspense fallback={<p>Loading</p>}>
        <Gallery />
      </Suspense>
    </ArtworkContext>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  await act(tick);
  expect(screen.getByRole("heading", { name: "First" })).toBeTruthy();
  expect(screen.queryByText("Loading")).toBeNull();
  let decode = () => {};
  images[1]!.decode = () =>
    new Promise<void>((resolve) => {
      decode = resolve;
    });
  await act(async () => {
    images[1]!.dispatchEvent(new Event("load"));
    await tick();
  });
  expect(screen.getByRole("heading", { name: "First" })).toBeTruthy();
  await act(async () => {
    decode();
    await tick();
  });
  expect(images[2]!.getAttribute("src")).toBe("third");
  expect(screen.getByRole("heading", { name: "First" })).toBeTruthy();
  await act(async () => {
    await loaded(images[2]!);
    await vi.advanceTimersByTimeAsync(500);
  });
  expect(screen.getByRole("heading", { name: "Next" })).toBeTruthy();
  expect(screen.queryByText("Loading")).toBeNull();
});

it("retains on-screen images while evicting unused decoded pixels and re-decodes an evicted image", async () => {
  cache.dispose();
  cache = createArtworkCache(report, 64);
  const first = cache.prepare(["visible"]);
  await tick();
  await loaded(images[0]!);
  await first;
  const release = cache.retain(["visible"]);
  const second = cache.prepare(["old"]);
  await tick();
  await loaded(images[1]!);
  await second;
  cache.prefetch(["new"]);
  await vi.advanceTimersByTimeAsync(100);
  await loaded(images[2]!);
  await vi.advanceTimersByTimeAsync(1000);
  expect(() => cache.read(["visible", "new"])).not.toThrow();
  const revisited = cache.prepare(["old"]);
  await tick();
  expect(images[3]!.getAttribute("src")).toBe("old");
  await loaded(images[3]!);
  await revisited;
  release();
  release();
});

it("pauses speculative work while hidden or input is active and cancels obsolete requests", async () => {
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  const release = cache.prefetch(["optional"]);
  await vi.advanceTimersByTimeAsync(1000);
  expect(images).toHaveLength(0);
  hidden.mockReturnValue(false);
  document.dispatchEvent(new Event("visibilitychange"));
  window.dispatchEvent(new Event("pointerdown"));
  await vi.advanceTimersByTimeAsync(199);
  expect(images).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(101);
  expect(images).toHaveLength(1);
  release();
  await tick();
  expect(images[0]!.hasAttribute("src")).toBe(false);
  await vi.advanceTimersByTimeAsync(16000);
  expect(images).toHaveLength(1);
  expect(report).not.toHaveBeenCalled();
});

it("retries a failed decode once, never declares it ready, and lets the shared recovery owner retry", async () => {
  const failed = cache.prepare(["broken"]).catch((error: unknown) => error);
  await tick();
  images[0]!.dispatchEvent(new Event("error"));
  await tick();
  images[1]!.dispatchEvent(new Event("error"));
  await tick();
  expect(await failed).toBeInstanceOf(Error);
  expect(() => cache.read(["broken"])).toThrow("Artwork unavailable");
  expect(images).toHaveLength(2);
  cache.retryFailures();
  const recovered = cache.prepare(["broken"]);
  await tick();
  await loaded(images[2]!);
  await recovered;
  expect(() => cache.read(["broken"])).not.toThrow();
});

it("settles disposal without late callbacks or uncancelled work", async () => {
  const pending = cache.prepare(["pending", "queued"]);
  await tick();
  cache.dispose();
  await pending;
  await vi.advanceTimersByTimeAsync(16000);
  expect(images).toHaveLength(1);
  expect(report).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it("prepares every draw, generated Food and summon before battle, and actual destination slices without advancing RNG", () => {
  const battle = run();
  const before = JSON.stringify(battle);
  const urls = battleArtwork(battle);
  for (const card of battle.cards) {
    const def = definition(card.definitionId);
    expect(urls).toContain(assetUrl(def.artwork ?? `action.${def.species}`));
  }
  for (const card of GENERATED_CARDS) expect(urls).toContain(assetUrl(card.artwork!));
  for (const id of [
    "food.apple",
    "food.mana-berries",
    "food.trail-bread",
    "minion.echo",
    "minion.pendulum",
    "minion.gilded-ward",
    "minion.royal-bloom",
  ])
    expect(urls).toContain(assetUrl(id));
  const destinations = starterJourney(7, "emberback");
  for (const enemy of encounterSource(destinations).enemies)
    expect(immediateArtwork(destinations)).toContain(assetUrl(`creature.${enemy.species}`));
  expect(JSON.stringify(battle)).toBe(before);
});
