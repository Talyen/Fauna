import { setBattleCards } from "../../support/cards";
import { expect, it } from "vitest";
import { createBattleActor } from "../../../src/application/battle-actor";
import { rankedBattleChoices } from "../../../src/application/battle-policy";
import { ordinaryAttackFacts } from "../../../src/game/ability-facts";
import { commandPhases } from "../../../src/game/command-phases";
import { definition } from "../../../src/game/content";
import { contentCatalog, validateCatalog } from "../../../src/game/content-validation";
import { createGame, dispatch } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { requireBattle, run, teamRun } from "../../support/game";

function attack(id = "mossguard-attack") {
  const def = definition(id);
  if (def.effect !== "attack") throw new Error("Expected an attack");
  return def;
}
function handOnly(state: ReturnType<typeof requireBattle>, definitionId: string) {
  const card = state.cards.find((entry) => entry.definitionId === definitionId)!;
  setBattleCards(state, [card.id]);
  return card;
}

it("01: ordinary-hit rankings round fractional Physical bonuses before critical multiplication", () => {
  const state = requireBattle(structuredClone(run()));
  state.talents = ["physical.shield-slam"];
  const actor = state.team[0]!;
  actor.block = 1;
  const enemy = state.battle.enemies[0]!;
  enemy.health = 2;
  enemy.block = 0;
  enemy.combat.armor = 0;
  const [fact] = ordinaryAttackFacts(state, actor, { ...attack(), damageType: "physical" }, 1, enemy);
  expect(fact?.lost).toBe(2);
  expect(fact?.lethal).toBe(true);
});

it("02: Crater Punch includes blocked Light critical damage in its Health estimate", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["alpenglen"])));
  const def = attack("alpenglen-last-light-charge");
  handOnly(state, def.id);
  state.boons = ["crater-punch"];
  const enemy = state.battle.enemies[0]!;
  enemy.block = 100;
  const [fact] = ordinaryAttackFacts(state, state.team[0]!, def, 4, enemy);
  expect(fact?.lost).toBe(4);
  expect(fact?.lethal).toBe(false);
});

it("03: a Freeze-damage ward prevents the forecast from spending Block", () => {
  const state = requireBattle(structuredClone(run()));
  const enemy = state.battle.enemies[0]!;
  enemy.combat.nullifyFreeze = true;
  enemy.block = 4;
  const [fact] = ordinaryAttackFacts(state, state.team[0]!, { ...attack(), damageType: "freeze" }, 4, enemy);
  expect(fact?.lost).toBe(0);
  expect(fact?.blocked).toBe(0);
});

it("04: Auto-play can trigger Last Warmth with an already-pending repeat grant", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["alpenglen"])));
  const card = handOnly(state, "alpenglen-ember-of-evening");
  state.team[0]!.health -= 5;
  state.battle.repeatNext.player = true;
  const choices = rankedBattleChoices(state, false);
  expect(choices.some((choice) => choice.command.type === "play" && choice.command.cardId === card.id)).toBe(
    true,
  );
  const result = dispatch(state, { type: "play", cardId: card.id, autoEndTurn: false });
  expect(result.state.team[0]!.health).toBeGreaterThan(state.team[0]!.health);
});

it("05: a Mana-neutral Ember Harvest still has its useful Burn draw", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["pyrella"])));
  const card = handOnly(state, "pyrella-ember-harvest");
  expect(
    rankedBattleChoices(state, false).some(
      (choice) => choice.command.type === "play" && choice.command.cardId === card.id,
    ),
  ).toBe(true);
  const result = dispatch(state, { type: "play", cardId: card.id, autoEndTurn: false });
  expect(result.state.battle!.mana).toBe(state.battle.mana);
  expect(result.state.battle!.hand.length).toBeGreaterThan(0);
});

it("06: a different checkpoint at the same revision cannot reuse a stale command", () => {
  const state = requireBattle(structuredClone(run()));
  const actor = createBattleActor();
  expect(actor.choose(state, false).command.type).toBe("play");
  const other = structuredClone(state);
  other.battle.mana = 0;
  expect(actor.choose(other, false).command).toEqual({ type: "endTurn" });
});

it("07: a returned decision cannot mutate the actor's cached command", () => {
  const state = run();
  const actor = createBattleActor();
  const selected = actor.choose(state, false);
  const original = structuredClone(selected);
  expect(Reflect.set(selected.command, "type", "endTurn")).toBe(false);
  expect(actor.choose(state, false)).toEqual(original);
});

it("08: shared command admission phases reject mutation", () => {
  const phases = commandPhases.play;
  const phase = phases[0];
  const changedEntry = Reflect.set(phases, "0", "draft");
  if (changedEntry) Reflect.set(phases, "0", phase);
  const changedCatalog = Reflect.set(commandPhases, "play", ["draft"]);
  if (changedCatalog) Reflect.set(commandPhases, "play", phases);
  expect(changedEntry).toBe(false);
  expect(changedCatalog).toBe(false);
});

it("09: default audit catalog membership rejects mutation", () => {
  const cards = contentCatalog.cards;
  const card = cards[0];
  const changedEntry = Reflect.set(cards, "0", cards[1]);
  if (changedEntry) Reflect.set(cards, "0", card);
  const changedCatalog = Reflect.set(contentCatalog, "cards", []);
  if (changedCatalog) Reflect.set(contentCatalog, "cards", cards);
  expect(changedEntry).toBe(false);
  expect(changedCatalog).toBe(false);
  expect(validateCatalog().filter((issue) => issue.severity === "error")).toEqual([]);
});

it("10: save admission uses the same UTF-8 byte limit as native persistence", () => {
  const raw = JSON.stringify({ ...createGame(3), padding: "é".repeat(60_000) });
  expect(raw.length).toBeLessThan(100_000);
  expect(new TextEncoder().encode(raw).length).toBeGreaterThan(100_000);
  expect(() => decodeSave(raw)).toThrow("supported size");
  expect(decodeSave(encodeSave(createGame(3)))).toEqual(createGame(3));
});

type Catalog = typeof contentCatalog;
const corruptions: [string, string, (catalog: Catalog) => void][] = [
  [
    "11: unknown supplemental rules produce audit findings instead of crashing",
    "effects",
    (catalog) => {
      Object.assign(catalog.cards[0]!, { effects: [{ kind: "unknown", amount: 1 }] });
    },
  ],
  [
    "12: blank ability names cannot become unnamed playable cards",
    "name",
    (catalog) => {
      catalog.cards[0]!.name = " ";
    },
  ],
  [
    "13: unsupported primary targets cannot silently change manual targeting",
    "target",
    (catalog) => {
      Object.assign(catalog.cards[0]!, { target: "enemy" });
    },
  ],
  [
    "14: neutral Food cannot advertise an attack that its resolver never executes",
    "species",
    (catalog) => {
      Object.assign(
        catalog.cards.find((card) => card.species === null)!,
        { effect: "attack", damageType: "physical" },
      );
    },
  ],
  [
    "15: permanent creature kits cannot consume a slot required by save validation",
    "consume",
    (catalog) => {
      catalog.cards[0]!.consume = true;
    },
  ],
  [
    "16: chance passives cannot silently saturate beyond one hundred percent",
    "passiveTiers",
    (catalog) => {
      Object.assign(catalog.species[0]!.passiveTiers[0].effects[0]!, { kind: "encore", amount: 101 });
    },
  ],
  [
    "17: Block conversion cannot subtract more Block than it grants",
    "passiveTiers",
    (catalog) => {
      Object.assign(catalog.species[0]!.passiveTiers[0].effects[0]!, {
        kind: "blockConversion",
        amount: 101,
      });
    },
  ],
  [
    "18: battle-start grants must mean the same thing for players and enemies",
    "passiveTiers",
    (catalog) => {
      Object.assign(catalog.species[0]!.passiveTiers[0].effects[0]!, {
        kind: "battleStart",
        effect: "water",
        amount: 1,
      });
    },
  ],
  [
    "19: unsupported card-bonus triggers cannot silently become Guard bonuses",
    "passiveTiers",
    (catalog) => {
      Object.assign(catalog.species[0]!.passiveTiers[0].effects[0]!, {
        kind: "cardBonus",
        trigger: "unknown",
        amount: 1,
      });
    },
  ],
  [
    "20: unsupported supplemental scopes cannot silently redirect Cleanse or Reflect",
    "effects",
    (catalog) => {
      Object.assign(catalog.cards[0]!, {
        effects: [
          { kind: "cleanse", target: "enemy", amount: 1 },
          { kind: "reflect", status: "poison", amount: 1 },
        ],
      });
    },
  ],
];
it.each(corruptions)("%s", (_name, field, corrupt) => {
  const catalog = structuredClone(contentCatalog);
  corrupt(catalog);
  expect(validateCatalog(catalog)).toContainEqual(expect.objectContaining({ severity: "error", field }));
});
