import { freshCombat } from "../../src/game/combat/index";
import { expect } from "@playwright/test";
import { produce } from "immer";
import { accept, policy, winBattle } from "../support/game";
import { test, seed, resume } from "./support/session";
import { fits } from "./support/layout";

test("five-card hand with hidden overflow, three enemies and a full bench preserve fit and original artwork ratios", async ({
  page,
}) => {
  let s = winBattle();
  while (s.phase !== "teamSelection") s = accept(s, policy(s));
  s = produce(s, (d) => {
    d.boons = ["tattered-pages"];
    d.wins = 1;
    d.roster = ["mossguard", "emberback", "prismram", "pollenmoth", "emberback"];
    d.reserves = ["pollenmoth", "emberback"].map((kind) => ({
      id: `recruit-${kind}`,
      species: kind as "pollenmoth" | "emberback",
      health: 20,
      block: 0,
      combat: freshCombat(),
      attacked: false,
    }));
  });
  await seed(page, s);
  await resume(page);
  await fits(page);
  await page.locator(".app:not([inert]) [data-encounter]").click();
  await expect(page.locator(".app:not([inert]) .hand .action-card")).toHaveCount(5);
  await expect(page.locator(".app:not([inert]) .enemy-row .creature-card")).toHaveCount(3);
  await fits(page);
  for (const card of await page.locator(".app:not([inert]) .hand .action-card").all()) {
    await card.focus();
    const size = await card.evaluate((el: HTMLElement) => ({
      width: el.offsetWidth,
      height: el.offsetHeight,
    }));
    expect(Math.abs(size.width / size.height - 3 / 4)).toBeLessThan(0.01);
    await expect(card.locator("img")).toHaveCSS("object-fit", "contain");
  }
});
