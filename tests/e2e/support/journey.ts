import { expect, type Page, type Locator } from "@playwright/test";
import { species, BOONS, definition } from "../../../src/game/content";
import { chosenRecipients } from "../../../src/game/play-queries";
import type { Command, GameState } from "../../../src/game/types";
import { policy } from "../../support/game";
import { state } from "./session";

export async function continueToRecruit(page: Page) {
  await expect(page.getByRole("heading", { name: "Choose a Recruit", exact: true })).toBeVisible();
}

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
    await continueToRecruit(page);
    await expect(page.locator(".boon-choice")).toHaveCount(0);
    await activate(
      page.getByRole("button", { name: `Recruit ${species(c.species).name}`, exact: true }).first(),
    );
  } else if (c.type === "confirmRecruit") {
    if (c.replace)
      await activate(page.locator(`.recruit-team-roster [data-roster-slot="${c.replace}"] .creature-card`));
    else await activate(page.getByRole("button", { name: "Keep team", exact: true }));
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
    const card = s.cards.find((entry) => entry.id === c.cardId);
    if (
      c.targetId &&
      s.phase === "battle" &&
      card &&
      chosenRecipients(s, definition(card.definitionId)).length > 1
    ) {
      await activate(
        s.reserves.some((unit) => unit.id === c.targetId)
          ? page.locator(`.app:not([inert]) [data-backup-target="${c.targetId}"]`)
          : s.battle!.enemies.some((unit) => unit.id === c.targetId) ||
              (s.battle!.minions ?? []).some((unit) => unit.id === c.targetId && unit.minion.side === "enemy")
            ? page.locator(`.app:not([inert]) .enemy-row [data-enemy-id="${c.targetId}"]`)
            : page.locator(`.app:not([inert]) .player-row [data-actor-id="${c.targetId}"] .creature-card`),
      );
    }
  } else await activate(page.getByRole("button", { name: /^End turn/ }));
}
