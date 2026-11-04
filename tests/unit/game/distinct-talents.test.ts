import { describe, expect, it } from "vitest";
import {
  dodgeChance,
  freshCombat,
  grantBlock,
  hit,
  removeEffects,
  restoreHealth,
  tickStatuses,
} from "../../../src/game/combat/index";
import { decayBlock } from "../../../src/game/combat/turns";
import { dispatch } from "../../../src/game/engine";
import { availablePlays } from "../../../src/game/play-queries";
import { decodeSave, encodeSave } from "../../../src/game/save";
import type { GameEvent } from "../../../src/game/types";
import { prepareDestination, accept, run, teamRun, requireBattle } from "../../support/game";

function fixture() {
  const state = structuredClone(run(42));
  state.rng = 42;
  const source = Object.assign(state.team[0]!, { combat: freshCombat() }),
    target = state.battle!.enemies[0]!;
  target.health = target.maxHealth = 100;
  target.block = 0;
  target.combat = freshCombat();
  source.health = 10;
  return { state, source, target, events: [] as GameEvent[] };
}
describe("distinct talent and Boon outcomes", () => {
  it("adds current Block and Armor to Physical damage without spending either", () => {
    const { state, source, target, events } = fixture();
    state.talents = ["physical.shield-slam", "physical.armored-fists"];
    source.block = 6;
    source.combat.armor = 4;
    hit(state, source, target, 5, "physical", events);
    expect(target.health).toBe(90);
    expect([source.block, source.combat.armor]).toEqual([6, 4]);
  });
  it("melts Armor with direct and attributed periodic Burn damage", () => {
    const { state, source, target, events } = fixture();
    state.talents = ["burn.melting-point"];
    target.combat.armor = 20;
    hit(state, source, target, 5, "burn", events);
    expect(target.combat.armor).toBe(15);
    tickStatuses(state, target, events);
    expect(target.combat.armor).toBe(10);
    expect(target.combat.burn).toBe(3);
  });
  it("lowers Freeze thresholds, grants Block, and triggers Icy Heart once", () => {
    const { state, source, target, events } = fixture();
    state.talents = ["freeze.bitter-cold", "freeze.glacial-barrier"];
    state.boons = ["icy-heart", "ironwood-buckler"];
    hit(state, source, target, 40, "freeze", events);
    expect(target.combat.controlled).toBe("freeze");
    expect(target.health).toBe(54);
    expect(source.block).toBe(3);
    expect(source.combat.thorns).toBe(1);
    hit(state, source, target, 1, "freeze", events);
    expect(target.health).toBe(53);
    expect(events.filter((e) => e.kind === "damage" && e.damageType === "physical")).toHaveLength(1);
  });
  it("Stun removes Armor and grants Block only when none is present", () => {
    const { state, source, target, events } = fixture();
    state.talents = ["stun.guarded-counter", "stun.shatter-guard"];
    target.combat.armor = 5;
    hit(state, source, target, 55, "stun", events);
    expect(target.combat.controlled).toBe("stun");
    expect(target.combat.armor).toBe(0);
    expect(events).toContainEqual(expect.objectContaining({ kind: "block", targetId: source.id, amount: 4 }));
    // Breaking Emberback Armor then spends one Block on its Molten Shell burst.
    expect(source.block).toBe(3);
  });
  it("reduces healing for each harmful status and prevents poisoned enemy Dodge", () => {
    const { state, source, target, events } = fixture();
    state.talents = ["poison.necrosis", "poison.torpor", "bleed.mortal-wound"];
    target.health = 20;
    target.combat.poison = 1;
    target.combat.bleed = 1;
    restoreHealth(target, 20, events, false, state);
    expect(target.health).toBe(25);
    target.combat.dodge = 70;
    state.rng = 42; // First roll would Dodge at 75% without Torpor.
    hit(state, source, target, 4, "nature", events);
    expect(target.health).toBe(21);
  });
  it("uses chance talents once per direct packet, with no recursive Block or Thorns", () => {
    for (const [type, talent, status] of [
      ["nature", "nature.bramblegrowth", "thorns"],
      ["light", "light.faith-barrier", "block"],
    ] as const) {
      const { state, source, target, events } = fixture();
      state.talents = [talent];
      // Choose a deterministic stream with no Dodge/critical and a successful proc.
      for (let seed = 0; ; seed++) {
        let rng = seed;
        const values = [];
        for (let i = 0; i < 3; i++) {
          rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
          values.push(rng / 4294967296);
        }
        if (values[0]! >= 0.05 && values[1]! >= 0.05 && values[2]! < 0.1) {
          state.rng = seed;
          break;
        }
      }
      hit(state, source, target, 6, type, events);
      expect(status === "block" ? source.block : source.combat.thorns).toBe(6);
      hit(state, source, target, 6, type, events, { origin: "periodic" as const });
      expect(status === "block" ? source.block : source.combat.thorns).toBe(6);
    }
  });
  it("Leeches Light only below half Health and applies both Leech modifiers", () => {
    const { state, source, target, events } = fixture();
    state.talents = ["light.blessed-leech", "leech.deep-siphon", "leech.desperate-siphon"];
    hit(state, source, target, 6, "light", events);
    expect(source.health).toBe(18);
    hit(state, source, target, 6, "light", events);
    expect(source.health).toBe(18);
  });
  it("boosts only the first Bleed and pays attributed periodic kills once", () => {
    const { state, source, target, events } = fixture();
    state.talents = ["bleed.first-blood"];
    state.boons = ["bone-charm"];
    hit(state, source, target, 4, "bleed", events);
    expect(target.combat.bleed).toBe(5);
    hit(state, source, target, 4, "bleed", events);
    expect(target.combat.bleed).toBe(9);
    target.health = 5;
    tickStatuses(state, target, events);
    expect(source.health).toBe(13);
    tickStatuses(state, target, events);
    expect(source.health).toBe(13);
  });
  it("keeps depletion and Armor break grants independent and prevents Stun behind Block", () => {
    const { state, source, target, events } = fixture();
    state.talents = ["block.second-wind", "block.grounding", "armor.reactive-guard"];
    source.block = 2;
    source.combat.armor = 1;
    hit(state, target, source, 5, "physical", events);
    expect(source.health).toBe(10); // Two damage, then two healing.
    expect(source.block).toBe(3);
    hit(state, target, source, 2, "stun", events);
    expect(source.combat.stun).toBe(0);
    expect(source.combat.controlled).toBeNull();
  });
  it("Mending and Renewal heal only actually cleansed categories, without reviving", () => {
    const { state, source, events } = fixture();
    state.talents = ["health.mending", "health.renewal"];
    restoreHealth(source, 10, events, false, state);
    expect(source.health).toBe(21);
    source.combat.poison = 1;
    source.combat.burn = 1;
    removeEffects(source, "cleanse", 3, events, state);
    expect(source.health).toBe(25);
    removeEffects(source, "cleanse", 3, events, state);
    expect(source.health).toBe(25);
    source.health = 0;
    restoreHealth(source, 100, events, false, state);
    expect(source.health).toBe(0);
  });
  it("Lightfoot improves Dodge and Catch Breath restores Health without damage", () => {
    const { state, source, target, events } = fixture();
    state.talents = ["dodge.lightfoot", "dodge.catch-breath"];
    // Pick a first roll between the base 5% and talented 10%.
    for (let seed = 0; ; seed++) {
      const value = ((Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
      if (value >= 0.05 && value < 0.1) {
        state.rng = seed;
        break;
      }
    }
    hit(state, target, source, 10, "physical", events);
    expect(source.health).toBe(11);
    expect(state.battleXP.dodge).toBe(1);
  });
  it.each([
    ["mana.wellspring", 1],
    ["mana.dark-recovery", 0],
  ] as const)("%s grants one next-turn Mana and survives resume", (talent, mana) => {
    const state = structuredClone(run());
    state.talents =
      talent === "mana.dark-recovery" ? ["mana.wellspring", "mana.dark-recovery"] : ["mana.wellspring"];
    state.keywordXP.mana = 40;
    state.battle!.mana = mana;
    const next = accept(state, { type: "endTurn" });
    expect(next.battle!.mana).toBe(5);
    expect(next.battle!.maxMana).toBe(5);
    expect(decodeSave(encodeSave(next))).toEqual(next);
    const reset = accept(next, { type: "resetTalents", keyword: "mana" });
    expect(reset.battle!.mana).toBe(5);
    expect(decodeSave(encodeSave(reset))).toEqual(reset);
    const following = accept(reset, { type: "endTurn" });
    expect(following.battle!.maxMana).toBe(4);
  });
  it("rejects retired Forge fields and obsolete saves", () => {
    const state = JSON.parse(encodeSave(run()));
    state.team[0].combat.forge = 1;
    expect(() => decodeSave(JSON.stringify(state))).toThrow();
    delete state.team[0].combat.forge;
    state.version = 12;
    expect(() => decodeSave(JSON.stringify(state))).toThrow();
    expect(dispatch(run(), { type: "buyTalent", talentId: "forge.potency" }).accepted).toBe(false);
  });
  it("Ironwood grants Thorns once per positive Block grant", () => {
    const { state, source, events } = fixture();
    state.boons = ["ironwood-buckler"];
    grantBlock(state, source, 4, events);
    grantBlock(state, source, 0, events);
    expect(source.combat.thorns).toBe(1);
  });
});

it("applies opening draws and Armor once, without granting reserve Armor", () => {
  for (let seed = 0; seed < 10; seed++) {
    const ready = structuredClone(run(seed));
    prepareDestination(ready);
    const reserve = ready.team.pop()!;
    ready.reserves.push(reserve);

    ready.cards = ready.cards.filter((card) => card.ownerId !== reserve.id);
    const base = accept(ready, { type: "beginBattle" });
    ready.talents = ["nature.ecosystem", "armor.bulwark"];
    ready.boons = ["tattered-pages"];
    const boosted = accept(ready, { type: "beginBattle" });
    expect(boosted.team.every((c) => c.combat!.armor === 2)).toBe(true);
    expect(boosted.reserves[0]!.combat!.armor).toBe(0);
    expect(boosted.battle!.hand.length).toBeGreaterThanOrEqual(base.battle!.hand.length + 1);
    expect(new Set(boosted.battle!.hand).size).toBe(boosted.battle!.hand.length);
  }
});

it.each(["stun", "freeze", "both", "neither"] as const)(
  "Unburdened awards Cleanse reactions only for removed %s buildup",
  (buildup) => {
    const { state, source, target, events } = fixture();
    state.talents = ["dodge.unburdened", "health.renewal", "light.divine-favor"];
    source.combat.stun = buildup === "stun" || buildup === "both" ? 3 : 0;
    source.combat.freeze = buildup === "freeze" || buildup === "both" ? 3 : 0;
    // Blind misses use the ordinary Dodge reaction path, without relying on a random Dodge roll
    hit(state, target, source, 1, "physical", events, { origin: "ability", blindMiss: true });

    const count = buildup === "both" ? 2 : buildup === "neither" ? 0 : 1;
    expect(source.health).toBe(10 + count * 2);
    expect(source.combat.stun).toBe(0);
    expect(source.combat.freeze).toBe(0);
    expect(source.combat.freeLight).toBe(count > 0);
    expect(events.filter((event) => event.kind === "status" && event.status === "cleanse")).toHaveLength(
      count,
    );
  },
);

describe("row 4 keyword completion talents", () => {
  it("applies Veil of Mist, Astral Veil, and Heat Haze to Dodge chance", () => {
    const { state, source, target } = fixture();
    state.talents = ["dodge.veil-of-mist", "mana.astral-veil", "burn.heat-haze"];
    state.battle!.mana = 3;
    source.block = 0;
    target.combat.burn = 0;
    expect(dodgeChance(state, source, target)).toBe(20); // 5 base + 15 from 3 Mana
    source.block = 4;
    expect(dodgeChance(state, source, target)).toBe(30); // +10 from Veil of Mist
    target.combat.burn = 2;
    expect(dodgeChance(state, source, target)).toBe(40); // +10 from Heat Haze
  });

  it("Permafrost prevents allied Block decay only while an enemy is Frozen", () => {
    const { state, source, target, events } = fixture();
    state.talents = ["freeze.permafrost"];
    source.block = 8;
    target.combat.controlled = "freeze";
    decayBlock(state, source, events);
    expect(source.block).toBe(8);
    target.combat.controlled = null;
    decayBlock(state, source, events);
    expect(source.block).toBe(4);
  });

  it("Daybreak heals on Light hits only while the attacker has Block", () => {
    const { state, source, target, events } = fixture();
    state.talents = ["light.daybreak"];
    source.block = 0;
    hit(state, source, target, 4, "light", events);
    expect(source.health).toBe(10);
    source.block = 3;
    hit(state, source, target, 4, "light", events);
    expect(source.health).toBe(12);
  });

  it("Static Charge boosts Stun attacks against enemies with Block or Armor", () => {
    const { state, source, target, events } = fixture();
    state.talents = ["stun.static-charge"];
    hit(state, source, target, 8, "stun", events);
    expect(target.health).toBe(92);
    target.block = 2;
    hit(state, source, target, 8, "stun", events);
    expect(target.block).toBe(0);
    expect(target.health).toBe(84); // 8 * 1.25 = 10 damage (2 absorbed by Block, 8 to Health)
  });

  it("Arcane Discharge deals 3 Stun damage when spending the last point of Mana", () => {
    const state = structuredClone(requireBattle(run(42)));
    state.talents = ["mana.arcane-discharge"];
    state.battle!.mana = 1;
    const command = availablePlays(state, false)[0]!.commands[0]!;
    const result = dispatch(state, { ...command, autoEndTurn: false });
    expect(result.accepted).toBe(true);
    expect(result.state.battle!.mana).toBe(0);
    expect(result.events).toContainEqual(
      expect.objectContaining({ kind: "damage", damageType: "stun", amount: 3 }),
    );
  });

  it("Savagery increases Physical Critical Hit chance against Bleeding or Stunned enemies and Juggernaut grants Armor on Block break", () => {
    const { state, source, target, events } = fixture();
    state.talents = ["physical.savagery", "physical.juggernaut"];
    target.block = 4;
    target.combat.bleed = 2;
    // Choose a deterministic seed where the second LCG roll (after Dodge >= 0.05) is between 0.05 and 0.20.
    for (let seed = 0; ; seed++) {
      const r1 = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const r2 = (Math.imul(r1, 1664525) + 1013904223) >>> 0;
      if (r1 / 4294967296 >= 0.05 && r2 / 4294967296 >= 0.05 && r2 / 4294967296 < 0.2) {
        state.rng = seed;
        break;
      }
    }
    hit(state, source, target, 5, "physical", events);
    expect(target.block).toBe(0);
    expect(target.health).toBe(94); // 5 * 2 crit = 10; 4 absorbed by Block, 6 to Health
    expect(source.combat.armor).toBe(3);
  });

  it("Hearthfire heals on Burn hits against already Burning enemies and Combustion boosts Burn damage on Poisoned or Bleeding enemies", () => {
    const { state, source, target, events } = fixture();
    state.talents = ["burn.hearthfire", "burn.combustion"];
    hit(state, source, target, 8, "burn", events);
    expect(source.health).toBe(10); // Not Burning before the first hit
    expect(target.health).toBe(92);
    target.combat.poison = 2;
    hit(state, source, target, 8, "burn", events);
    expect(source.health).toBe(12); // Already Burning before the second hit
    expect(target.health).toBe(82); // 8 * 1.25 = 10 damage from Combustion
  });

  it("Frigid Current, Storm Surge, Living Water, and Spring Tide apply across Water hits and Cleanse", () => {
    const { state, source, target, events } = fixture();
    state.talents = ["water.frigid-current", "water.storm-surge", "water.living-water", "water.spring-tide"];
    state.battle!.mana = 1;
    target.combat.armor = 0;
    hit(state, source, target, 6, "water", events);
    expect(target.combat.freeze).toBe(3); // Half of 6 Water damage
    expect(source.health).toBe(12); // +2 Health against unarmored enemy
    expect(state.battle!.mana).toBe(1); // Not Stunned or Frozen yet

    target.combat.freeze = 0;
    target.combat.controlled = "stun";
    target.combat.controlTurns = 1;
    hit(state, source, target, 6, "water", events);
    expect(state.battle!.mana).toBe(2); // +1 Mana against Stunned enemy

    // Cleanse grants Spring Tide, which persists across save/resume and doubles the next Water card play
    const riverState = structuredClone(teamRun(42, ["coralcurl", "mossguard", "emberback"]));
    riverState.talents = [
      "water.pressure",
      "water.seafoam",
      "water.high-tide",
      "water.erosion",
      "water.cleansing-current",
      "water.riptide",
      "water.spring-tide",
    ];
    riverState.keywordXP.water = 100_000;
    const riverAlly = riverState.team[0]!;
    riverAlly.combat = { ...freshCombat(), poison: 2 };
    removeEffects(riverAlly, "cleanse", 1, [], riverState);
    expect(riverAlly.combat.springTide).toBe(true);
    const resumed = decodeSave(encodeSave(riverState));
    expect(resumed.team[0]!.combat?.springTide).toBe(true);
    const playable = structuredClone(resumed);
    const waterCard = playable.cards.find(
      (card) => card.ownerId === riverAlly.id && card.definitionId === "coralcurl-attack",
    )!;
    playable.battle!.hand = [waterCard.id];
    const played = dispatch(playable, {
      type: "play",
      cardId: waterCard.id,
      targetId: "enemy-0",
      autoEndTurn: false,
    });
    expect(played.accepted).toBe(true);
    expect(played.state.team[0]!.combat?.springTide).toBe(false);
    expect(
      played.events.filter((event) => event.kind === "damage" && event.damageType === "water"),
    ).toHaveLength(2);
  });
});
