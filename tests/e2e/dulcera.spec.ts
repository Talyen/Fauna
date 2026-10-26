import { expect } from "@playwright/test";
import { dulceraBattle } from "../support/dulcera";
import { test, seed, resume, state, reloadHome } from "./support/session";
import { captureScreen } from "./support/rendered-evidence";

test("Dulcera's abilities restore, protect and exchange the visible team with keyboard input", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("fauna.text-scale", "1.25"));
  await seed(page, dulceraBattle());
  await resume(page);

  const allies = page.getByRole("region", { name: "Player row" });
  const health = (id: string) =>
    allies.locator(`[data-actor-id="${id}"]`).getByRole("progressbar", { name: "Health", exact: true });
  const ability = (id: string) => page.locator(`.hand [data-card-id="ally-0:dulcera-${id}"]`);
  await ability("chapel-light").focus();
  await page.keyboard.press("Enter");
  await expect(health("ally-0")).toHaveAttribute("aria-valuenow", "23");
  await expect(page.getByRole("button", { name: "Mana 4 of 4", exact: true })).toBeVisible();

  await ability("meadow-shelter").focus();
  await page.keyboard.press("Enter");
  await expect(allies.getByLabel("Block 2", { exact: true })).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Mana 3 of 4", exact: true })).toBeVisible();

  await ability("hushed-waters").focus();
  await page.keyboard.press("Enter");
  await expect(allies.getByRole("button", { name: "Coralcurl", exact: true })).toBeVisible();
  await expect(allies.getByRole("button", { name: "Dulcera", exact: true })).toHaveCount(0);
  await expect(health("backup-coralcurl")).toHaveAttribute("aria-valuenow", "13");
  await expect(allies.getByRole("button", { name: /^(Poison|Freeze|Blind)/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mana 2 of 4", exact: true })).toBeVisible();
  await captureScreen(page, { path: "reports/dulcera/after-abilities.png" });

  const game = await state(page);
  await reloadHome(page);
  await resume(page);
  expect(await state(page)).toEqual(game);
  await expect(health("backup-coralcurl")).toHaveAttribute("aria-valuenow", "13");
});
