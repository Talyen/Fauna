import { expect } from "@playwright/test";
import { produce } from "immer";
import { TALENTS } from "../../src/game/content";
import { run } from "../support/game";
import { test, seed, state, resume } from "./support/session";

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
  const laterTalent = TALENTS.find((talent) => talent.keyword === "burn" && talent.row === 1)!;
  const later = page.getByRole("button", { name: laterTalent.name, exact: true });
  if (!(await later.isVisible())) await page.getByRole("button", { name: "Next page" }).click();
  await expect(later).toHaveAttribute("aria-disabled", "true");
  const before = (await state(page)).revision;
  await later.focus();
  await page.keyboard.press("Enter");
  expect((await state(page)).revision).toBe(before);
  if (!(await page.getByRole("button", { name: "Melting Point", exact: true }).isVisible()))
    await page.getByRole("button", { name: "Previous page" }).click();
  await page.getByRole("button", { name: "Melting Point", exact: true }).click();
  await page.getByRole("button", { name: "Flashpoint", exact: true }).click();
  await expect(page.getByRole("button", { name: "Flashpoint, unlocked", exact: true })).toBeFocused();
  expect((await state(page)).talents).toHaveLength(3);
  if (!(await later.isVisible())) await page.getByRole("button", { name: "Next page" }).click();
  await expect(later).toHaveAttribute("aria-disabled", "false");
  await expect(page.getByText("1 point available", { exact: true })).toBeVisible();
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
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  expect((await state(page)).battle).toEqual(fixture.battle);
});
