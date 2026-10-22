import { captureScreen } from "./rendered-evidence";
import { freshCombat } from "../../src/game/combat/index";
import { test, expect } from "@playwright/test";
import { produce } from "immer";
import { winBattle } from "../support/game";
import { seed, state, resume } from "./support/session";

test("recruitment adds a reserve, selection swaps its kit, and remembers active choices", async ({
  page,
}) => {
  await seed(page, winBattle());
  await resume(page);
  await page.getByRole("button", { name: "Recruit Emberback", exact: true }).click();
  expect((await state(page)).roster).toHaveLength(4);
  expect((await state(page)).phase).toBe("teamSelection");
  await expect(page.getByRole("button", { name: "Mossguard, starting", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Lineup", exact: true }).click();
  const active = page.getByRole("button", { name: "Mossguard, starting", exact: true }),
    reserve = page.getByRole("button", { name: "Emberback, backup", exact: true });
  await reserve.focus();
  await page.keyboard.press("i");
  await expect(page.getByRole("dialog", { name: "Emberback", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(reserve).toBeFocused();
  await active.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("s");
  await expect(reserve).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Lineup", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  const s = await state(page);
  expect(s.team.find((c) => c.id === s.lineup[0])!.species).toBe("emberback");
  expect(s.cards.some((c) => c.definitionId.startsWith("mossguard"))).toBe(false);
  await page.reload();
  await resume(page);
  await page.locator(".app:not([inert]) [data-encounter]").click();
  expect((await state(page)).team[0]!.species).toBe("emberback");
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
