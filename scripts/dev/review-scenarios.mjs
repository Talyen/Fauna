import { expect } from "@playwright/test";

export const SCENARIOS = [
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
  "uncertain-targeting",
  "unknown-targeting",
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
  if (name.startsWith("pyrella-")) {
    const { pyrellaBattle } = await server.ssrLoadModule("/tests/support/pyrella.ts");
    game = pyrellaBattle();
    if (name === "pyrella-rank-five")
      game = {
        ...game,
        discovery: { ...game.discovery, recruited: { ...game.discovery.recruited, pyrella: 6 } },
      };
    if (name === "pyrella-decoy") {
      const card = game.cards.find((card) => card.definitionId === "pyrella-spark-decoy");
      game = accept(game, { type: "play", cardId: card.id, autoEndTurn: false });
    }
    if (name === "pyrella-spread") {
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
      const card = game.cards.find((card) => card.definitionId === "pyrella-festival-burst");
      game = accept(game, { type: "play", cardId: card.id, autoEndTurn: false });
    }
  }
  if (name.startsWith("alpenglen-")) {
    const { alpenglenBattle } = await server.ssrLoadModule("/tests/support/alpenglen.ts");
    game = alpenglenBattle(name === "alpenglen-rank-five" ? 5 : 0);
  }
  if (name.startsWith("wisterelle-")) {
    const { wisterelleBattle } = await server.ssrLoadModule("/tests/support/wisterelle.ts");
    game = wisterelleBattle();
    if (name === "wisterelle-rank-five")
      game = {
        ...game,
        discovery: { ...game.discovery, recruited: { ...game.discovery.recruited, wisterelle: 6 } },
      };
  }
  if (name.startsWith("aerostat-")) {
    const { aerostatBattle } = await server.ssrLoadModule("/tests/support/aerostat.ts");
    game = aerostatBattle(name === "aerostat-rank-five" ? 5 : 0);
  }
  if (name.startsWith("skybex-")) {
    const { skybexBattle } = await server.ssrLoadModule("/tests/support/skybex.ts");
    game = skybexBattle();
    if (name === "skybex-rank-five")
      game = {
        ...game,
        discovery: { ...game.discovery, recruited: { ...game.discovery.recruited, skybex: 6 } },
      };
    if (name === "skybex-incoming") {
      const card = game.cards.find((card) => card.definitionId === "skybex-cloudstep");
      game = accept(game, { type: "play", cardId: card.id, autoEndTurn: false });
    }
  }
  if (name.startsWith("arabesca-")) {
    const { arabescaBattle } = await server.ssrLoadModule("/tests/support/arabesca.ts");
    game = arabescaBattle();
    if (name === "arabesca-rank-five")
      game = {
        ...game,
        discovery: { ...game.discovery, recruited: { ...game.discovery.recruited, arabesca: 6 } },
      };
    if (name === "arabesca-double") {
      const card = game.cards.find((card) => card.definitionId === "arabesca-dancing-double");
      game = accept(game, { type: "play", cardId: card.id, autoEndTurn: false });
    }
  }
  if (name.startsWith("parhelion-")) {
    const { parhelionBattle } = await server.ssrLoadModule("/tests/support/parhelion.ts");
    game = parhelionBattle();
    if (name === "parhelion-rank-five")
      game = {
        ...game,
        discovery: { ...game.discovery, recruited: { ...game.discovery.recruited, parhelion: 6 } },
      };
  }
  if (name.startsWith("oathara-")) {
    const { oatharaBattle } = await server.ssrLoadModule("/tests/support/oathara.ts");
    game = oatharaBattle();
  }
  if (name.startsWith("almanelle-")) {
    const { almanelleBattle } = await server.ssrLoadModule("/tests/support/almanelle.ts");
    game = almanelleBattle();
    if (name === "almanelle-rank-five")
      game = {
        ...game,
        discovery: { ...game.discovery, recruited: { ...game.discovery.recruited, almanelle: 6 } },
      };
  }
  if (name.startsWith("orifable-")) {
    const { orifableBattle } = await server.ssrLoadModule("/tests/support/orifable.ts");
    game = orifableBattle(["orifable-food", "orifable-targeting"].includes(name));
    if (name === "orifable-rank-five")
      game = {
        ...game,
        discovery: { ...game.discovery, recruited: { ...game.discovery.recruited, orifable: 6 } },
      };
  }
  if (["uncertain-targeting", "unknown-targeting"].includes(name)) {
    const { uncertainBattle } = await server.ssrLoadModule("/tests/support/uncertainty.ts");
    game = uncertainBattle(name === "unknown-targeting");
  }
  if (name.startsWith("dulcera-")) {
    const { dulceraBattle } = await server.ssrLoadModule("/tests/support/dulcera.ts");
    game = dulceraBattle();
    if (name === "dulcera-rank-five")
      game = {
        ...game,
        discovery: { ...game.discovery, recruited: { ...game.discovery.recruited, dulcera: 6 } },
      };
  }
  const save = encodeSave(game);
  decodeSave(save);
  return {
    name,
    save,
    seed: name.startsWith("merchant") ? 7 : 42,
    fixture: name.startsWith("wisterelle-")
      ? "tests/support/wisterelle.ts"
      : name.startsWith("alpenglen-")
        ? "tests/support/alpenglen.ts"
        : name.startsWith("aerostat-")
          ? "tests/support/aerostat.ts"
          : name.startsWith("parhelion-")
            ? "tests/support/parhelion.ts"
            : name.startsWith("dulcera-")
              ? "tests/support/dulcera.ts"
              : name.startsWith("pyrella-")
                ? "tests/support/pyrella.ts"
                : name.startsWith("skybex-")
                  ? "tests/support/skybex.ts"
                  : name.startsWith("arabesca-")
                    ? "tests/support/arabesca.ts"
                    : name.startsWith("orifable-")
                      ? "tests/support/orifable.ts"
                      : name.startsWith("almanelle-")
                        ? "tests/support/almanelle.ts"
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
  if (["wisterelle-collection", "wisterelle-rank-five"].includes(scenario.name)) {
    await button("Collection").click();
    const opener = button("Inspect Wisterelle");
    const next = button("Next page");
    for (let index = 0; index < 32 && !(await opener.count()) && (await next.isEnabled()); index++)
      await next.click();
    await opener.click();
  } else if (["alpenglen-collection", "alpenglen-rank-five"].includes(scenario.name)) {
    await button("Collection").click();
    const opener = button("Inspect Alpenglen");
    const next = button("Next page");
    for (let index = 0; index < 32 && !(await opener.count()) && (await next.isEnabled()); index++)
      await next.click();
    await opener.click();
  } else if (["aerostat-collection", "aerostat-rank-five"].includes(scenario.name)) {
    await button("Collection").click();
    const opener = button("Inspect Aerostat");
    const next = button("Next page");
    for (let index = 0; index < 32 && !(await opener.count()) && (await next.isEnabled()); index++)
      await next.click();
    await opener.click();
  } else if (["pyrella-collection", "pyrella-rank-five"].includes(scenario.name)) {
    await button("Collection").click();
    const next = page.getByRole("button", { name: "Next page", exact: true });
    while (
      !(await page.getByRole("button", { name: "Inspect Pyrella", exact: true }).count()) &&
      (await next.isVisible())
    )
      await next.click();
    await button("Inspect Pyrella").click();
  } else if (["parhelion-collection", "parhelion-rank-five"].includes(scenario.name)) {
    await button("Collection").click();
    await button("Inspect Parhelion").click();
  } else if (["dulcera-collection", "dulcera-rank-five"].includes(scenario.name)) {
    await button("Collection").click();
    const opener = button("Inspect Dulcera");
    const next = button("Next page");
    for (let index = 0; index < 32 && !(await opener.count()) && (await next.isEnabled()); index++)
      await next.click();
    await opener.click();
  } else if (["skybex-collection", "skybex-rank-five"].includes(scenario.name)) {
    await button("Collection").click();
    const next = page.getByRole("button", { name: "Next page", exact: true });
    while (
      !(await page.getByRole("button", { name: "Inspect Skybex", exact: true }).count()) &&
      (await next.isVisible())
    )
      await next.click();
    await button("Inspect Skybex").click();
  } else if (["arabesca-collection", "arabesca-rank-five"].includes(scenario.name)) {
    await button("Collection").click();
    const next = page.getByRole("button", { name: "Next page", exact: true });
    while (
      !(await page.getByRole("button", { name: "Inspect Arabesca", exact: true }).count()) &&
      (await next.isVisible())
    )
      await next.click();
    await button("Inspect Arabesca").click();
  } else if (["orifable-collection", "orifable-rank-five"].includes(scenario.name)) {
    await button("Collection").click();
    await button("Inspect Orifable").click();
  } else if (["almanelle-collection", "almanelle-rank-five"].includes(scenario.name)) {
    await button("Collection").click();
    await button("Inspect Almanelle").click();
  } else if (scenario.name === "oathara-collection") {
    await button("Collection").click();
    await button("Inspect Oathara").click();
  } else if (["settings", "collection", "talents", "glossary"].includes(menu)) {
    await button(menu[0].toUpperCase() + menu.slice(1)).click();
  } else if (scenario.name !== "home") {
    await button("Continue").click();
    if (scenario.name === "pause") await button("Open menu").click();
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
