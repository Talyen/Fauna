import { expect, type Page, type Locator } from "@playwright/test";
import { species, BOONS } from "../../../src/game/content";
import type { Command, GameState } from "../../../src/game/types";
import { policy } from "../../support/game";
import { state } from "./session";

export async function step(
  page: Page,
  activate: (el: Locator) => Promise<void> = (el) => el.click(),
  committed?: GameState,
  selected?: Command,
) {
  const s = committed ?? (await state(page)),
    c = selected ?? policy(s);
  if (c.type === "beginBattle") {
    await activate(page.locator(".app:not([inert]) [data-encounter]"));
  } else if (c.type === "visitCampfire") {
    await activate(page.getByRole("button", { name: "Visit Campfire", exact: true }));
  } else if (c.type === "rest") {
    await activate(page.getByRole("button", { name: /^Rest/ }));
  } else if (c.type === "recruit") {
    await expect(page.getByRole("button", { name: "Skip", exact: true })).toHaveCount(0);
    await expect(page.locator(".boon-choice")).toHaveCount(0);
    await activate(
      page.getByRole("button", { name: `Recruit ${species(c.species).name}`, exact: true }).first(),
    );
    if (c.replace) {
      const replacement = page.locator(`.recruit-options [data-actor-id="${c.replace}"] .creature-card`);
      while ((await replacement.count()) === 0) {
        const next = page
          .getByRole("navigation", { name: "Recruit pages" })
          .getByRole("button", { name: "Next page" });
        await expect(next).toBeEnabled();
        await activate(next);
      }
      await activate(replacement);
    }
  } else if (c.type === "swap") {
    const dialog = page.getByRole("dialog", { name: "Choose a replacement" });
    await activate(dialog.locator(`[data-actor-id="${c.reserve}"] .creature-card`));
  } else if (c.type === "chooseBoon") {
    await expect(page.getByRole("button", { name: /^Recruit / })).toHaveCount(0);
    await activate(
      page.getByRole("button", {
        name: `Choose ${BOONS.find((r) => r.id === c.boon)!.name}`,
        exact: true,
      }),
    );
  } else if (c.type === "play") {
    await activate(page.locator(`.app:not([inert]) .hand [data-card-id="${c.cardId}"]`));
    if (c.targetId) {
      await activate(
        s.battle!.enemies.some((unit) => unit.id === c.targetId) ||
          (s.battle!.minions ?? []).some((unit) => unit.id === c.targetId && unit.minion.side === "enemy")
          ? page.locator(`.app:not([inert]) .enemy-row [data-enemy-id="${c.targetId}"]`)
          : page.locator(`.app:not([inert]) .player-row [data-actor-id="${c.targetId}"] .creature-card`),
      );
    }
  } else await activate(page.getByRole("button", { name: /^End turn/ }));
}
