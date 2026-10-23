import { captureScreen } from "./support/rendered-evidence";
import { freshCombat } from "../../src/game/combat/index";
import { expect } from "@playwright/test";
import { produce } from "immer";
import { run } from "../support/game";
import { reloadHome, test, seed, state, resume } from "./support/session";
import { gamepad } from "./support/gamepad";
import { fits } from "./support/layout";

function fixture(fallen = true) {
  return produce(run(7), (d) => {
    for (const kind of ["pollenmoth", "emberback"] as const) {
      d.roster.push(kind);
      d.reserves.push({
        id: `recruit-${kind}`,
        species: kind,
        health: 20,
        block: 0,
        attacked: false,
        combat: freshCombat(),
      });
    }
    if (fallen) d.team[0]!.health = 0;
  });
}
for (const input of ["mouse", "keyboard", "controller"] as const)
  test(`knockout replacement is required and transfers focus with ${input}`, async ({ page }) => {
    const press = input === "controller" ? await gamepad(page) : null;
    const initial = fixture();
    await seed(page, initial);
    await resume(page);
    await expect(page.getByRole("button", { name: "Swap", exact: true })).toHaveCount(0);
    const dialog = page.getByRole("dialog", { name: "Choose a replacement" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    const moth = dialog.getByRole("button", { name: "Pollenmoth, backup", exact: true });
    if (input === "mouse") await moth.click();
    else {
      await expect(moth).toBeFocused();
      if (press) await press(0);
      else await page.keyboard.press("Enter");
    }
    await expect(dialog).not.toBeVisible();
    await expect(page.locator(".app:not([inert]) .hand .action-card").first()).toBeFocused();
    const next = await state(page);
    expect(next.team[0]!.id).toBe("recruit-pollenmoth");
    expect(next.battle!.mana).toBe(initial.battle!.mana);
    expect(next.battle!.turn).toBe(initial.battle!.turn);
    expect(next.battle!.hand).toEqual(initial.battle!.hand);
    expect(next.lineup[0]).toBe("recruit-pollenmoth");
    if (input === "mouse") {
      await reloadHome(page);
      await resume(page);
      expect(await state(page)).toEqual(next);
      await expect(page.getByRole("dialog", { name: "Choose a replacement" })).toHaveCount(0);
    }
  });

for (const [width, height, scale] of [
  [1280, 720, 1.25],
  [1920, 1080, 1],
] as const)
  test(`replacement choice fits ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.addInitScript((scale) => localStorage.setItem("fauna.text-scale", String(scale)), scale);
    await seed(page, fixture());
    await resume(page);
    await fits(page);
    await captureScreen(page, { path: `reports/swapping/replacement-${width}.png` });
    const dialog = page.getByRole("dialog", { name: "Choose a replacement" });
    for (const card of await dialog.locator(".creature-card").all()) {
      const size = (await card.boundingBox())!;
      expect(Math.abs(size.width / size.height - 4 / 3)).toBeLessThan(0.01);
    }
  });

test("several knockouts resume as successive choices without a free swap or lineup menu", async ({
  page,
}) => {
  const initial = produce(fixture(), (d) => {
    d.team.forEach((c) => (c.health = 0));
  });
  await seed(page, initial);
  await resume(page);
  let dialog = page.getByRole("dialog", { name: "Choose a replacement" });
  await dialog.getByRole("button", { name: "Pollenmoth, backup", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Choose a replacement" });
  await expect(dialog.getByRole("button", { name: "Emberback, backup", exact: true })).toBeFocused();
  await reloadHome(page);
  await resume(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Emberback, backup", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const next = await state(page);
  expect(next.team.filter((c) => c.health > 0)).toHaveLength(2);
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("button", { name: "Lineup", exact: true })).toHaveCount(0);
});
