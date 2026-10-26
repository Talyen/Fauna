// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { effectPalette, visualKeywords, readEffectTokens } from "../../../src/ui/shared/effects/palettes";
import { createEffectsStore, currentEffectPalette } from "../../../src/ui/shared/effects/effects-store";
import {
  EffectBaseline,
  EffectScope,
  EffectsScene,
  VisualEffectsProvider,
} from "../../../src/ui/shared/effects/effects";
import { ArtCard } from "../../../src/ui/shared/cards/art-card";
import { normalizeEffectIntensity } from "../../../src/ui/settings/preferences";

vi.mock("../../../src/ui/shared/effects/effect-background", () => ({
  EffectBackground: ({ palette }: { palette: ReturnType<typeof effectPalette> | null }) => (
    <div data-testid="palette">{palette?.keywords.join(" ") ?? "none"}</div>
  ),
}));
afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.focus;
});

it("uses displayed aliases and complete keyword identities rather than progression categories or costs", () => {
  expect(visualKeywords("Stunned; Bleeding; Stun; gain Water; Consume")).toEqual([
    "stun",
    "bleed",
    "water",
    "consume",
  ]);
  const pair = effectPalette(["stun", "bleed", "stun"]);
  expect(pair.plasma).toEqual({ primary: "var(--keyword-stun)", secondary: "var(--keyword-bleed)" });
  expect(pair.border).toEqual(["var(--keyword-stun)", "var(--keyword-bleed)", "var(--keyword-stun)"]);
  expect(effectPalette(["water"]).border).toEqual([
    "var(--keyword-water)",
    "var(--keyword-water-deep)",
    "var(--keyword-water)",
  ]);
  expect(effectPalette([]).plasma.primary).toBe("var(--keyword-physical)");
  expect(effectPalette(["stun", "bleed", "burn", "water"]).text).toHaveLength(6);
});

it("resolves Fauna-only deep colors through the token owner without mutating the DOM", () => {
  document.documentElement.style.setProperty("--keyword-water", "#60a5fa");
  document.documentElement.style.setProperty(
    "--keyword-water-deep",
    "color-mix(in srgb, #60a5fa 55%, #080807)",
  );
  const count = document.body.childElementCount;
  const tokens = readEffectTokens();
  expect(tokens["keyword-water"]).toBe("#60a5fa");
  expect(tokens["keyword-water-deep"]).toBe("#385e8d");
  expect(document.body.childElementCount).toBe(count);
  document.documentElement.removeAttribute("style");
});

it("restores older sources, scopes baselines, and never lets an outgoing owner clear a newer one", () => {
  const effects = createEffectsStore();
  const first = effectPalette(["burn"]),
    second = effectPalette(["freeze"]);
  const clearFirst = effects.register("first", { scope: "home", palette: first, priority: 0 });
  const clearSecond = effects.register("second", { scope: "home", palette: second, priority: 1 });
  expect(currentEffectPalette(effects.store.getState())).toBe(second);
  clearSecond();
  expect(currentEffectPalette(effects.store.getState())).toBe(first);
  effects.register("third", { scope: "home", palette: second, priority: 0 });
  clearFirst();
  expect(currentEffectPalette(effects.store.getState())).toBe(second);
  effects.configure({ scope: "inspection", scene: "default", glow: 100, particles: 100 });
  expect(currentEffectPalette(effects.store.getState())).toBeNull();
});

function Scene({ scope = "home", hidden = false }: { scope?: string; hidden?: boolean }) {
  return (
    <VisualEffectsProvider>
      <EffectsScene scope={scope} scene="none" glow={0} particles={0} />
      <EffectScope name="home">
        <EffectBaseline palette={effectPalette(["physical"])} />
        <div hidden={hidden}>
          <ArtCard artwork="/test.svg" aspect="action" aria-label="Mixed rules" effectText="Stun; Bleed" />
        </div>
        <ArtCard artwork="/test.svg" aspect="creature" aria-label="Unknown creature" />
      </EffectScope>
      <EffectScope name="inspection">
        <EffectBaseline palette={effectPalette(["water"])} />
      </EffectScope>
    </VisualEffectsProvider>
  );
}

it("tracks hover and intentional focus across scopes, hidden mounted screens and unmounting", async () => {
  const view = render(<Scene />);
  const card = screen.getByRole("button", { name: "Mixed rules" });
  fireEvent.pointerOver(card);
  expect(screen.getByTestId("palette").textContent).toBe("stun bleed");
  fireEvent.pointerOut(card, { relatedTarget: document.body });
  expect(screen.getByTestId("palette").textContent).toBe("physical");
  act(() => card.focus());
  expect(screen.getByTestId("palette").textContent).toBe("physical");
  act(() => {
    document.documentElement.dataset.focus = "visible";
  });
  await waitFor(() => expect(screen.getByTestId("palette").textContent).toBe("stun bleed"));
  fireEvent(window, new Event("blur"));
  expect(screen.getByTestId("palette").textContent).toBe("physical");
  fireEvent(window, new Event("focus"));
  expect(screen.getByTestId("palette").textContent).toBe("stun bleed");
  view.rerender(<Scene hidden />);
  await waitFor(() => expect(screen.getByTestId("palette").textContent).toBe("physical"));
  view.rerender(<Scene scope="inspection" />);
  expect(screen.getByTestId("palette").textContent).toBe("water");
  fireEvent.pointerOver(card);
  expect(screen.getByTestId("palette").textContent).toBe("water");
  view.rerender(<Scene />);
  expect(screen.getByRole("button", { name: "Unknown creature" }).hasAttribute("data-effect-keywords")).toBe(
    false,
  );
});

it("normalizes optional device intensities without admitting nonfinite or malformed values", () => {
  for (const value of [null, undefined, "25", NaN, Infinity, -Infinity])
    expect(normalizeEffectIntensity(value)).toBe(100);
  expect(normalizeEffectIntensity(-1)).toBe(0);
  expect(normalizeEffectIntensity(102)).toBe(100);
  expect(normalizeEffectIntensity(36.7)).toBe(37);
});
