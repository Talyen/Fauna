// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TooltipProvider } from "../../../src/components/ui/tooltip";
import { freshCombat } from "../../../src/game/combat";
import type { Creature, Enemy } from "../../../src/game/types";
import { ArtCard } from "../../../src/ui/shared/art-card";
import { AllyCard, EnemyCard } from "../../../src/ui/shared/cards";
import { run } from "../../support/game";

afterEach(cleanup);

it("follows committed ally and enemy control state without replacing artwork targets or status rules", () => {
  const game = run();
  const ally: Creature = {
    ...game.team[0]!,
    combat: { ...freshCombat(), controlled: "stun", controlTurns: 2 },
  };
  const enemy: Enemy = {
    ...game.battle!.enemies[0]!,
    combat: { ...freshCombat(), controlled: "freeze", controlTurns: 1 },
  };
  const click = vi.fn();
  const cards = () => (
    <TooltipProvider>
      <AllyCard creature={ally} onClick={click} />
      <EnemyCard enemy={enemy} />
    </TooltipProvider>
  );
  const view = render(cards());
  const target = view.container.querySelector<HTMLButtonElement>(".creature-card")!;
  const stars = target.querySelector('[data-control-art="stun"]')!;
  expect(stars.getAttribute("aria-hidden")).toBe("true");
  expect(stars.querySelectorAll(".control-star")).toHaveLength(8);
  expect(view.container.querySelectorAll('[data-control-art="freeze"] .control-crystal')).toHaveLength(12);
  expect(screen.getByRole("button", { name: "Stunned: 2 turns" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Frozen: 1 turn" })).toBeTruthy();
  target.click();
  expect(click).toHaveBeenCalledWith(target);
  target.focus();

  // Incoming control replaces its artwork immediately; recovery and knockout clear it.
  ally.combat = { ...freshCombat(), controlled: "freeze", controlTurns: 1 };
  enemy.health = 0;
  view.rerender(cards());
  expect(view.container.querySelector(".creature-card")).toBe(target);
  expect(document.activeElement).toBe(target);
  expect(view.container.querySelector('[data-control-art="stun"]')).toBeNull();
  expect(view.container.querySelectorAll('[data-control-art="freeze"]')).toHaveLength(1);
  ally.combat = freshCombat();
  view.rerender(cards());
  expect(view.container.querySelector("[data-control-art]")).toBeNull();
  expect(document.activeElement).toBe(target);
});

it("does not mistake accumulating stacks or a skipped turn for active control", () => {
  const ally = { ...run().team[0]!, combat: { ...freshCombat(), stun: 3, freeze: 4, skipped: true } };
  const view = render(
    <TooltipProvider>
      <AllyCard creature={ally} presentation />
    </TooltipProvider>,
  );
  expect(view.container.querySelector("[data-control-art]")).toBeNull();
});

it("keeps control decoration on presentation creature artwork and off action artwork", () => {
  const view = render(
    <ArtCard
      artwork="creature.webp"
      aspect="creature"
      control="freeze"
      presentation
      aria-label="Frozen creature"
    />,
  );
  expect(
    screen.getByRole("img", { name: "Frozen creature" }).querySelector('[data-control-art="freeze"]'),
  ).toBeTruthy();
  view.rerender(<ArtCard artwork="action.webp" aspect="action" control="freeze" presentation />);
  expect(view.container.querySelector("[data-control-art]")).toBeNull();
});
