// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { useModalSurfaceRef } from "../../src/lib/modal-surface-ref";
import { CreatureDetails } from "../../src/ui/card-details";
import { Button } from "../../src/components/ui/button";
import { HandMotion } from "../../src/ui/hand-motion";
import { SurfaceTransition } from "../../src/ui/surface-transition";
import { createCombatImpacts } from "../../src/ui/combat-impact";
import { ManaCrystals } from "../../src/ui/mana-crystals";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("lets mana glints finish after pointer exit or blur, and replays them on a new entry", () => {
  const view = render(<ManaCrystals mana={4} />);
  const gem = view.container.querySelector<HTMLElement>(".mana-gem")!;
  expect(gem.querySelector(".mana-glint")?.getAttribute("data-glint")).toBe("false");
  fireEvent.pointerEnter(gem);
  const sweep = gem.querySelector(".mana-glint")!;
  expect(sweep.getAttribute("data-glint")).toBe("true");
  fireEvent.pointerLeave(gem);
  view.rerender(<ManaCrystals mana={3} previewCost={1} />);
  expect(gem.querySelector(".mana-glint")).toBe(sweep);
  expect(sweep.getAttribute("data-glint")).toBe("true");
  fireEvent.pointerEnter(gem);
  expect(gem.querySelector(".mana-glint")).not.toBe(sweep);

  document.documentElement.dataset.focus = "visible";
  try {
    const mana = view.getByRole("button", { name: "Mana 3 of 4" });
    fireEvent.focus(mana);
    const focusedSweeps = [...view.container.querySelectorAll('.mana-glint[data-glint="true"]')];
    expect(focusedSweeps).toHaveLength(4);
    fireEvent.blur(mana);
    expect([...view.container.querySelectorAll('.mana-glint[data-glint="true"]')]).toEqual(focusedSweeps);
  } finally {
    delete document.documentElement.dataset.focus;
  }
});

function motionEnvironment() {
  for (const [token, value] of Object.entries({
    "--motion-fast": "150ms",
    "--motion-support": "520ms",
    "--motion-hand-flight": "500ms",
    "--motion-hand-reflow": "320ms",
  }))
    document.documentElement.style.setProperty(token, value);
  let reduced = false;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return reduced;
    },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  }));
  const cancel = vi.fn();
  const animate = vi.fn(
    (_frames: Keyframe[] | PropertyIndexedKeyframes | null, _options?: number | KeyframeAnimationOptions) =>
      ({ cancel, onfinish: null }) as unknown as Animation,
  );
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(HTMLElement.prototype, "animate").mockImplementation(animate);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    width: 180,
    height: 240,
    bottom: 240,
    right: 180,
  } as DOMRect);
  return {
    cancel,
    animate,
    reduce() {
      reduced = true;
      listeners.forEach((fn) => fn());
    },
  };
}
it("finishes decorative hand flights before accepting input and reveals every committed card on unmount", () => {
  // jsdom does not implement WAAPI; this supplies only the animation ownership boundary.
  if (!HTMLElement.prototype.animate)
    HTMLElement.prototype.animate = (() => ({})) as unknown as typeof HTMLElement.prototype.animate;
  const env = motionEnvironment();
  const action = vi.fn();
  const hand = (revision: number, ids: string[]) => (
    <main className="battle-screen">
      <HandMotion revision={revision} paused={false}>
        <div className="hand">
          {ids.map((id) => (
            <div key={id} className="hand-slot">
              <div className="hand-reflow">
                <Button className="action-card" data-card-id={id} onClick={action}>
                  {id}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </HandMotion>
      <Button data-pile="draw">Draw</Button>
      <Button data-pile="discard">Discard</Button>
    </main>
  );
  const view = render(hand(1, ["one"]));
  view.rerender(hand(2, ["one", "two"]));
  expect(document.querySelector(".card-transfer")?.hasAttribute("inert")).toBe(true);
  expect(document.querySelector(".card-transfer")?.getAttribute("aria-hidden")).toBe("true");
  const card = view.container.querySelector<HTMLElement>('[data-card-id="two"]')!;
  expect(card.style.opacity).toBe("0");
  fireEvent.pointerDown(card);
  fireEvent.click(card);
  expect(action).toHaveBeenCalledTimes(1);
  expect(card.style.opacity).toBe("");
  expect(document.querySelector(".card-transfer")).toBeNull();
  view.rerender(hand(3, ["one", "two", "three"]));
  env.reduce();
  expect(document.querySelector(".card-transfer")).toBeNull();
  expect(
    [...view.container.querySelectorAll<HTMLElement>("[data-card-id]")].every((node) => !node.style.opacity),
  ).toBe(true);
  view.unmount();
  expect(document.querySelector(".card-transfer")).toBeNull();
});
it("crossfade copies never duplicate IDs or input ownership, and new input clears them", () => {
  if (!HTMLElement.prototype.animate)
    HTMLElement.prototype.animate = (() => ({})) as unknown as typeof HTMLElement.prototype.animate;
  const env = motionEnvironment();
  const view = render(
    <SurfaceTransition token="home">
      <main id="screen-owner">
        <Button>Home</Button>
      </main>
    </SurfaceTransition>,
  );
  view.rerender(
    <SurfaceTransition token="collection">
      <main id="screen-owner">
        <Button>Collection</Button>
      </main>
    </SurfaceTransition>,
  );
  expect(document.querySelectorAll("#screen-owner")).toHaveLength(1);
  expect(document.body.querySelector('[inert][aria-hidden="true"]')).not.toBeNull();
  fireEvent.keyDown(window, { key: "Tab" });
  expect(document.body.querySelector('[inert][aria-hidden="true"]')).toBeNull();
  expect(env.cancel).toHaveBeenCalled();
});
it("classifies committed action motion without prose, and revokes animation capabilities on disposal", () => {
  if (!HTMLElement.prototype.animate)
    HTMLElement.prototype.animate = (() => ({})) as unknown as typeof HTMLElement.prototype.animate;
  const env = motionEnvironment();
  const root = document.createElement("div");
  root.innerHTML =
    '<div data-actor-id="ally-0"><div class="combatant-motion"></div><div class="combatant-reaction"></div></div>';
  const owner = createCombatImpacts(() => root);
  owner.present([{ kind: "action", text: "Anything", actorId: "ally-0", actionType: "support" }]);
  expect(env.animate.mock.calls[0]?.[1]).toMatchObject({ duration: 520 });
  owner.present([{ kind: "action", text: "Uses an attack", actorId: "ally-0" }]);
  expect(env.animate).toHaveBeenCalledTimes(1);
  env.reduce();
  expect(env.cancel).toHaveBeenCalled();
  owner.dispose();
  owner.present([{ kind: "action", text: "Anything", actorId: "ally-0", actionType: "attack" }]);
  expect(env.animate).toHaveBeenCalledTimes(1);
});

it("opening creature details does not steal focus from a combatant or action", () => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  const surface = (open: boolean) => (
    <main>
      <Button>First action</Button>
      <Button>Target creature</Button>
      {open ? <CreatureDetails kind="mossback" /> : null}
    </main>
  );
  const view = render(surface(false));
  const target = view.getByRole("button", { name: "Target creature" });
  target.focus();
  view.rerender(surface(true));
  expect(document.activeElement).toBe(target);
});

it("retained modal pixels become inert and inaccessible, and a reversed close restores availability", async () => {
  const forwarded = { current: null as HTMLDivElement | null };
  function Surface({ state }: { state: string }) {
    const ref = useModalSurfaceRef(forwarded);
    return (
      <div ref={ref} data-state={state}>
        <Button>Action</Button>
      </div>
    );
  }
  const view = render(<Surface state="open" />);
  const node = forwarded.current!;
  view.rerender(<Surface state="closed" />);
  await waitFor(() => expect(node.hasAttribute("inert")).toBe(true));
  expect(node.getAttribute("aria-hidden")).toBe("true");
  view.rerender(<Surface state="open" />);
  await waitFor(() => expect(node.hasAttribute("inert")).toBe(false));
  expect(node.hasAttribute("aria-hidden")).toBe(false);
  view.unmount();
  expect(forwarded.current).toBeNull();
});
