import { captureScreen } from "./support/rendered-evidence";
import { freshCombat } from "../../src/game/combat/index";
import { test, expect, type Locator } from "@playwright/test";
import { produce } from "immer";
import { definition, species } from "../../src/game/content";
import { assetUrl } from "../../src/ui/shared/assets";
import { accept, winBattle, run } from "../support/game";
import { seed, state, resume } from "./support/session";
import { gamepad } from "./support/gamepad";
import { fits } from "./support/layout";

for (const input of ["mouse", "keyboard", "controller"] as const)
  test(`free combat swaps save, replace hand cards, and preserve the starting lineup with ${input}`, async ({
    page,
  }) => {
    const press = input === "controller" ? await gamepad(page) : null;
    const fixture = produce(run(7), (d) => {
      d.roster.push("pollenmoth", "emberback");
      d.reserves = ["pollenmoth", "emberback"].map((kind) => ({
        id: `recruit-${kind}`,
        species: kind as "pollenmoth" | "emberback",
        health: 20,
        block: 0,
        combat: freshCombat(),
        attacked: false,
      }));
      d.team[1]!.health = 9;
      const cards = d.cards.filter((c) => c.ownerId === "ally-1");
      d.battle!.hand = [cards[0]!.id];
      d.battle!.discard = [cards[1]!.id];
      d.battle!.draw = d.cards.filter((c) => ![cards[0]!.id, cards[1]!.id].includes(c.id)).map((c) => c.id);
    });
    await seed(page, fixture);
    await resume(page);
    const activate = async (el: Locator) => {
      if (input === "mouse") await el.click();
      else {
        await el.focus();
        if (press) await press(0);
        else await page.keyboard.press("Enter");
      }
    };
    await expect(page.locator('.app:not([inert]) .player-row [data-species="pollenmoth"]')).toHaveCount(0);
    await activate(page.getByRole("button", { name: "Swap", exact: true }));
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".creature-card")).toHaveCount(5);
    if (input === "keyboard") {
      await dialog.getByRole("button", { name: "Mossguard, deployed", exact: true }).focus();
      await page.keyboard.press("a");
      await expect(dialog.getByRole("button", { name: "Prismram, deployed", exact: true })).toBeFocused();
      await page.keyboard.press("s");
      await expect(dialog.getByRole("button", { name: "Emberback, backup", exact: true })).toBeFocused();
      await page.keyboard.press("d");
      await expect(dialog.getByRole("button", { name: "Pollenmoth, backup", exact: true })).toBeFocused();
    }

    await activate(dialog.getByRole("button", { name: "Pollenmoth, backup", exact: true }));
    await activate(dialog.getByRole("button", { name: "Emberback, deployed", exact: true }));
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Swap", exact: true })).toBeFocused();
    const swapped = await state(page);
    expect(swapped.battle!.mana).toBe(fixture.battle!.mana);
    expect(swapped.battle!.turn).toBe(fixture.battle!.turn);
    expect(swapped.battle!.hand).toEqual(fixture.battle!.hand);
    expect(swapped.battle!.draw).toEqual(fixture.battle!.draw);
    expect(swapped.battle!.discard).toEqual(fixture.battle!.discard);
    expect(swapped.lineup).toEqual(fixture.lineup);
    expect(swapped.reserves.find((c) => c.id === "ally-1")!.health).toBe(9);
    const handCard = swapped.cards.find((card) => card.id === swapped.battle!.hand[0])!;
    const handDefinition = definition(handCard.definitionId);
    await expect(page.locator(".app:not([inert]) .hand .action-card img")).toHaveAttribute(
      "src",
      assetUrl(handDefinition.artwork ?? `action.${handDefinition.species}`),
    );
    await page.reload();
    await resume(page);
    expect(await state(page)).toEqual(swapped);
    await activate(page.getByRole("button", { name: "Open menu" }));
    await expect(page.getByRole("button", { name: "Lineup", exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await activate(page.getByRole("button", { name: "Swap", exact: true }));
    const restoredDialog = page.getByRole("dialog");
    await activate(restoredDialog.locator('[data-actor-id="recruit-pollenmoth"] .creature-card'));
    await activate(restoredDialog.locator('[data-actor-id="ally-1"] .creature-card'));
    expect((await state(page)).team[1]!.health).toBe(9);
  });

for (const [width, height] of [
  [1280, 800],
  [1920, 1080],
] as const)
  test(`live Swap and optional Lineup fit ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const fixture = produce(run(7), (d) => {
      d.roster.push("pollenmoth", "emberback");
      d.reserves = ["pollenmoth", "emberback"].map((kind) => ({
        id: `recruit-${kind}`,
        species: kind as "pollenmoth" | "emberback",
        health: 20,
        block: 0,
        combat: freshCombat(),
        attacked: false,
      }));
    });
    await seed(page, fixture);
    await resume(page);
    await captureScreen(page, { path: `reports/swapping/battle-${width}.png` });
    await page.getByRole("button", { name: "Swap", exact: true }).click();
    await page.getByRole("button", { name: "Emberback, deployed", exact: true }).click();
    await page.mouse.move(0, 0);
    await fits(page);
    const dialog = page.getByRole("dialog");
    const box = (await dialog.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
    for (const card of await dialog.locator(".creature-card").all()) {
      const size = (await card.boundingBox())!;
      expect(Math.abs(size.width / size.height - 4 / 3)).toBeLessThan(0.01);
    }
    await captureScreen(page, { path: `reports/swapping/swap-${width}.png` });
    await page.keyboard.press("Escape");
    const reward = winBattle(fixture);
    await seed(page, reward);
    await resume(page);
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("button", { name: "Lineup", exact: true }).click();
    await page.mouse.move(0, 0);
    await fits(page);
    await captureScreen(page, { path: `reports/swapping/lineup-${width}.png` });
    await page.getByRole("button", { name: "Pollenmoth, backup", exact: true }).click();
    await page.getByRole("button", { name: "Mossguard, starting", exact: true }).click();
    const edited = await state(page);
    expect(edited.lineup[0]).toBe("recruit-pollenmoth");
    expect(edited.phase).toBe("recruit");
    expect(edited.reward).toEqual(reward.reward);
    await page.reload();
    await resume(page);
    expect(await state(page)).toEqual(edited);
  });

test("a fallen deployed row resumes with no playable cards and can recover through a reserve swap", async ({
  page,
}) => {
  let s = produce(run(7), (d) => {
    d.roster.push("pollenmoth", "emberback");
    d.reserves = ["pollenmoth", "emberback"].map((kind) => ({
      id: `recruit-${kind}`,
      species: kind as "pollenmoth" | "emberback",
      health: 20,
      block: 0,
      combat: freshCombat(),
      attacked: false,
    }));
    d.phase = "teamSelection";
    d.battle = null;
    d.encounter = 1;
  });
  s = accept(s, { type: "beginBattle" });
  s = produce(s, (d) =>
    d.team.forEach((c) => {
      c.health = 0;
      c.block = 0;
    }),
  );
  await seed(page, s);
  await resume(page);
  await page.getByRole("button", { name: "End turn", exact: true }).click();
  await expect(page.locator(".app:not([inert]) .hand .action-card")).toHaveCount(0);
  const fallen = await state(page);
  expect(fallen.phase).toBe("battle");
  expect(fallen.team.every((c) => c.health === 0)).toBe(true);
  await page.reload();
  await resume(page);
  const ownerId = fallen.cards.find((c) => c.id === fallen.battle!.hand[0])!.ownerId;
  const outgoing = fallen.team.find((c) => c.id === ownerId)!;
  await page.getByRole("button", { name: "Swap", exact: true }).click();
  await page
    .getByRole("button", { name: `${species(outgoing.species).name}, deployed`, exact: true })
    .click();
  await page.getByRole("button", { name: "Pollenmoth, backup", exact: true }).click();
  await expect(page.locator(".app:not([inert]) .hand .action-card").first()).toBeVisible();
  const restored = await state(page);
  expect(restored.battle!.mana).toBe(4);
  expect(restored.battle!.hand).toEqual(fallen.battle!.hand);
  await page.getByRole("button", { name: "Swap", exact: true }).click();
  await expect(
    page.getByRole("dialog").locator(`[data-actor-id="${outgoing.id}"] .creature-card`),
  ).toHaveAttribute("aria-disabled", "true");
});
