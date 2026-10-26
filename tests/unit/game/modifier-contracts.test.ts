import traces from "./fixtures/modifier-traces.json" with { type: "json" };
import { NEW_BOON_EFFECTS } from "../../support/boons";
import { dodgeChance } from "../../../src/game/combat/index";
import { cardCost } from "../../../src/game/ability-rules";
import { projectPlay } from "../../../src/game/preview";
import { uncertainBattle } from "../../support/uncertainty";
import { contentCatalog, validateCatalog } from "../../../src/game/content-validation";
import { modifierImplementations, modifierQueries } from "../../../src/game/modifier-bindings";
import { boonRule } from "../../../src/game/rules/boons";
import { createHash } from "node:crypto";
import { produce } from "immer";
import { expect, it } from "vitest";
import { BOONS, TALENTS, SPECIES, type SpeciesId, species } from "../../../src/game/content";
import { createGame, dispatch, previewCard } from "../../../src/game/engine";
import { availablePlays } from "../../../src/game/play-queries";
import { rankedBattleChoices } from "../../../src/application/battle-policy";
import { encodeSave, decodeSave } from "../../../src/game/save";
import {
  hit,
  freshCombat,
  grantBlock,
  grantArmor,
  restoreHealth,
  removeEffects,
  tickStatuses,
  startAction,
} from "../../../src/game/combat/index";
import type { GameEvent } from "../../../src/game/types";
import { requireBattle, teamRun } from "../../support/game";

// Preserve the recorded oracle across save versions and dormant combat fields.
// New kits have direct behavioral coverage in ability-contracts.test.ts and creatures/*.test.ts.
const recordedSpecies = SPECIES.filter(
  (entry) => !["arabesca", "skybex", "dulcera", "parhelion", "pyrella", "alpenglen"].includes(entry.id),
);
// New Boons have direct outcome assertions in boons.test.ts
const recordedBoons = BOONS.filter((boon) => !Object.hasOwn(NEW_BOON_EFFECTS, boon.id));
const digest = (value: unknown) =>
  createHash("sha256")
    .update(
      JSON.stringify(value, (key, entry) => {
        if (key === "version") return 57;
        if (key === "metronomeActor" && entry === null) return undefined;
        if (key === "fireThorns" && entry === 0) return undefined;
        if (key === "puzzleProgress" && Array.isArray(entry) && entry.length === 0) return undefined;
        if (key === "encoreProgress" && entry === 0) return undefined;
        if (key === "repeatNext" && entry.player === false && entry.enemy === false) return undefined;
        return entry;
      }),
    )
    .digest("hex");

// Baseline includes the approved Block rules, ten passive Boons and save format 57.
// These expectations are an independent behavior oracle; do not refresh them for a refactor.
it("preserves all modifier definitions, text and ordered six-tier passives", () => {
  expect({
    talents: digest(TALENTS),
    boons: digest(recordedBoons),
    passives: digest(recordedSpecies.map(({ id, passiveTiers }) => ({ id, passiveTiers }))),
  }).toMatchSnapshot();
});

const cases = [
  ...TALENTS.map((talent) => ({
    name: talent.id,
    talent,
    boon: undefined,
    species: "mossguard" as SpeciesId,
    rank: 0,
  })),
  ...recordedBoons.map((boon) => ({
    name: boon.id,
    talent: undefined,
    boon,
    species: "mossguard" as SpeciesId,
    rank: 0,
  })),
  ...recordedSpecies.flatMap((species) =>
    Array.from({ length: 6 }, (_, rank) => ({
      name: `${species.id}:${rank}`,
      talent: undefined,
      boon: undefined,
      species: species.id,
      rank,
    })),
  ),
  {
    name: "combined reactions",
    talent: undefined,
    boon: undefined,
    species: "pollenmoth" as SpeciesId,
    rank: 5,
  },
];
it("covers every recorded modifier trace", () => {
  expect(cases.map(({ name }) => name).sort()).toEqual(Object.keys(traces).sort());
});

// Each independent scenario retains its original digest and its own bounded deadline.
it.each(cases)(
  "preserves modifier command, preview, reaction, RNG and save/resume traces for $name",
  (scenario) => {
    const original = teamRun(
      42,
      species(scenario.species).legendary ? [scenario.species] : [scenario.species, "reedstag", "cindernewt"],
    );
    const state = requireBattle(
      produce(original, (draft) => {
        if (scenario.talent) {
          const talent = scenario.talent;
          draft.keywordXP[talent.keyword] = 100000;
          draft.talents = TALENTS.filter(
            (other) => other.keyword === talent.keyword && (other.row < talent.row || other.id === talent.id),
          ).map((other) => other.id);
        }
        if (scenario.boon) draft.boons = [scenario.boon.id];
        draft.discovery.recruited[scenario.species] = scenario.rank + 1;
        if (scenario.name === "combined reactions") {
          draft.talents = TALENTS.map((talent) => talent.id);
          for (const talent of TALENTS) draft.keywordXP[talent.keyword] = 100000;
          draft.boons = recordedBoons.map((boon) => boon.id);
        }
      }),
    );
    const encoded = encodeSave(state);
    const resumed = decodeSave(encoded);
    const plays = availablePlays(state, false).flatMap((play) => play.commands);
    const commands = plays.map((command) => {
      const result = dispatch(state, { ...command, autoEndTurn: false });
      expect(dispatch(resumed, { ...command, autoEndTurn: false })).toEqual(result);
      return {
        result: digest(result),
        preview: digest(previewCard(state, command.cardId, command.targetId)),
      };
    });
    const mutable = structuredClone(state);
    const events: GameEvent[] = [];
    const actor = mutable.team[0]!;
    const target = mutable.battle.enemies[0]!;
    actor.health = 8;
    actor.block = 6;
    actor.combat = freshCombat();
    target.health = target.maxHealth = 500;
    target.combat = freshCombat();
    target.block = 5;
    target.combat.armor = 3;
    grantBlock(mutable, actor, 4, events);
    grantArmor(mutable, actor, 4, events);
    for (const type of [
      "physical",
      "water",
      "nature",
      "light",
      "burn",
      "poison",
      "bleed",
      "stun",
      "freeze",
    ] as const)
      hit(mutable, actor, target, 9, type, events);
    hit(mutable, target, actor, 8, "physical", events);
    restoreHealth(actor, 100, events, false, mutable, true, actor);
    removeEffects(actor, "cleanse", 7, events, mutable);
    tickStatuses(mutable, target, events);
    startAction(target, events, mutable);
    expect(encodeSave(state)).toBe(encoded);
    const rejected = dispatch(state, { type: "play", cardId: "missing" });
    expect(rejected.state).toBe(state);
    const trace = {
      commands,
      turn: digest(dispatch(state, { type: "endTurn" })),
      ranking: digest(rankedBattleChoices(state, false)),
      reactions: digest({ mutable, events }),
    };
    expect(digest(trace)).toBe(traces[scenario.name as keyof typeof traces]);
  },
);

it("preserves initial journey and seeded start state", () => {
  expect(digest(createGame(42))).toMatchSnapshot();
});

it("requires actual implementation bindings for authored modifiers, including future content", () => {
  expect(validateCatalog().filter((issue) => issue.severity === "error")).toEqual([]);
  expect(Object.keys(modifierImplementations.talents).sort()).toEqual(
    TALENTS.map((talent) => talent.id).sort(),
  );
  expect(Object.keys(modifierImplementations.boons).sort()).toEqual(BOONS.map((boon) => boon.id).sort());
  const authoredPassives = [
    ...new Set(
      SPECIES.flatMap((species) =>
        species.passiveTiers.flatMap((tier) => tier.effects.map((effect) => effect.kind)),
      ),
    ),
  ];
  expect(Object.keys(modifierImplementations.passives)).toEqual(expect.arrayContaining(authoredPassives));
  const talent = structuredClone(contentCatalog);
  Reflect.set(talent.talents[0]!, "id", "water.future");
  Reflect.set(talent.talents[0]!, "effect", "future");
  expect(validateCatalog(talent)).toContainEqual(
    expect.objectContaining({ id: "water.future", field: "effect", severity: "error" }),
  );
  const boon = structuredClone(contentCatalog);
  Reflect.set(boon.boons[0]!, "id", "future-boon");
  expect(validateCatalog(boon)).toContainEqual(
    expect.objectContaining({ id: "future-boon", field: "effect", severity: "error" }),
  );
  const passive = structuredClone(contentCatalog);
  Reflect.set(passive.species[0]!.passiveTiers[0].effects[0]!, "kind", "futurePassive");
  expect(validateCatalog(passive)).toContainEqual(
    expect.objectContaining({
      field: "passiveTiers",
      message: "Passive effect needs an implementation binding",
    }),
  );
});
it("keeps implementation bindings and shared Boon parameters immutable", () => {
  type BindingGroup = Readonly<Record<string, readonly { module: string; name: string }[]>>;
  const catalogs: readonly Readonly<Record<string, BindingGroup>>[] = [
    modifierImplementations,
    modifierQueries,
  ];
  for (const catalog of catalogs) {
    expect(Object.isFrozen(catalog)).toBe(true);
    expect(structuredClone(catalog)).toEqual(catalog);
    for (const group of Object.values(catalog)) {
      expect(Object.isFrozen(group)).toBe(true);
      for (const binding of Object.values(group)) {
        expect(Object.isFrozen(binding)).toBe(true);
        expect(
          binding.every(
            (handler: { module: string; name: string }) =>
              typeof handler.module === "string" &&
              typeof handler.name === "string" &&
              Object.isFrozen(handler),
          ),
        ).toBe(true);
      }
    }
  }
  const icy = boonRule("icy-heart");
  expect(Reflect.set(icy, "damage", 99)).toBe(false);
  expect(icy.text).toContain(String(icy.damage));
});

it("preserves an admitted free-card grant across Talent reset and resume until its accepted use", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["mossguard"])));
  state.talents = [];
  state.team[0]!.combat = { ...freshCombat(), freeCard: true };
  const resumed = requireBattle(decodeSave(encodeSave(state)));
  const actor = resumed.team[0]!;
  const play = availablePlays(resumed, false).find((entry) => entry.actor.id === actor.id)!;
  expect(cardCost(play.card, resumed)).toBe(0);
  const result = dispatch(resumed, play.commands[0]!);
  expect(result.accepted).toBe(true);
  expect(cardCost(play.card, result.state)).toBe(1);
  expect(resumed.team[0]!.combat!.freeCard).toBe(true);
});

it("preserves Dodge response order when a cross-category reaction knocks out the attacker", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["cindernewt"])));
  const ally = state.team[0]!,
    enemy = state.battle.enemies[0]!;
  state.talents = [
    "dodge.catch-breath",
    "dodge.thornstep",
    "dodge.open-flank",
    "block.footwork",
    "physical.riposte",
    "nature.windstep",
    "burn.smoke-screen",
  ];
  state.boons = ["ironwood-buckler"];
  ally.health = 5;
  ally.block = 0;
  ally.combat = { ...freshCombat(), rhythm: 20 };
  enemy.health = 1;
  enemy.block = 0;
  enemy.combat = { ...freshCombat(), burn: 1 };
  state.rng = 42;
  const events: GameEvent[] = [];
  hit(state, enemy, ally, 1, "physical", events, { origin: "ability", blindMiss: true });
  expect(events.slice(0, 5).map((event) => [event.kind, "status" in event ? event.status : null])).toEqual([
    ["status", "dodge"],
    ["heal", null],
    ["status", "thorns"],
    ["block", null],
    ["status", "thorns"],
  ]);
  expect(events.filter((event) => event.kind === "damage")).toHaveLength(1);
  expect(enemy.health).toBe(0);
  expect(ally.health).toBe(6);
  expect(ally.combat).toMatchObject({
    rhythm: 0,
    nextPhysical: 2,
    riposte: true,
    freeNature: true,
    thorns: 2,
  });
  expect(state.rng).toBe(42);
});
it("connects Finding Rhythm damage, chance and reset without consulting new randomness", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["mossguard"])));
  state.talents = ["dodge.finding-rhythm"];
  const ally = state.team[0]!,
    enemy = state.battle.enemies[0]!;
  ally.combat = freshCombat();
  ally.block = 0;
  state.rng = 42;
  hit(state, enemy, ally, 1, "poison", [], { origin: "periodic" });
  expect(ally.combat.rhythm).toBe(5);
  expect(dodgeChance(state, ally)).toBe(10);
  hit(state, enemy, ally, 1, "physical", [], { origin: "ability", blindMiss: true });
  expect(ally.combat.rhythm).toBe(0);
  expect(dodgeChance(state, ally)).toBe(5);
  expect(state.rng).toBe(42);
});
it("keeps modifier chance projections seed-independent and the live checkpoint unchanged", () => {
  const state = uncertainBattle();
  const before = encodeSave(state);
  const project = (input: typeof state) => {
    const result = projectPlay(input, input.battle!.hand[0]!, "enemy-0");
    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected finite modifier projection");
    return result.outcomes.map(({ events, state: outcome }) => ({
      events,
      battle: outcome.battle,
      team: outcome.team,
    }));
  };
  expect(project(state)).toEqual(
    project(
      produce(state, (draft) => {
        draft.rng = 100003;
      }),
    ),
  );
  expect(encodeSave(state)).toBe(before);
  expect(decodeSave(before)).toEqual(state);
});
