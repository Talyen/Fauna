import { captureScreen } from "./support/rendered-evidence";
import { expect } from "@playwright/test";
import { winBattle, fullRosterReward } from "../support/game";
import { reloadHome, test, seed, state, resume } from "./support/session";
import { continueToRecruit } from "./support/journey";

test("recruitment adds a backup without exposing free lineup changes", async ({ page }) => {
  await seed(page, winBattle());
  await resume(page);
  await continueToRecruit(page);
  const beforeInspection = await state(page);
  const artwork = page.getByRole("button", { name: "Inspect Emberback", exact: true });
  await artwork.click();
  await expect(page.getByRole("heading", { name: "Emberback", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("button", { name: /Recruit|Choose/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(artwork).toBeFocused();
  expect(await state(page)).toEqual(beforeInspection);
  await page.getByRole("button", { name: "Recruit Emberback", exact: true }).click();
  const recruited = await state(page);
  expect(recruited.roster).toHaveLength(4);
  expect(recruited.reserves[0]!.species).toBe("emberback");
  expect(recruited.team[0]!.species).toBe("mossguard");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("button", { name: "Lineup", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await reloadHome(page);
  await resume(page);
  expect(await state(page)).toEqual(recruited);
  await page.locator(".app:not([inert]) [data-encounter]").click();
  expect((await state(page)).team[0]!.species).toBe("mossguard");
});

test("full-roster recruitment banks Collection progress and confirms only the displayed team", async ({
  page,
}) => {
  const fixture = fullRosterReward();
  await seed(page, fixture);
  await resume(page);
  await continueToRecruit(page);
  await expect(page.getByRole("button", { name: "Skip", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Recruit Emberback", exact: true }).click();
  const banked = await state(page);
  expect(banked.roster).toEqual(fixture.roster);
  expect(banked.discovery.recruited.emberback).toBe((fixture.discovery.recruited.emberback ?? 0) + 1);
  await expect(page.getByRole("heading", { name: "Choose your team", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Back", exact: true })).toHaveCount(0);
  const first = page.locator(
    '.app:not([inert]) .recruit-team-roster [data-roster-slot="ally-0"] .creature-card',
  );
  await first.click();
  await expect(first).toHaveAttribute("data-species", "emberback");
  expect(await state(page)).toEqual(banked);
  await captureScreen(page, { path: "reports/implementation/recruit-team-preview.png" });
  await reloadHome(page);
  await resume(page);
  await expect(page.getByRole("heading", { name: "Choose your team", exact: true })).toBeVisible();
  await expect(first).toHaveAttribute("data-species", "mossguard");
  expect(await state(page)).toEqual(banked);
  await first.click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  const recruited = await state(page);
  expect(recruited.roster).toHaveLength(5);
  expect(recruited.roster).not.toContain("mossguard");
  expect(recruited.team.find((c) => c.id === recruited.lineup[0])!.species).toBe("emberback");
  expect(recruited.discovery).toEqual(banked.discovery);
  expect(recruited.phase).toBe("teamSelection");
  await reloadHome(page);
  await resume(page);
  expect(await state(page)).toEqual(recruited);
});
