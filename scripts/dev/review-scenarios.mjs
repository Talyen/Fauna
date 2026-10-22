import { expect } from "@playwright/test";

export const SCENARIOS = [
  "home",
  "settings",
  "collection",
  "battle",
  "pause",
  "recruit",
  "merchant",
  "merchant-unavailable",
];

/** Reuse the same current-format gameplay fixtures as browser regressions. */
export async function reviewScenario(server, name) {
  if (!SCENARIOS.includes(name))
    throw new Error(`Unknown scenario: ${name}. Choose ${SCENARIOS.join(", ")}.`);
  const { run, winBattle, merchantDestination, accept } =
    await server.ssrLoadModule("/tests/support/game.ts");
  const { encodeSave, decodeSave } = await server.ssrLoadModule("/src/game/save.ts");
  let game = name.startsWith("merchant") ? merchantDestination() : name === "recruit" ? winBattle() : run();
  if (name.startsWith("merchant")) game = accept(game, { type: "enterSupport", visit: game.support.id });
  if (name === "merchant-unavailable") game = { ...game, currency: 0 };
  const save = encodeSave(game);
  decodeSave(save);
  return { name, save, seed: name.startsWith("merchant") ? 7 : 42, fixture: "tests/support/game.ts" };
}

export async function openReviewScenario(page, origin, scenario, scale) {
  await page.addInitScript(
    ({ save, scale }) => {
      // Reloads retain committed interactions instead of restoring the original fixture.
      if (sessionStorage.getItem("fauna.review.seeded")) return;
      localStorage.setItem("fauna.save.v1", save);
      localStorage.setItem("fauna.text-scale", String(scale));
      sessionStorage.setItem("fauna.review.seeded", "1");
    },
    { save: scenario.save, scale },
  );
  await page.goto(origin);
  await expect(page.getByRole("navigation", { name: "Main menu" })).toBeVisible();
  const button = (name) => page.getByRole("button", { name, exact: true });
  if (["settings", "collection"].includes(scenario.name)) {
    await button(scenario.name === "settings" ? "Settings" : "Collection").click();
  } else if (scenario.name !== "home") {
    await button("Continue").click();
    if (scenario.name === "pause") await button("Open menu").click();
  }
  if (["battle", "pause"].includes(scenario.name))
    await expect(page.getByRole("main", { name: "Battlefield" })).toBeVisible();
  if (scenario.name === "recruit")
    await expect(page.getByRole("heading", { name: "Choose a Recruit", exact: true })).toBeVisible();
  if (scenario.name.startsWith("merchant"))
    await expect(page.getByRole("region", { name: "Boon Merchant stock" })).toBeVisible();
}
