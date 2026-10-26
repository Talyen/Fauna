import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { run, winBattle } from "../support/game";
import { test, seed, resume } from "./support/session";
import { settleScreen } from "./support/rendered-evidence";
import { continueToRecruit } from "./support/journey";

async function scan(page: Page, name: string) {
  await settleScreen(page);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  // Layout journeys own successful screen captures; retain actionable axe evidence on failure.
  if (results.violations.length)
    await test.info().attach(`${name}-accessibility.json`, {
      body: JSON.stringify(results.violations, null, 2),
      contentType: "application/json",
    });
  expect(results.violations, `${name}: automated accessibility violations`).toEqual([]);
}

test("home, settings, battle, pause and rewards meet automated accessibility checks", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seed(page, run());
  await scan(page, "home");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  for (const name of ["Display", "Sound", "Battle"]) {
    await page.getByRole("tab", { name, exact: true }).click();
    await scan(page, `settings-${name.toLowerCase()}`);
  }
  await page.keyboard.press("Escape");
  await resume(page);
  await expect(page.getByRole("main", { name: "Battlefield" })).toBeVisible();
  await scan(page, "battle");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("dialog", { name: "Pause menu" })).toBeVisible();
  await scan(page, "pause");
  await page.keyboard.press("Escape");
  await seed(page, winBattle());
  await resume(page);
  await scan(page, "battle-rewards");
  await continueToRecruit(page);
  await expect(page.getByRole("heading", { name: "Choose a Recruit", exact: true })).toBeVisible();
  await scan(page, "recruit");
});
