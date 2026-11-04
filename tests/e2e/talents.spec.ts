import { expect } from "@playwright/test";
import { produce } from "immer";
import { TALENTS } from "../../src/game/content";
import { run } from "../support/game";
import { test, seed, state, resume } from "./support/session";
import { gamepad } from "./support/gamepad";

test("talents purchase immediately, gate rows, reset a category, and return to the paused battle", async ({
  page,
}) => {
  const fixture = produce(run(7), (d) => {
    d.keywordXP = { burn: 100, block: 20 };
    d.talents = ["block.second-wind"];
  });
  await seed(page, fixture);
  await resume(page);
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Talents", exact: true }).click();
  const burn = page.getByRole("button", { name: "Burn talents", exact: true });
  await expect(burn).toHaveAccessibleDescription("3 points available");
  await burn.click();
  await expect(page.getByRole("button", { name: "Next page" })).toHaveCount(0);
  const laterTalent = TALENTS.find((talent) => talent.keyword === "burn" && talent.row === 1)!;
  const later = page.getByRole("button", { name: laterTalent.name, exact: true });
  await expect(later).toHaveAttribute("aria-disabled", "true");
  await expect(later).toHaveAccessibleDescription(/Requires all earlier rows/);
  const before = (await state(page)).revision;
  await later.focus();
  await page.keyboard.press("Enter");
  expect((await state(page)).revision).toBe(before);
  await page.getByRole("button", { name: "Flashpoint", exact: true }).click();
  await expect(page.getByRole("button", { name: "Flashpoint, unlocked", exact: true })).toBeFocused();
  expect((await state(page)).talents).toHaveLength(2);
  await expect(later).toHaveAttribute("aria-disabled", "false");
  await expect(page.getByText("2 points available", { exact: true })).toBeVisible();
  await later.click();
  expect((await state(page)).talents).toContain(laterTalent.id);
  const reset = page.getByRole("button", { name: "Reset Burn talents", exact: true });
  await reset.click();
  expect((await state(page)).talents).toEqual(["block.second-wind"]);
  expect((await state(page)).keywordXP.burn).toBe(100);
  await expect(reset).toBeDisabled();
  await expect(page.getByRole("button", { name: "Flashpoint", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(burn).toBeFocused();
  await expect(burn).toHaveAccessibleDescription("3 points available");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Pause menu" })).toBeVisible();
  await page.getByRole("button", { name: "Return to Battle", exact: true }).click();
  expect((await state(page)).battle).toEqual(fixture.battle);
});

test("the whole talent tree stays reachable without pages", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => localStorage.setItem("fauna.test.text-scale", "1.25"));
  const press = await gamepad(page);
  await seed(page, run());
  await page.getByRole("button", { name: "Talents", exact: true }).click();
  const burn = page.getByRole("button", { name: "Burn talents", exact: true });
  await burn.click();
  const tree = page.getByRole("region", { name: "Burn talents" });
  await expect(tree.locator(".talent-row")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "Next page" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Flashpoint", exact: true })).toBeFocused();
  await press(13);
  await press(13);
  await press(13);
  const last = page.getByRole("button", { name: "Fire Resistance", exact: true });
  await expect(last).toBeFocused();
  const withinRegion = await last.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const region = element.closest(".talent-tree-viewport")!.getBoundingClientRect();
    return bounds.top >= region.top - 1 && bounds.bottom <= region.bottom + 1;
  });
  expect(withinRegion).toBe(true);
  await expect(tree).not.toHaveAttribute("data-scroll-region");
  await page.keyboard.press("Escape");
  await expect(burn).toBeFocused();
  await page.getByRole("button", { name: "Armor talents", exact: true }).click();
  const armor = page.getByRole("region", { name: "Armor talents" });
  const finalRow = armor.locator(".talent-row").last();
  await expect(finalRow.locator(".talent-node")).toHaveCount(4);
  const rows = await finalRow
    .locator(".talent-node")
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().top));
  expect(new Set(rows).size).toBe(1);
  await expect(armor).not.toHaveAttribute("data-scroll-region");
});
