import { expect } from "@playwright/test";

export const SCENARIOS = [
  "home",
  "campfire",
  "boon",
  "journey-results",
  "death-door",
  "inspection",
  "settings",
  "collection",
  "battle",
  "pause",
  "recruit",
  "recruit-replacement",
  "recruit-team-preview",
  "battle-rewards",
  "merchant",
  "merchant-unavailable",
  "glossary",
  "talents",
  "talent-tree",
  "collection-creature",
  "collection-ranks",
  "settings-sound",
  "settings-battle",
  "draw-pile",
  "discard-pile",
];

/** Reuse the same current-format gameplay fixtures as browser regressions. */
export async function reviewScenario(server, name) {
  if (!SCENARIOS.includes(name))
    throw new Error(`Unknown scenario: ${name}. Choose ${SCENARIOS.join(", ")}.`);
  const { run, winBattle, merchantDestination, accept, bossReward } =
    await server.ssrLoadModule("/tests/support/game.ts");
  const { encodeSave, decodeSave } = await server.ssrLoadModule("/src/game/save.ts");
  let game = name.startsWith("merchant")
    ? merchantDestination()
    : ["recruit", "recruit-replacement", "recruit-team-preview", "battle-rewards"].includes(name)
      ? winBattle()
      : run();
  if (["recruit-replacement", "recruit-team-preview"].includes(name)) {
    const { species } = await server.ssrLoadModule("/src/game/content.ts");
    const reserves = ["pollenmoth", "prismram"].map((kind, index) => ({
      id: `review-reserve-${index}`,
      species: kind,
      health: species(kind).health,
      block: 0,
      attacked: false,
    }));
    game = {
      ...game,
      roster: [...game.roster, ...reserves.map((unit) => unit.species)],
      reserves,
      discovery: {
        ...game.discovery,
        recruited: { ...game.discovery.recruited, pollenmoth: 1 },
      },
    };
  }
  if (name.startsWith("merchant")) game = accept(game, { type: "enterSupport", visit: game.support.id });
  if (name === "merchant-unavailable") game = { ...game, currency: 0 };
  if (name === "boon") game = bossReward();
  if (name === "inspection") game = winBattle();
  if (name === "death-door")
    game = {
      ...game,
      team: game.team.map((unit, index) =>
        index ? unit : { ...unit, health: 1, combat: { ...unit.combat, deathDoorUsed: true, grace: 2 } },
      ),
    };
  if (name === "campfire") {
    game = merchantDestination();
    game = { ...game, team: game.team.map((unit, index) => (index ? unit : { ...unit, health: 1 })) };
    game = accept(game, { type: "visitCampfire" });
  }
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
  const menu = scenario.name === "talent-tree" ? "talents" : scenario.name.split("-")[0];
  if (["settings", "collection", "talents", "glossary"].includes(menu)) {
    await button(menu[0].toUpperCase() + menu.slice(1)).click();
  } else if (scenario.name !== "home") {
    await button("Continue").click();
    if (scenario.name === "pause") await button("Open menu").click();
  }
  if (["collection-creature", "collection-ranks"].includes(scenario.name)) {
    await button("Inspect Mossguard").click();
    await expect(page.getByRole("heading", { name: "Mossguard", exact: true })).toBeVisible();
    if (scenario.name === "collection-ranks")
      await page.getByRole("tab", { name: "Rank progression", exact: true }).click();
  }
  if (scenario.name === "talent-tree")
    await page.locator('.talents-screen button[aria-label$=" talents"]').first().click();
  if (["settings-sound", "settings-battle"].includes(scenario.name))
    await page
      .getByRole("tab", { name: scenario.name === "settings-sound" ? "Sound" : "Battle", exact: true })
      .click();
  if (["draw-pile", "discard-pile"].includes(scenario.name))
    await button(scenario.name === "draw-pile" ? "Inspect Draw Pile" : "Inspect Discard Pile").click();
  if (["battle", "pause"].includes(scenario.name))
    await expect(page.getByRole("main", { name: "Battlefield" })).toBeVisible();
  if (["recruit", "recruit-replacement", "recruit-team-preview"].includes(scenario.name)) {
    await page
      .locator(".battle-rewards-screen")
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await expect(page.getByRole("heading", { name: "Choose a Recruit", exact: true })).toBeVisible();
    if (["recruit-replacement", "recruit-team-preview"].includes(scenario.name)) {
      await page.getByRole("button", { name: "Recruit Emberback", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Choose your team", exact: true })).toBeVisible();
      if (scenario.name === "recruit-team-preview")
        await page.locator(".recruit-team-roster .creature-card").first().click();
    }
  }
  if (scenario.name === "journey-results") {
    await button("Open menu").click();
    await button("End journey").click();
    await expect(page.getByRole("heading", { name: "Returned home", exact: true })).toBeVisible();
  }
  if (scenario.name === "inspection") {
    await button("Continue").click();
    await page.locator(".recruit-options .creature-card").first().click();
    await expect(page.locator(".inspection")).toBeVisible();
  }
  if (scenario.name === "battle-rewards")
    await expect(page.getByRole("heading", { name: "Victory", exact: true })).toBeVisible();
  if (scenario.name.startsWith("merchant"))
    await expect(page.getByRole("region", { name: "Boon Merchant stock" })).toBeVisible();
}
