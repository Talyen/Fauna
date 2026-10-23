import {
  prepareDestination,
  swapFixture,
  completeRecruitment,
  teamRun,
  accept,
  run,
  winBattle,
  bossReward,
} from "../../support/game";
import { freshCombat } from "../../../src/game/combat/index";
import { describe, it, expect } from "vitest";
import { produce } from "immer";
import { createGame, dispatch } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { cardKeywords, talentPoints } from "../../../src/game/progression";
import { cardCost } from "../../../src/game/ability-rules";
import { previewPlay } from "../../../src/game/preview";
describe("keyword progression and rewards", () => {
  it("awards keywords once per accepted play, banks once on victory, and never banks previews", () => {
    const s = run(),
      card = s.cards.find((c) => s.battle!.hand.includes(c.id))!;
    const keywords = cardKeywords(card);
    const def = card.definitionId.endsWith("teamGuard")
      ? undefined
      : card.definitionId.endsWith("attack")
        ? "enemy-0"
        : "ally-0";
    const before = encodeSave(s);
    const preview = previewPlay(s, card.id, def);
    expect(preview.accepted).toBe(true);
    expect(preview.state.keywordXP).toEqual({});
    expect(previewPlay(s, card.id, def)).toEqual(preview);
    expect(encodeSave(s)).toBe(before);
    const result = dispatch(s, { type: "play", cardId: card.id, targetId: def });
    expect(result.accepted).toBe(true);
    expect(result.state.keywordXP).toEqual({});
    keywords.forEach((k) => expect(result.state.battleXP[k]).toBe(1));
    const repeated = dispatch(result.state, { type: "play", cardId: card.id, targetId: def });
    expect(repeated.accepted).toBe(false);
    expect(repeated.state).toBe(result.state);
    expect(repeated.events).toEqual([]);
    const won = winBattle(result.state);
    expect(Object.values(won.battleXP)).toEqual([]);
    expect(Object.values(won.keywordXP).reduce((a, b) => a + b, 0)).toBe(
      keywords.length + cardKeywords({ definitionId: "mossguard-attack" }).length,
    );
    const resumed = decodeSave(encodeSave(won));
    expect(resumed).toEqual(won);
    const next = completeRecruitment(resumed);
    expect(next.keywordXP).toEqual(won.keywordXP);
    expect(dispatch(next, { type: "skipBoon" }).accepted).toBe(false);
  });
  it("banks defeat and abandonment XP without a victory payout", () => {
    const defeat = produce(run(), (d) => {
      d.battleXP = { burn: 7 };
      d.team.forEach((c) => (c.health = 1));
      d.battle!.enemies.forEach((e) => (e.power = 100));
    });
    let s = defeat;
    for (let turn = 0; turn < 100 && s.phase === "battle"; turn++) s = accept(s, { type: "endTurn" });
    expect(s.phase).toBe("defeat");
    expect(s.keywordXP.burn).toBe(7);
    expect(s.currency).toBe(0);
    expect(s.reward!.outcome).toBe("defeat");
    const ended = accept(
      produce(run(), (d) => {
        d.battleXP = { block: 4 };
      }),
      { type: "abandon" },
    );
    expect(ended.keywordXP.block).toBe(4);
    expect(ended.battleXP).toEqual({});
    expect(decodeSave(encodeSave(ended))).toEqual(ended);
  });
  it("buys either talent first, enforces category budgets, and resets without losing XP", () => {
    expect([9, 10, 39, 40, 99, 100].map(talentPoints)).toEqual([0, 1, 1, 2, 2, 3]);
    let s = produce(run(), (d) => {
      d.keywordXP = { burn: 40, block: 10 };
    });
    const card = s.cards.find((c) => c.definitionId === "emberback-furnace-breath")!;
    expect(cardCost(card, s)).toBe(1);
    s = accept(s, { type: "buyTalent", talentId: "burn.melting-point" });
    s = accept(s, { type: "buyTalent", talentId: "burn.flashpoint" });
    expect(cardCost(card, s)).toBe(0);
    expect(dispatch(s, { type: "buyTalent", talentId: "burn.flashpoint" }).accepted).toBe(false);
    expect(dispatch(s, { type: "buyTalent", talentId: "burn.potency" }).accepted).toBe(false);
    s = accept(s, { type: "buyTalent", talentId: "block.second-wind" });
    expect(dispatch(s, { type: "buyTalent", talentId: "block.grounding" }).accepted).toBe(false);
    const xp = s.keywordXP;
    s = accept(s, { type: "resetTalents", keyword: "burn" });
    expect(s.keywordXP).toEqual(xp);
    expect(s.talents).toEqual(["block.second-wind"]);
    expect(cardCost(card, s)).toBe(1);
    expect(decodeSave(encodeSave(s))).toEqual(s);
  });
  it("recruits only offered species and preserves active choices across battles", () => {
    let s = winBattle();
    expect(dispatch(s, { type: "recruit", species: "prismram" }).accepted).toBe(false);
    s = accept(s, { type: "recruit", species: "emberback" });
    expect([...s.team, ...s.reserves].map((unit) => unit.species)).toContain("emberback");
    expect(s.team.map((c) => c.species)).toEqual(["mossguard", "emberback", "prismram"]);
    expect(decodeSave(encodeSave(s))).toEqual(s);
    s = swapFixture(s, {
      type: "swap",
      activeId: "ally-0",
      reserve: s.reserves.find((c) => c.species === "emberback")!.id,
    });
    expect(
      s.cards.filter((c) => c.ownerId === s.team[0]!.id).every((c) => c.definitionId.startsWith("emberback")),
    ).toBe(true);
    expect(dispatch(s, { type: "swap", activeId: "ally-0", reserve: "ally-1" }).accepted).toBe(false);
    s = accept(s, { type: "beginBattle" });
    expect(dispatch(s, { type: "swap", activeId: "ally-0", reserve: "ally-0" }).accepted).toBe(false);
  });
  it("confirms either deployed or reserved replacements after committing recruitment", () => {
    for (const replace of ["ally-0", "recruit-pollenmoth"] as const) {
      let s = produce(winBattle(), (d) => {
        d.reserves = ["pollenmoth", "prismram"].map((kind) => ({
          id: `recruit-${kind}`,
          species: kind as "pollenmoth" | "prismram",
          health: 20,
          block: 0,
          combat: freshCombat(),
          attacked: false,
        }));
        d.wins = 1;
      });
      expect(dispatch(s, { type: "confirmRecruit" }).accepted).toBe(false);
      s = accept(s, { type: "recruit", species: "emberback" });
      expect(dispatch(s, { type: "confirmRecruit", replace: "emberback" }).accepted).toBe(false);
      const released = [...s.team, ...s.reserves].find((c) => c.id === replace)!.species;
      s = accept(s, { type: "confirmRecruit", replace });
      expect([...s.team, ...s.reserves].map((unit) => unit.species)).toHaveLength(5);
      expect(new Set([...s.team, ...s.reserves].map((c) => c.id)).size).toBe(5);
      expect([...s.team, ...s.reserves].map((unit) => unit.species)).not.toContain(released);
      expect(decodeSave(encodeSave(s))).toEqual(s);
    }
    const s = winBattle();
    expect(dispatch(s, { type: "confirmRecruit", replace: "mossguard" }).accepted).toBe(false);
  });
  it("offers three unique unowned boons, commits one once, and applies opening effects only at battle start", () => {
    let s = bossReward();
    expect(s.phase).toBe("boon");
    expect(new Set(s.reward!.boons).size).toBe(3);
    const chosen = s.reward!.boons[0]!;
    s = accept(s, { type: "chooseBoon", boon: chosen });
    expect(s.boons).toEqual([chosen]);
    expect(dispatch(s, { type: "chooseBoon", boon: chosen }).accepted).toBe(false);
    s = produce(s, (d) => {
      d.boons = ["tattered-pages", "ironwood-buckler"];
      d.keywordXP.armor = 40;
      d.talents = ["armor.bulwark"];
    });
    s = accept(s, { type: "beginBattle" });
    expect(s.battle!.hand).toHaveLength(5);
    expect(s.battle!.buffer).toHaveLength(0);
    expect(s.team.find((c) => c.species === "emberback")!.combat!.armor).toBe(2);
    s = accept(s, { type: "resetTalents", keyword: "armor" });
    expect(s.team.find((c) => c.species === "emberback")!.combat!.armor).toBe(2);
    expect(decodeSave(encodeSave(s))).toEqual(s);
  });
  it("rejects unknown/prototype map keys, invalid row purchases, and malformed receipts", () => {
    for (const change of [
      (s: Record<string, unknown>) => {
        s.keywordXP = { constructor: 100 };
      },
      (s: Record<string, unknown>) => {
        s.talents = ["fire.opening"];
        s.keywordXP = { fire: 420 };
      },
      (s: Record<string, unknown>) => {
        s.phase = "boon";
      },
    ]) {
      const data = JSON.parse(encodeSave(run()));
      change(data);
      expect(() => decodeSave(JSON.stringify(data))).toThrow();
    }
    expect(dispatch(createGame(), { type: "buyTalent", talentId: "constructor" }).accepted).toBe(false);
  });
});

it("can end a partially completed draft without breaking save invariants", () => {
  const draft = accept(createGame(), { type: "draft", species: createGame().starterOffers[0]! });
  const ended = accept(draft, { type: "abandon" });
  expect(ended.selected).toEqual([]);
  expect(decodeSave(encodeSave(ended))).toEqual(ended);
});
it("awards a team-wide Block play once rather than once per recipient", () => {
  const s = produce(teamRun(42, ["mossguard", "emberback", "pollenmoth"]), (d) => {
    const card = d.cards.find((c) => c.definitionId === "pollenmoth-teamGuard")!;
    d.battle!.hand = [card.id];
    d.battle!.draw = d.cards.filter((c) => c.id !== card.id).map((c) => c.id);
    d.battle!.discard = [];
  });
  const next = accept(s, { type: "play", cardId: s.battle!.hand[0]! });
  expect(next.battleXP.block).toBe(1);
  expect(next.team.every((c) => c.block === 2)).toBe(true);
});

it("consumes Flashpoint once and does not refresh it on talent reset or resume", () => {
  let s = produce(run(), (d) => {
    d.keywordXP.burn = 40;
    d.talents = ["burn.flashpoint"];
    const card = d.cards.find((c) => c.definitionId === "emberback-furnace-breath")!;
    d.battle!.hand = [card.id];
    d.battle!.draw = d.cards.filter((c) => c.id !== card.id).map((c) => c.id);
    d.battle!.discard = [];
  });
  const card = s.cards.find((c) => c.definitionId === "emberback-furnace-breath")!;
  s = accept(s, { type: "play", cardId: card.id, targetId: "enemy-0", autoEndTurn: false });
  expect(s.battle!.mana).toBe(4);
  expect(s.battle!.freeBurnUsed).toBe(true);
  expect(s.battleXP.burn).toBe(1);
  s = accept(s, { type: "resetTalents", keyword: "burn" });
  s = accept(s, { type: "buyTalent", talentId: "burn.flashpoint" });
  expect(cardCost(card, s)).toBe(1);
  expect(decodeSave(encodeSave(s))).toEqual(s);
});

it("final victory banks rewards once before recruitment and offers no run-only Boons", () => {
  const ready = produce(run(), (draft) => {
    draft.encounter = 7;
    prepareDestination(draft);
    draft.expedition = { pack: ["memento"], recruit: null, lastRoom: null };
  });
  let s = winBattle(accept(ready, { type: "beginBattle" }));
  expect(s.reward!.outcome).toBe("victory");
  expect(s.phase).toBe("recruit");
  expect(s.reward!.recruits).toEqual(["memento"]);
  expect(s.reward!.boons).toEqual([]);
  expect(decodeSave(encodeSave(s))).toEqual(s);
  const banked = { currency: s.currency, keywordXP: s.keywordXP, wins: s.wins };
  s = completeRecruitment(s);
  expect(s.phase).toBe("victory");
  expect({ currency: s.currency, keywordXP: s.keywordXP, wins: s.wins }).toEqual(banked);
  expect(decodeSave(encodeSave(s))).toEqual(s);
});
it("swapping one creature preserves unchanged teammates' legacy cards", () => {
  let s = accept(winBattle(), { type: "recruit", species: "emberback" });
  s = produce(s, (d) => {
    d.cards.find((c) => c.definitionId === "emberback-furnace-breath")!.level = 2;
  });
  s = swapFixture(s, {
    type: "swap",
    activeId: "ally-0",
    reserve: s.reserves.find((c) => c.species === "emberback")!.id,
  });
  expect(
    s.cards.find((c) => c.definitionId === "emberback-furnace-breath" && c.ownerId === "ally-1")!.level,
  ).toBe(2);
  expect(decodeSave(encodeSave(s))).toEqual(s);
});
