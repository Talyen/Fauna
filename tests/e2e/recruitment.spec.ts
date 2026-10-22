import { captureScreen } from "./support/rendered-evidence";
import { freshCombat } from "../../src/game/combat/index";
import { test, expect } from "@playwright/test";
import { produce } from "immer";
import { winBattle } from "../support/game";
import { seed, state, resume } from "./support/session";

test("recruitment adds a backup without exposing free lineup changes", async ({ page }) => {
  await seed(page, winBattle());
  await resume(page);
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
  await page.reload();
  await resume(page);
  expect(await state(page)).toEqual(recruited);
  await page.locator(".app:not([inert]) [data-encounter]").click();
  expect((await state(page)).team[0]!.species).toBe("mossguard");
});

test("recruitment at five requires replacement and updates a released starter's lineup entry", async ({
  page,
}) => {
  const fixture = produce(winBattle(), (d) => {
    d.wins = 1;
    d.roster.push("pollenmoth", "prismram");
    d.reserves = ["pollenmoth", "prismram"].map((kind) => ({
      id: `recruit-${kind}`,
      species: kind as "pollenmoth" | "prismram",
      health: 20,
      block: 0,
      combat: freshCombat(),
      attacked: false,
    }));
  });
  await seed(page, fixture);
  await resume(page);
  await page.getByRole("button", { name: "Recruit Emberback", exact: true }).click();
  expect((await state(page)).roster).toEqual(fixture.roster);
  await expect(page.getByRole("heading", { name: "Replace a creature", exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Incoming recruit" })
      .getByRole("button", { name: "Inspect Emberback", exact: true }),
  ).toBeVisible();
  await captureScreen(page, { path: "reports/implementation/recruit-replacement.png" });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await state(page)).revision).toBe(fixture.revision);
  await page.getByRole("button", { name: "Recruit Emberback", exact: true }).click();
  await page.getByRole("button", { name: "Release Mossguard", exact: true }).click();
  const recruited = await state(page);
  expect(recruited.roster).toHaveLength(5);
  expect(recruited.roster).not.toContain("mossguard");
  expect(recruited.team.find((c) => c.id === recruited.lineup[0])!.species).toBe("emberback");
  expect(recruited.phase).toBe("teamSelection");
  await page.reload();
  await resume(page);
  expect(await state(page)).toEqual(recruited);
});
