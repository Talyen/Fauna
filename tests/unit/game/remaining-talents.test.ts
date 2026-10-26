import { setBattleCards } from "../../support/cards";
import { describe, expect, it, vi } from "vitest";
import {
  freshCombat,
  grantArmor,
  grantBlock,
  gainMana,
  hit,
  restoreHealth,
  startAction,
  tickStatuses,
} from "../../../src/game/combat/index";
import { drawKeyword } from "../../../src/game/card-zones";
import * as content from "../../../src/game/content";
import { definition, species, TALENTS } from "../../../src/game/content";
import { dispatch } from "../../../src/game/engine";
import { beginBattle } from "../../../src/game/journey";
import { canBuyTalent } from "../../../src/game/progression";
import { cardCost } from "../../../src/game/ability-rules";
import { previewPlay } from "../../../src/game/preview";
import { decodeSave, encodeSave } from "../../../src/game/save";
import type { GameEvent, GameState } from "../../../src/game/types";
import { prepareDestination, accept, run, teamRun } from "../../support/game";

const maximumHealth = (unit: GameState["team"][number]) => species(unit.species).health;

function fixture(talents: string[] = [], seed = 42) {
  const state = structuredClone(run());
  state.talents = talents;
  state.rng = seed;
  const source = state.team[0]!,
    target = state.battle!.enemies[0]!;
  source.combat = freshCombat();
  source.health = 10;
  target.combat = freshCombat();
  target.block = 0;
  target.health = target.maxHealth = 1000;
  return { state, source, target, events: [] as GameEvent[] };
}
function anyProc(talents: string[], effect: (f: ReturnType<typeof fixture>) => boolean) {
  for (let seed = 0; seed < 1000; seed++) if (effect(fixture(talents, seed * 7919))) return;
  throw new Error(`No seeded outcome for ${talents.join(", ")}`);
}
function playable(state: GameState, definitionId: string) {
  const card = state.cards.find((c) => c.definitionId === definitionId)!;
  setBattleCards(state, [card.id]);
  return card;
}
function fund(state: GameState, keyword: string) {
  state.talents = TALENTS.filter((t) => t.keyword === keyword).map((t) => t.id);
  state.keywordXP = { [keyword]: 10000 };
}

describe("remaining Alchemy talents adapted to creatures", () => {
  it("opens each row only after the earlier rows and rejects unsupported mechanics", () => {
    const state = structuredClone(run());
    state.keywordXP = Object.fromEntries(TALENTS.map((t) => [t.keyword, 10000]));
    for (const talent of TALENTS) {
      const eligible = TALENTS.filter((t) => t.keyword === talent.keyword && t.row < talent.row);
      state.talents = eligible.map((t) => t.id);
      expect(canBuyTalent(state, talent.id), talent.id).toBe(true);
      if (eligible.length) {
        state.talents.pop();
        expect(canBuyTalent(state, talent.id), talent.id).toBe(false);
      }
    }
    expect(TALENTS).toHaveLength(135);
    expect(TALENTS.every((t) => !/Forge|Wish|Consume|Companion|Archery|Holy|Mana Crystal/.test(t.text))).toBe(
      true,
    );
  });
  it.each([
    ["burn.fire-resistance", "burn"],
    ["poison.toxin-resistance", "poison"],
    ["bleed.wound-care", "bleed"],
    ["freeze.cold-resistance", "freeze"],
    ["light.celestial-ward", "light"],
  ] as const)("%s halves incoming direct and periodic damage", (talent, type) => {
    const f = fixture([talent]);
    f.source.health = maximumHealth(f.source);
    const before = f.source.health;
    hit(f.state, f.target, f.source, 8, type, f.events);
    expect(f.source.health).toBe(before - 4);
    hit(f.state, f.target, f.source, 8, type, f.events, { origin: "periodic" as const });
    expect(f.source.health).toBe(before - 8);
  });
  it.each([
    ["armor.fireward", "burn"],
    ["armor.thick-hide", "bleed"],
  ] as const)("%s mitigates damage with Armor", (talent, type) => {
    const f = fixture([talent]);
    f.source.combat!.armor = 4;
    hit(f.state, f.target, f.source, 8, type, f.events, { origin: "periodic" as const });
    expect(f.source.health).toBe(6);
    expect(f.source.combat!.armor).toBe(3);
  });
  it.each([
    ["block.blood-ward", "bleed"],
    ["block.venom-ward", "poison"],
  ] as const)("%s protects while Block remains", (talent, type) => {
    const f = fixture([talent]);
    f.source.block = 2;
    hit(f.state, f.target, f.source, 8, type, f.events, { origin: "periodic" as const });
    expect(f.source.health).toBe(8);
    expect(f.source.block).toBe(0);
  });
  it.each([
    ["block.weighted-guard", "physical", 11],
    ["block.sacred-shield", "light", 11],
    ["block.impact-guard", "stun", 11],
    ["physical.unrelenting", "physical", 20],
    ["bleed.bleeding-out", "bleed", 13],
    ["light.prosperity", "light", 12],
    ["mana.manaburn", "burn", 11],
    ["mana.arcane-frost", "freeze", 11],
  ] as const)("%s uses current creature or shared resources", (talent, type, damage) => {
    const f = fixture([talent]);
    f.source.block = 10;
    f.state.currency = 200;
    hit(f.state, f.source, f.target, 10, type, f.events);
    expect(f.target.health).toBe(1000 - damage);
  });
  it("combines vulnerable enemy effects and low-Health finishers", () => {
    const f = fixture(["physical.finish-him", "poison.corrosive", "freeze.brittle-ice"]);
    f.target.health = 200;
    f.target.combat.poison = 1;
    f.target.combat.controlled = "freeze";
    hit(f.state, f.source, f.target, 10, "physical", f.events);
    expect(f.target.health).toBe(178);
    f.state.talents = ["stun.exploit-weakness"];
    f.target.combat.controlled = "stun";
    hit(f.state, f.source, f.target, 10, "nature", f.events);
    expect(f.target.health).toBe(158);
  });
  it("boosts Light against Burn and Poison against Bleed", () => {
    for (const [talent, type, status] of [
      ["light.purge", "light", "burn"],
      ["bleed.septic-shock", "poison", "bleed"],
    ] as const) {
      const f = fixture([talent]);
      f.target.combat[status] = 1;
      hit(f.state, f.source, f.target, 10, type, f.events);
      expect(f.target.health).toBe(989);
    }
  });
  it("reinforces Block and reflects depletion once without retaliation chains", () => {
    const f = fixture(["block.reinforce", "block.sun-struck-shield"]);
    f.source.block = 10;
    f.target.combat.thorns = 100;
    hit(f.state, f.target, f.source, 12, "physical", f.events);
    expect(f.source.health).toBe(9);
    expect(f.target.health).toBe(997);
    expect(
      f.events.filter((e): e is Extract<GameEvent, { kind: "damage" }> => e.kind === "damage"),
    ).toHaveLength(2);
  });
  it("Dodge grants owned follow-ups, clears buildup, draws and resets rhythm", () => {
    anyProc(
      [
        "dodge.thornstep",
        "dodge.clean-getaway",
        "dodge.open-flank",
        "dodge.unburdened",
        "dodge.tailwind",
        "dodge.perfect-timing",
        "block.footwork",
        "bleed.parting-cut",
        "physical.riposte",
        "nature.windstep",
      ],
      (f) => {
        f.source.combat!.dodge = 70;
        f.source.combat!.rhythm = 5;
        f.source.combat!.burn = f.source.combat!.poison = f.source.combat!.bleed = 1;
        f.source.combat!.stun = f.source.combat!.freeze = 3;
        const hand = f.state.battle!.hand.length;
        hit(f.state, f.target, f.source, 1, "nature", f.events);
        if (!f.events.some((e) => e.text.includes("Dodges"))) return false;
        expect(f.source.combat).toMatchObject({
          thorns: 1,
          armor: 2,
          rhythm: 0,
          nextPhysical: 2,
          freeNature: true,
          riposte: true,
          partingCut: true,
          burn: 0,
          poison: 0,
          bleed: 0,
          stun: 0,
          freeze: 0,
        });
        expect(f.source.block).toBe(2);
        expect(f.state.battle!.hand).toHaveLength(hand + 1);
        f.state.rng = 42;
        hit(f.state, f.source, f.target, 10, "physical", f.events);
        expect(f.events.some((e) => e.text.includes("Critical"))).toBe(true);
        expect(f.target.combat.bleed).toBeGreaterThan(0);
        expect(f.source.combat).toMatchObject({ nextPhysical: 0, riposte: false, partingCut: false });
        expect(f.state.team[1]!.combat!.riposte).toBe(false);
        return true;
      },
    );
  });
  it("Smoke Screen damages only a Burning attacker on Dodge", () => {
    anyProc(["burn.smoke-screen"], (f) => {
      f.source.combat!.dodge = 70;
      f.target.combat.burn = 1;
      hit(f.state, f.target, f.source, 1, "physical", f.events);
      if (!f.events.some((e) => e.text.includes("Dodges"))) return false;
      expect(f.target.health).toBe(998);
      expect(f.target.combat.burn).toBe(3);
      return true;
    });
  });
  it("grows Finding Rhythm only on damage and grants Last Gasp below half Health", () => {
    const f = fixture(["dodge.finding-rhythm"]);
    hit(f.state, f.target, f.source, 1, "nature", f.events, { origin: "periodic" as const });
    expect(f.source.combat!.rhythm).toBe(5);
    f.state.talents = ["health.last-gasp"];
    f.state.rng = 1;
    // Search a deterministic roll between base Dodge and the low-Health bonus.
    for (let seed = 0; ; seed++) {
      const roll = ((Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
      if (roll >= 0.05 && roll < 0.15) {
        f.state.rng = seed;
        break;
      }
    }
    const before = f.source.health;
    hit(f.state, f.target, f.source, 2, "nature", f.events);
    expect(f.source.health).toBe(before);
  });
  it("grants threshold defenses once, cleanses danger and extends Death's Door", () => {
    const f = fixture([
      "armor.steadfast",
      "health.desperate-guard",
      "health.last-resort",
      "health.will-to-live",
    ]);
    f.source.health = maximumHealth(f.source);
    f.source.combat!.poison = 3;
    hit(f.state, f.target, f.source, maximumHealth(f.source) - 4, "light", f.events, {
      origin: "periodic" as const,
    });
    expect(f.source.combat!.armor).toBeGreaterThan(0);
    expect(f.source.block).toBe(6);
    expect(f.source.combat!.poison).toBe(0);
    restoreHealth(f.source, 99, f.events);
    hit(f.state, f.target, f.source, maximumHealth(f.source) - 4, "light", f.events, {
      origin: "periodic" as const,
    });
    expect(f.source.block).toBe(0);
    expect(f.source.combat!.desperateGuardUsed).toBe(true);
    hit(f.state, f.target, f.source, 100, "light", f.events, { origin: "periodic" as const });
    expect(f.source.combat!.grace).toBe(3);
  });
  it("converts only card overhealing, cleanses once and charges Divine Favor", () => {
    const f = fixture(["health.overflow", "health.clean-slate", "light.divine-favor"]);
    f.source.health = maximumHealth(f.source);
    f.source.combat!.poison = 3;
    restoreHealth(f.source, 8, f.events, false, f.state);
    expect(f.source.block).toBe(0);
    expect(f.source.combat!.poison).toBe(3);
    restoreHealth(f.source, 8, f.events, false, f.state, true);
    expect(f.source.block).toBe(2);
    expect(f.source.combat!.poison).toBe(0);
    expect(f.source.combat!.freeLight).toBe(true);
  });
  it("uses actual Mana gained for healing and respects the shared cap", () => {
    const f = fixture(["mana.arcane-mending"]);
    f.state.team.forEach((c) => (c.health = 10));
    f.state.battle!.mana = 3;
    gainMana(f.state, 10, f.events);
    expect(f.state.team.map((c) => c.health)).toEqual([11, 11, 11]);
    gainMana(f.state, 1, f.events);
    expect(f.source.health).toBe(11);
  });
  it("applies low-Health Armor, doubling and purification at the Armor owner", () => {
    anyProc(["armor.last-stand", "armor.reinforced", "armor.purification"], (f) => {
      f.source.combat!.poison = 1;
      grantArmor(f.state, f.source, 8, f.events);
      if (f.source.combat!.poison) return false;
      expect([10, 20]).toContain(f.source.combat!.armor);
      return true;
    });
  });
  it.each([
    ["physical.heavy-blows", "physical", "stun"],
    ["physical.lacerate", "physical", "bleed"],
    ["nature.briar-patch", "nature", "bleed"],
    ["nature.toxic-pollen", "nature", "poison"],
    ["nature.entangle", "nature", "stun"],
    ["burn.heat-exhaustion", "burn", "stun"],
    ["poison.hemotoxin", "poison", "bleed"],
    ["poison.paralytic-venom", "poison", "stun"],
    ["bleed.tainted-wound", "bleed", "poison"],
    ["light.scorching-light", "light", "burn"],
  ] as const)("%s adds attributed status damage without a proc chain", (talent, type, status) => {
    anyProc([talent], (f) => {
      hit(f.state, f.source, f.target, 10, type, f.events);
      if (!f.target.combat[status]) return false;
      expect(f.target.combat.statusSources[status as "burn" | "poison" | "bleed"] ?? f.source.id).toBe(
        f.source.id,
      );
      expect(
        f.events.filter((e): e is Extract<GameEvent, { kind: "damage" }> => e.kind === "damage"),
      ).toHaveLength(2);
      return true;
    });
  });
  it.each([
    ["nature.thornskin", "nature", "armor"],
    ["armor.iron-guard", "physical", "armor"],
    ["nature.photosynthesis", "nature", "health"],
  ] as const)("%s grants the damage amount", (talent, type, stat) => {
    anyProc([talent], (f) => {
      hit(f.state, f.source, f.target, 6, type, f.events);
      return stat === "health" ? f.source.health === 16 : f.source.combat!.armor === 6;
    });
  });
  it("Flay halves remaining Armor and Bloodrush draws one card", () => {
    anyProc(["bleed.flay"], (f) => {
      f.target.combat.armor = 21;
      hit(f.state, f.source, f.target, 6, "bleed", f.events);
      return f.target.combat.armor === 10;
    });
    anyProc(["bleed.bloodrush"], (f) => {
      const n = f.state.battle!.hand.length;
      hit(f.state, f.source, f.target, 6, "bleed", f.events);
      return f.state.battle!.hand.length === n + 1;
    });
  });
  it.each([
    ["leech.virulent-leech", "poison"],
    ["nature.verdant-cycle", "nature"],
    ["bleed.sanguine", "bleed"],
  ] as const)("%s Leeches once with deferred Bleed payment", (talent, type) => {
    anyProc([talent], (f) => {
      hit(f.state, f.source, f.target, 6, type, f.events);
      if (type === "bleed") {
        if (!f.target.combat.bleedLeech.length) return false;
        expect(f.source.health).toBe(10);
        tickStatuses(f.state, f.target, f.events);
      }
      return f.source.health === 13;
    });
  });
  it("afflicted Leech, full-Health Mana, cleanse and Gold use actual healing", () => {
    const f = fixture(["leech.affliction-siphon", "leech.sanguine-overflow"]);
    f.target.combat.poison = 1;
    f.source.health = maximumHealth(f.source) - 2;
    f.state.battle!.mana = 0;
    hit(f.state, f.source, f.target, 10, "light", f.events, { origin: "ability", leech: true });
    expect(f.source.health).toBe(maximumHealth(f.source));
    expect(f.state.battle!.mana).toBe(1);
    for (const talent of ["leech.bloodletting", "leech.blood-debt", "leech.mana-siphon"])
      anyProc([talent], (f) => {
        f.source.combat!.poison = 1;
        f.state.battle!.mana = 0;
        hit(f.state, f.source, f.target, 10, "light", f.events, { origin: "ability", leech: true });
        return talent.endsWith("bloodletting")
          ? f.source.combat!.poison === 0
          : talent.endsWith("blood-debt")
            ? f.state.currency === 5
            : f.state.battle!.mana === 1;
      });
  });
  it("Cull the Weak boosts only Leech card packets", () => {
    const f = fixture(["leech.cull-the-weak"]);
    f.target.health = 100;
    hit(f.state, f.source, f.target, 8, "physical", f.events, {
      origin: "ability",
      leech: true,
      cardLeech: true,
    });
    expect(f.target.health).toBe(90);
  });
  it("Freezes strip defenses, preserve Poison, and draw once on thaw", () => {
    const f = fixture([
      "freeze.icebound",
      "freeze.brittle-armor",
      "freeze.cryo-preservation",
      "freeze.thaw-dividend",
    ]);
    f.target.health = f.target.maxHealth = 100;
    f.target.combat.armor = 10;
    f.target.block = 1;
    hit(f.state, f.source, f.target, 60, "freeze", f.events);
    expect(f.target.combat.controlled).toBe("freeze");
    expect(f.target.block).toBe(0);
    expect(f.target.combat.armor).toBe(0);
    f.target.combat.poison = 2;
    f.target.combat.statusSources.poison = f.source.id;
    tickStatuses(f.state, f.target, f.events);
    expect(f.target.combat.poison).toBe(2);
    const hand = f.state.battle!.hand.length;
    startAction(f.target, f.events, f.state);
    expect(f.state.battle!.hand).toHaveLength(hand + 1);
    startAction(f.target, f.events, f.state);
    expect(f.state.battle!.hand).toHaveLength(hand + 1);
  });
  it("Stun lasts two action windows and grants one draw, free card and empty-pool Mana", () => {
    const f = fixture([
      "stun.concussive-force",
      "stun.extended-stun",
      "stun.free-follow-up",
      "stun.stun-insight",
      "stun.stun-surge",
    ]);
    f.target.health = f.target.maxHealth = 100;
    f.state.battle!.mana = 0;
    const hand = f.state.battle!.hand.length;
    hit(f.state, f.source, f.target, 40, "stun", f.events);
    expect(f.target.combat.controlled).toBe("stun");
    expect(f.source.combat!.freeCard).toBe(true);
    expect(f.state.battle!.mana).toBe(1);
    expect(f.state.battle!.hand).toHaveLength(hand + 1);
    expect(startAction(f.target, f.events, f.state)).toBe(false);
    expect(f.target.combat.controlled).toBe("stun");
    expect(startAction(f.target, f.events, f.state)).toBe(false);
    expect(f.target.combat.controlled).toBeNull();
  });
  it("Smoldering and Virulent alter decay only on credited enemies", () => {
    for (const [talent, status, expected] of [
      ["burn.smoldering", "burn", 10],
      ["poison.virulent", "poison", 11],
    ] as const)
      anyProc([talent], (f) => {
        f.target.combat[status] = 10;
        f.target.combat.statusSources[status] = f.source.id;
        tickStatuses(f.state, f.target, f.events);
        return f.target.combat[status] === expected;
      });
  });
});

it.each([
  ["burn", "burn.flash-fire", "emberback-attack"],
  ["freeze", "freeze.winter-s-grasp", "prismram-attack"],
  ["nature", "nature.overgrowth", "emberback-attack"],
  ["poison", "poison.venom-strike", "emberback-attack"],
  ["stun", "stun.jarring-blow", "prismram-attack"],
] as const)(
  "%s repeats a complete card once, charges once, and previews the same outcome",
  (keyword, talent, id) => {
    // Exercise compound packets independently of the current production kits.
    {
      const original = content.definition;
      vi.spyOn(content, "definition").mockImplementation((cardId) => {
        const card = original(cardId);
        return cardId === id
          ? {
              ...card,
              effect: "attack",
              target: undefined,
              damageType: keyword,
              effects: [{ kind: "damage", damageType: keyword, amount: 2 }],
            }
          : card;
      });
    }
    for (let seed = 0; seed < 1000; seed++) {
      const state = structuredClone(teamRun(42, ["mossguard", "emberback", "prismram"]));
      fund(state, keyword);
      state.talents = state.talents.filter(
        (t) =>
          t === talent || TALENTS.find((x) => x.id === t)!.row < TALENTS.find((x) => x.id === talent)!.row,
      );
      state.rng = seed * 7919;
      const card = playable(state, id);
      const target = state.battle!.enemies[0]!;
      // Keep the native encounter and save contract, but make its defenses durable for both plays.
      target.block = 1000;
      const command = { type: "play" as const, cardId: card.id, targetId: target.id, autoEndTurn: false };
      const preview = previewPlay(state, card.id, target.id);
      const result = dispatch(state, command);
      expect(result.accepted).toBe(true);
      if (
        result.events.filter((e): e is Extract<GameEvent, { kind: "damage" }> => e.kind === "damage").length <
        4
      )
        continue;
      expect(result.state.battle!.mana).toBe(state.battle!.mana - cardCost(card, state));
      expect(result.state.battleXP[keyword]).toBe(1);
      expect(preview.state).toEqual(result.state);
      expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
      return;
    }
    throw new Error("No repeat");
  },
);

it("persists free-card ownership and spends the reward on only the matching creature", () => {
  const state = structuredClone(teamRun(42, ["pollenmoth", "mossguard", "emberback"]));
  const actor = state.team[0]!;
  actor.combat!.freeLight = true;
  const card = playable(state, "pollenmoth-attack");
  const saved = decodeSave(encodeSave(state));
  expect(cardCost(card, saved)).toBe(0);
  const next = accept(saved, { type: "play", cardId: card.id, targetId: "enemy-0", autoEndTurn: false });
  expect(next.team[0]!.combat!.freeLight).toBe(false);
  expect(next.battle!.mana).toBe(4);
  expect(decodeSave(encodeSave(next))).toEqual(next);
  const rejected = dispatch(saved, { type: "play", cardId: "missing" });
  expect(rejected.accepted).toBe(false);
  expect(rejected.state).toBe(saved);
});

it("opening Mana, Armor and healing apply once, while victory heals living roster members", () => {
  const state = structuredClone(run());
  const ready = prepareDestination(state);
  state.talents = ["mana.leyline-attunement", "mana.mana-bulwark", "mana.mana-shell", "health.combat-surge"];
  state.team.forEach((c) => (c.health = 10));
  beginBattle(ready);
  expect(state.battle!.maxMana).toBe(5);
  expect(state.team.every((c) => c.block === 5 && c.combat!.armor === 5 && c.health === 14)).toBe(true);
  state.talents = ["health.vitality"];
  state.battle!.enemies.forEach((e) => (e.health = 0));
  state.battle!.enemies[0]!.health = 1;
  state.battle!.enemies[0]!.combat.controlled = "stun";
  state.battle!.enemies[0]!.combat.controlTurns = 1;
  const card = playable(state, "mossguard-attack");
  const won = accept(state, { type: "play", cardId: card.id, targetId: "enemy-0", autoEndTurn: false });
  expect(won.team[0]!.health).toBe(18);
});

it("talent Gold survives defeat and resume, is reported once, and previews cannot bank it", () => {
  const state = structuredClone(run());
  fund(state, "poison");
  const card = playable(state, "mossguard-attack");
  state.battle!.enemies.forEach((e) => (e.health = 0));
  const target = state.battle!.enemies[0]!;
  target.health = 1;
  target.combat.poison = 1;
  const before = encodeSave(state);
  const preview = previewPlay(state, card.id, target.id);
  expect(preview.state.currency).toBeGreaterThanOrEqual(3);
  expect(encodeSave(state)).toBe(before);
  const won = accept(state, { type: "play", cardId: card.id, targetId: target.id, autoEndTurn: false });
  expect(won.currency).toBe(23);
  expect(won.reward!.currency).toBe(23);
  expect(decodeSave(encodeSave(won))).toEqual(won);
});

it("Armor Siphon steals before card damage and Caustic strips credited Poison Armor", () => {
  const original = content.definition;
  vi.spyOn(content, "definition").mockImplementation((id) =>
    id === "emberback-attack" ? { ...original(id), leech: true, effects: [] } : original(id),
  );
  const state = structuredClone(teamRun(42, ["emberback", "mossguard", "prismram"]));
  fund(state, "leech");
  const card = playable(state, "emberback-attack");
  state.battle!.enemies[0]!.combat.armor = 10;
  state.battle!.enemies[0]!.block = 100;
  const result = accept(state, { type: "play", cardId: card.id, targetId: "enemy-0", autoEndTurn: false });
  expect(result.team[0]!.combat!.armor).toBe(1);
  expect(result.battle!.enemies[0]!.combat.armor).toBe(9);
  expect(decodeSave(encodeSave(result))).toEqual(result);
  const f = fixture(["poison.caustic"]);
  f.target.combat.armor = 20;
  hit(f.state, f.source, f.target, 5, "poison", f.events);
  expect(f.target.combat.armor).toBe(14);
  tickStatuses(f.state, f.target, f.events);
  expect(f.target.combat.armor).toBe(8);
});

it("Rupture detonates Bleed once and pays its original Leech owner", () => {
  const f = fixture(["physical.rupture"]);
  f.source.combat!.riposte = true;
  f.target.combat.bleed = 6;
  f.target.combat.statusSources.bleed = f.state.team[1]!.id;
  f.state.team[1]!.health = 10;
  f.target.combat.bleedLeech = [{ sourceId: f.state.team[1]!.id, amount: 6 }];
  hit(f.state, f.source, f.target, 5, "physical", f.events);
  expect(f.target.health).toBe(984);
  expect(f.state.team[1]!.health).toBe(13);
  expect(f.target.combat.bleed).toBe(0);
  expect(f.target.combat.bleedLeech).toEqual([]);
  tickStatuses(f.state, f.target, f.events);
  expect(f.target.health).toBe(984);
});

it("Armored Surge triggers on a Block card once and Radiant Guard draws an eligible Light card", () => {
  let triggered = false;
  for (let seed = 0; seed < 1000 && !triggered; seed++) {
    const state = structuredClone(run());
    fund(state, "armor");
    state.rng = seed * 7919;
    const card = playable(state, "mossguard-guard");
    const next = accept(state, {
      type: "play",
      cardId: card.id,
      targetId: state.team[0]!.id,
      autoEndTurn: false,
    });
    triggered = next.team[0]!.combat!.armor >= 7;
    if (triggered) expect(decodeSave(encodeSave(next))).toEqual(next);
  }
  expect(triggered).toBe(true);
  for (let seed = 0; seed < 1000; seed++) {
    const state = structuredClone(teamRun(42, ["pollenmoth", "mossguard", "emberback"]));
    state.talents = ["light.radiant-guard"];
    state.rng = seed * 7919;
    const light = playable(state, "pollenmoth-attack");
    state.battle!.hand = [];
    state.battle!.discard = [light.id];
    const events: GameEvent[] = [];
    grantBlock(state, state.team[0]!, 1, events);
    if (state.battle!.hand.includes(light.id)) return;
  }
  throw new Error("No Radiant Guard draw");
});

it("combined talent builds keep accepted cards and turns unchanged through save/resume", () => {
  for (let seed = 0; seed < 5; seed++) {
    let state = structuredClone(teamRun(seed, ["prismram", "emberback", "mossguard"]));
    state.talents = TALENTS.map((t) => t.id);
    state.keywordXP = Object.fromEntries(TALENTS.map((t) => [t.keyword, 10000]));
    let acceptedPlays = 0;
    for (let turn = 0; turn < 10 && state.phase === "battle"; turn++) {
      for (const cardId of state.battle!.hand) {
        if (state.phase !== "battle") break;
        const card = state.cards.find((c) => c.id === cardId)!;
        const def = definition(card.definitionId);
        const targetId =
          def.effect === "attack"
            ? state.battle!.enemies.find((e) => e.health > 0)?.id
            : state.team.find((c) => c.health > 0)?.id;
        const result = dispatch(state, { type: "play", cardId, targetId, autoEndTurn: false });
        if (result.accepted) {
          acceptedPlays++;
          const resumed = decodeSave(encodeSave(result.state));
          expect(resumed).toEqual(result.state);
          state = structuredClone(resumed);
        } else {
          expect(result.state).toBe(state);
          expect(result.events).toEqual([]);
        }
      }
      if (state.phase === "battle") {
        const next = accept(state, { type: "endTurn" });
        const resumed = decodeSave(encodeSave(next));
        expect(resumed).toEqual(next);
        state = structuredClone(resumed);
      }
    }
    expect(acceptedPlays, `seed ${seed} must exercise accepted card plays`).toBeGreaterThan(0);
  }
});

it("retains already-earned talent Gold through defeat, abandonment and resume", () => {
  let earned: GameState | undefined;
  for (let seed = 0; seed < 1000; seed++) {
    const state = structuredClone(teamRun(42, ["pollenmoth", "mossguard", "emberback"]));
    fund(state, "light");
    state.rng = seed * 7919;
    const card = playable(state, "pollenmoth-attack");
    const next = accept(state, { type: "play", cardId: card.id, targetId: "enemy-0", autoEndTurn: false });
    if (next.currency > 0) {
      earned = next;
      break;
    }
  }
  expect(earned).toBeDefined();
  const resumed = decodeSave(encodeSave(earned!));
  const ended = accept(resumed, { type: "abandon" });
  expect(ended.currency).toBe(resumed.currency);
  expect(ended.journey?.currency).toBe(resumed.journey?.currency);
  expect(decodeSave(encodeSave(ended))).toEqual(ended);
  let losing = structuredClone(resumed);
  losing.team.forEach((c) => {
    c.health = 1;
    c.block = 0;
    c.combat = { ...freshCombat(), deathDoorUsed: true };
  });
  losing.talents = [];
  for (let i = 0; i < 100 && losing.phase === "battle"; i++)
    losing = structuredClone(accept(losing, { type: "endTurn" }));
  expect(losing.phase).toBe("defeat");
  expect(losing.currency).toBe(resumed.currency);
  expect(losing.reward!.currency).toBe(resumed.currency);
  expect(decodeSave(encodeSave(losing))).toEqual(losing);
});

it("keyword draws include cards classified by supplemental effects", () => {
  const state = structuredClone(teamRun(42, ["emberback", "mossguard", "prismram"]));
  const original = content.definition;
  vi.spyOn(content, "definition").mockImplementation((id) =>
    id === "emberback-attack"
      ? { ...original(id), effects: [{ kind: "status", status: "thorns", amount: 1 }] }
      : original(id),
  );
  const card = playable(state, "emberback-attack");
  state.battle!.hand = [];
  state.battle!.discard = [card.id];
  drawKeyword(state, "nature");
  expect(state.battle!.hand).toEqual([card.id]);
  expect(state.battle!.discard).toEqual([]);
  expect(new Set([...state.battle!.draw, ...state.battle!.hand]).size).toBe(state.cards.length);
});
