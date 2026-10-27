import { expect } from "@playwright/test";

export const SCENARIOS = [
  "ravelland-battle",
  "ravelland-collection",
  "ravelland-rank-five",
  "wisterelle-battle",
  "wisterelle-collection",
  "wisterelle-rank-five",
  "wisterelle-targeting",
  "alpenglen-battle",
  "alpenglen-collection",
  "alpenglen-rank-five",
  "aerostat-battle",
  "aerostat-collection",
  "aerostat-rank-five",
  "parhelion-battle",
  "parhelion-collection",
  "parhelion-rank-five",
  "parhelion-targeting",
  "dulcera-battle",
  "dulcera-collection",
  "dulcera-rank-five",
  "pyrella-battle",
  "pyrella-collection",
  "pyrella-rank-five",
  "pyrella-decoy",
  "pyrella-spread",
  "skybex-battle",
  "skybex-collection",
  "skybex-rank-five",
  "skybex-incoming",
  "arabesca-battle",
  "arabesca-collection",
  "arabesca-rank-five",
  "arabesca-double",
  "orifable-battle",
  "orifable-food",
  "orifable-targeting",
  "orifable-collection",
  "orifable-rank-five",
  "almanelle-battle",
  "almanelle-collection",
  "almanelle-rank-five",
  "almanelle-targeting",
  "oathara-battle",
  "oathara-collection",
  "oathara-resurrection",
  "home",
  "campfire",
  "boon",
  "new-boons-1",
  "new-boons-2",
  "new-boons-3",
  "new-boons-4",
  "journey-results",
  "death-door",
  "inspection",
  "settings",
  "collection",
  "battle",
  "nature-damage-targeting",
  "uncertain-targeting",
  "unknown-targeting",
  "pause",
  "team-selection-pause",
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
  "settings-sound",
  "settings-battle",
  "draw-pile",
  "discard-pile",
];

const creatureFixtures = [
  "ravelland",
  "wisterelle",
  "alpenglen",
  "aerostat",
  "parhelion",
  "dulcera",
  "pyrella",
  "skybex",
  "arabesca",
  "orifable",
  "almanelle",
  "oathara",
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
    const reserves = ["dunefox", "captoad"].map((kind, index) => ({
      id: `review-reserve-${index}`,
      species: kind,
      health: species(kind).health,
      block: 0,
      attacked: false,
    }));
    game = {
      ...game,

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
  if (name === "team-selection-pause") {
    const { createGame } = await server.ssrLoadModule("/src/game/engine.ts");
    const { BOONS } = await server.ssrLoadModule("/src/game/content.ts");
    const initial = createGame(7);
    game = accept(accept(initial, { type: "draft", species: initial.starterOffers[0] }), { type: "start" });
    game = { ...game, boons: [BOONS[0].id] };
  }
  if (name.startsWith("new-boons-")) {
    const groups = [
      ["reef-incense-tile", "lava-cameo", "velvet-whisk"],
      ["paper-lotus", "origami-staircase", "wax-foundation-mold"],
      ["eclipse-rivet", "poppy-seed-grinder", "peace-knot"],
      ["coral-music-box", "tidecrest-hairpin", "moonboat-toy"],
    ];
    game = bossReward();
    game = { ...game, reward: { ...game.reward, boons: groups[Number(name.at(-1)) - 1] } };
  }
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
  const creature = name.split("-")[0];
  if (creatureFixtures.includes(creature)) {
    const fixture = await server.ssrLoadModule(`/tests/support/${creature}.ts`);
    const rankFive = name === `${creature}-rank-five`;
    const argument = ["alpenglen", "aerostat"].includes(creature)
      ? rankFive
        ? 5
        : 0
      : creature === "orifable"
        ? ["orifable-food", "orifable-targeting"].includes(name)
        : undefined;
    game = argument === undefined ? fixture[`${creature}Battle`]() : fixture[`${creature}Battle`](argument);
    if (rankFive && !["alpenglen", "aerostat"].includes(creature))
      game = {
        ...game,
        discovery: { ...game.discovery, recruited: { ...game.discovery.recruited, [creature]: 6 } },
      };
    if (name === "pyrella-spread")
      game = {
        ...game,
        battle: {
          ...game.battle,
          enemies: game.battle.enemies.map((enemy, index) =>
            index
              ? enemy
              : {
                  ...enemy,
                  health: 1,
                  combat: { ...enemy.combat, burn: 20, controlled: "stun", controlTurns: 1 },
                },
          ),
        },
      };
    const playedCard = {
      "pyrella-decoy": "pyrella-spark-decoy",
      "pyrella-spread": "pyrella-festival-burst",
      "skybex-incoming": "skybex-cloudstep",
      "arabesca-double": "arabesca-dancing-double",
    }[name];
    if (playedCard) {
      const card = game.cards.find((card) => card.definitionId === playedCard);
      game = accept(game, { type: "play", cardId: card.id, autoEndTurn: false });
    }
  }
  if (["uncertain-targeting", "unknown-targeting"].includes(name)) {
    const { uncertainBattle } = await server.ssrLoadModule("/tests/support/uncertainty.ts");
    game = uncertainBattle(name === "unknown-targeting");
  }
  if (name === "nature-damage-targeting") {
    const { teamRun } = await server.ssrLoadModule("/tests/support/game.ts");
    const { setHand } = await server.ssrLoadModule("/tests/support/cards.ts");
    game = structuredClone(teamRun(42, ["reedstag", "emberback", "prismram"]));
    setHand(game, ["reedstag-attack"]);
    game.battle.enemies[0].combat.thorns = 3;
    game.battle.enemies[0].combat.controlled = "stun";
    game.battle.enemies[0].combat.controlTurns = 1;
  }
  const save = encodeSave(game);
  decodeSave(save);
  return {
    name,
    save,
    seed: name.startsWith("merchant") || name === "team-selection-pause" ? 7 : 42,
    fixture: creatureFixtures.includes(creature)
      ? `tests/support/${creature}.ts`
      : ["uncertain-targeting", "unknown-targeting"].includes(name)
        ? "tests/support/uncertainty.ts"
        : "tests/support/game.ts",
  };
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
  await expect(page.getByRole("navigation", { name: "Main menu" })).toBeVisible({ timeout: 30000 });
  await expect(page.locator("#startup-splash")).toHaveCount(0);
  const button = (name) => page.getByRole("button", { name, exact: true });
  const menu = scenario.name === "talent-tree" ? "talents" : scenario.name.split("-")[0];
  const [creature, view] = scenario.name.split(/-(.+)/);
  if (creatureFixtures.includes(creature) && (view === "collection" || view === "rank-five")) {
    await button("Collection").click();
    const opener = button(`Inspect ${creature[0].toUpperCase() + creature.slice(1)}`);
    const next = button("Next page");
    for (let index = 0; index < 32 && !(await opener.count()) && (await next.isEnabled()); index++)
      await next.click();
    await opener.click();
  } else if (["settings", "collection", "talents", "glossary"].includes(menu)) {
    await button(menu[0].toUpperCase() + menu.slice(1)).click();
  } else if (scenario.name !== "home") {
    await button("Continue").click();
    if (["pause", "team-selection-pause"].includes(scenario.name)) await button("Open menu").click();
  }
  if (scenario.name === "parhelion-targeting")
    await page.locator('.hand [data-card-id="ally-0:parhelion-whiteout-waltz"]').click();
  if (scenario.name === "orifable-targeting") {
    await page.locator('.hand [aria-label^="Apple,"]').click();
  }
  if (["uncertain-targeting", "unknown-targeting"].includes(scenario.name)) {
    await page.locator(".hand .action-card").first().focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".target-preview .combat-stats").first()).toBeVisible();
  }
  if (scenario.name === "nature-damage-targeting") {
    await page.locator('.hand [data-card-id$="reedstag-attack"]').focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Target Emberback", exact: true })).toBeFocused();
    await expect(page.locator('.target-preview [data-damage-type="nature"]').first()).toBeVisible();
  }
  if (scenario.name === "oathara-resurrection") {
    await page.locator('.hand [data-card-id="ally-0:oathara-vow-of-return"]').click();
  }
  if (scenario.name === "almanelle-targeting")
    await page.locator('.hand [data-card-id="ally-0:almanelle-autumn-insight"]').click();
  if (scenario.name === "wisterelle-targeting") {
    await page.locator('.hand [data-card-id$="wisterelle-forgotten-junction"]').click();
  }
  if (scenario.name === "collection-creature") {
    await button("Inspect Mossguard").click();
    await expect(page.getByRole("heading", { name: "Mossguard", exact: true })).toBeVisible();
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
  if (scenario.name === "team-selection-pause") {
    await expect(page.getByRole("dialog", { name: "Pause menu" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Pause menu" })).toHaveCount(0);
    await expect(button("Open menu")).toBeFocused();
    await button("Open menu").click();
    await expect(page.getByRole("dialog", { name: "Pause menu" })).toBeVisible();
  }
  if (["recruit", "recruit-replacement", "recruit-team-preview"].includes(scenario.name)) {
    await page
      .locator(".battle-rewards-screen")
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await expect(page.getByRole("heading", { name: "Choose a Recruit", exact: true })).toBeVisible();
    if (["recruit-replacement", "recruit-team-preview"].includes(scenario.name)) {
      await page.getByRole("button", { name: "Recruit Pollenmoth", exact: true }).click();
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
