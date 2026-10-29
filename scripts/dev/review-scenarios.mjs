import { expect } from "@playwright/test";

export const SCENARIOS = [
  "chronora-battle",
  "chronora-boss",
  "chronora-restoration",
  "chronora-collection",
  "memento-baseline",
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
  "cavalleaf-battle",
  "cavalleaf-no-backup",
  "cavalleaf-collection",
  "cavalleaf-rank-five",
  "brumalyn-battle",
  "brumalyn-collection",
  "brumalyn-rank-five",
  "brumalyn-targeting",
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
  "seven-boons-1",
  "seven-boons-2",
  "seven-boons-3",
  "oasis-battle",
  "hearth-boons-1",
  "hearth-boons-2",
  "hearth-boons-3",
  "hearth-boons-4",
  "chromatic-boons-1",
  "chromatic-boons-2",
  "chromatic-boons-3",
  "chromatic-boons-4",
  "journey-boons-1",
  "journey-boons-2",
  "journey-boons-3",
  "journey-boons-4",
  "acrobat-ready",
  "acrobat-boons-1",
  "acrobat-boons-2",
  "acrobat-boons-3",
  "acrobat-boons-4",
  "orchard-boons-1",
  "orchard-boons-2",
  "orchard-boons-3",
  "orchard-boons-4",
  "seal-boons-1",
  "seal-boons-2",
  "seal-boons-3",
  "seal-boons-4",
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
  "enchanted-boons-1",
  "enchanted-boons-2",
  "enchanted-boons-3",
  "enchanted-boons-4",
  "enchanted-ready",
  "merchant-bargain",
  "merchant-bargain-unavailable",
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
  "wisterelle",
  "alpenglen",
  "aerostat",
  "cavalleaf",
  "brumalyn",
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
  const { run, winBattle, fullRosterReward, merchantDestination, accept, bossReward } =
    await server.ssrLoadModule("/tests/support/game.ts");
  const { encodeSave, decodeSave } = await server.ssrLoadModule("/src/game/save.ts");
  let game = name.startsWith("merchant")
    ? merchantDestination(name.startsWith("merchant-bargain") ? ["bargain-scales"] : [])
    : ["recruit", "recruit-replacement", "recruit-team-preview", "battle-rewards"].includes(name)
      ? winBattle()
      : run();
  if (["recruit-replacement", "recruit-team-preview"].includes(name)) {
    game = fullRosterReward();
  }
  if (name.startsWith("merchant")) game = accept(game, { type: "enterSupport", visit: game.support.id });
  if (name === "merchant-unavailable" || name === "merchant-bargain-unavailable")
    game = { ...game, currency: 0 };
  if (name === "boon") game = bossReward();
  if (name === "team-selection-pause") {
    const { createGame } = await server.ssrLoadModule("/src/game/engine.ts");
    const { BOONS } = await server.ssrLoadModule("/src/game/content.ts");
    const initial = createGame(7);
    game = accept(accept(initial, { type: "draft", species: initial.starterOffers[0] }), { type: "start" });
    game = { ...game, boons: [BOONS[0].id] };
  }
  if (name.startsWith("enchanted-boons-")) {
    const groups = [
      ["sandfold-parasol", "ribbon-spool", "dawn-key"],
      ["crystal-slipper", "moonseed", "bargain-scales"],
      ["dragons-toothpick", "sleepy-acorn", "cuckoo-whistle"],
      ["nightbloom-bell"],
    ];
    game = bossReward();
    game = { ...game, reward: { ...game.reward, boons: groups[Number(name.at(-1)) - 1] } };
  }
  if (name === "enchanted-ready") {
    game = structuredClone(game);
    game.boons = ["ribbon-spool", "moonseed", "dragons-toothpick", "sleepy-acorn"];
    game.team[0].combat.moonseedReady = true;
    game.team[0].combat.toothpickReady = true;
    game.team[1].combat.cooldown = 2;
    game.team[0].combat.controlled = "freeze";
    game.team[0].combat.controlTurns = 1;
    const { setHand } = await server.ssrLoadModule("/tests/support/cards.ts");
    setHand(game, ["mossguard-heal", "mossguard-attack"]);
    game.team[0].health -= 4;
  }
  if (name === "acrobat-ready") {
    game = structuredClone(game);
    game.boons = ["acrobat-top"];
    game.team[0].combat.acrobatReady = true;
  }
  if (name.startsWith("acrobat-boons-")) {
    const groups = [
      ["ember-platter", "ash-bowl", "mossball"],
      ["skyiron-horseshoe", "nebula-weld-clamp", "clover-measuring-scoop"],
      ["treaty-teapot", "dawn-gong", "acrobat-top"],
      ["remembrance-wreath"],
    ];
    game = bossReward();
    game = { ...game, reward: { ...game.reward, boons: groups[Number(name.at(-1)) - 1] } };
  }
  if (name.startsWith("orchard-boons-")) {
    const groups = [
      ["orchard-ladder-charm", "spore-trivet", "victory-laurel"],
      ["gilt-gauntlet", "pumice-glass-inkwell", "chime-crucible"],
      ["crystal-harp", "orbit-tongs", "memory-cairn"],
      ["vow-candle"],
    ];
    game = bossReward();
    game = { ...game, reward: { ...game.reward, boons: groups[Number(name.at(-1)) - 1] } };
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
  if (name.startsWith("seven-boons-")) {
    const groups = [
      ["caravan-rug", "folded-mountain", "apple-press"],
      ["pollen-basket", "farewell-oar", "oasis-seed"],
      ["cypress-reliquary"],
    ];
    game = bossReward();
    game = { ...game, reward: { ...game.reward, boons: groups[Number(name.at(-1)) - 1] } };
  }
  if (name.startsWith("hearth-boons-")) {
    const groups = [
      ["quiet-pinwheel", "lagoon-chalice", "acorn-skittle"],
      ["wonder-kaleidoscope", "welcome-doormat", "shelter-lantern"],
      ["chestnut-roaster", "chamomile-compress", "cadence-panpipes"],
      ["hearthcap-kettle"],
    ];
    game = bossReward();
    game = { ...game, reward: { ...game.reward, boons: groups[Number(name.at(-1)) - 1] } };
  }
  if (name.startsWith("chromatic-boons-")) {
    const groups = [
      ["bellows-heart", "leafwing-shuttlecock", "soot-brush"],
      ["echo-ocarina", "glassleaf-shield", "harvest-shears"],
      ["frostglass-die", "reef-diadem", "chromatic-viol"],
      ["mirror-locket"],
    ];
    game = bossReward();
    game = { ...game, reward: { ...game.reward, boons: groups[Number(name.at(-1)) - 1] } };
  }
  if (name.startsWith("journey-boons-")) {
    const groups = [
      ["overflow-cup", "ripple-mirror", "sail-needle"],
      ["rootspool", "winterseed", "moonpath-divider"],
      ["cornucopia", "suncrust-rolling-pin", "dandelion-poultice"],
      ["dew-pendulum"],
    ];
    game = bossReward();
    game = { ...game, reward: { ...game.reward, boons: groups[Number(name.at(-1)) - 1] } };
  }
  if (name.startsWith("seal-boons-")) {
    const groups = [
      ["vanishing-hat", "rocking-chair-charm", "asteroid-hammer"],
      ["snowbell", "harvest-sickle", "meadow-mortar"],
      ["rosewax-seal", "solstice-concertina", "crown-waffle-iron"],
      ["beeswax-crown"],
    ];
    game = bossReward();
    game = { ...game, reward: { ...game.reward, boons: groups[Number(name.at(-1)) - 1] } };
  }
  if (name === "inspection") game = winBattle();
  if (name === "memento-baseline") {
    const { teamRun } = await server.ssrLoadModule("/tests/support/game.ts");
    const { produce } = await server.ssrLoadModule("immer");
    const { summonEcho } = await server.ssrLoadModule("/src/game/combat/legendary.ts");
    game = produce(teamRun(42, ["memento"]), (draft) => {
      summonEcho(draft, draft.team[0], "player", 6, []);
      summonEcho(draft, draft.team[0], "player", 6, []);
    });
  }
  if (name.startsWith("chronora-")) {
    const { teamRun, authoredPack, prepareDestination } =
      await server.ssrLoadModule("/tests/support/game.ts");
    const { produce } = await server.ssrLoadModule("immer");
    if (name === "chronora-boss") {
      game = produce(run(), (draft) => {
        draft.encounter = 7;
        draft.expedition = { pack: authoredPack(7), recruit: null, lastRoom: "boss" };
        prepareDestination(draft);
        draft.journey.victories = 7;
      });
      game = accept(game, { type: "beginBattle" });
    } else {
      game = teamRun(42, ["chronora"]);
      if (name === "chronora-restoration") {
        const { setHand } = await server.ssrLoadModule("/tests/support/cards.ts");
        game = produce(game, (draft) => {
          draft.team[0].health = 50;
          draft.battle.minions[0].health = 0;
          setHand(draft, ["chronora-bridge-rewind", "chronora-borrowed-moment", "chronora-pendulum-break"]);
        });
      }
    }
  }
  if (name === "oasis-battle") {
    game = structuredClone(game);
    game.boons = ["oasis-seed"];
    game.team[0].combat.oasisLeech = true;
  }
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
    if (name === "cavalleaf-no-backup") game = { ...game, reserves: [] };
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
  if (
    (creatureFixtures.includes(creature) || creature === "chronora") &&
    (view === "collection" || view === "rank-five")
  ) {
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
  if (scenario.name === "brumalyn-targeting")
    await page.locator('.hand [data-card-id="ally-0:brumalyn-rime-pounce"]').click();
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
    await expect(page.getByRole("heading", { name: "Choose a Recruit", exact: true })).toBeVisible();
    if (["recruit-replacement", "recruit-team-preview"].includes(scenario.name)) {
      await page.getByRole("button", { name: "Recruit Emberback", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Replace a creature", exact: true })).toBeVisible();
      if (scenario.name === "recruit-team-preview")
        await page.locator(".recruit-team-roster .creature-card").first().hover();
    }
  }
  if (scenario.name === "journey-results") {
    await button("Open menu").click();
    await button("End journey").click();
    await expect(page.getByRole("heading", { name: "Returned home", exact: true })).toBeVisible();
  }
  if (scenario.name === "inspection") {
    await page.locator(".recruit-options .creature-card").first().click({ button: "right" });
    await expect(page.locator(".inspection")).toBeVisible();
  }
  if (scenario.name === "battle-rewards") await expect(page.getByLabel("Last battle earnings")).toBeVisible();
  if (scenario.name.startsWith("merchant"))
    await expect(page.getByRole("region", { name: "Boon Merchant stock" })).toBeVisible();
}
