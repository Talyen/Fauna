import { describe, it, expect } from "vitest";
import { produce } from "immer";
import { createGame, dispatch } from "../../src/game/engine";
import { decodeSave, encodeSave } from "../../src/game/save";
import { TALENTS, cardKeywords, talentPoints } from "../../src/game/progression";
import { actionValue } from "../../src/game/rules";
import { accept, run, winBattle, policy } from "./helpers";
describe("keyword progression and rewards", () => {
  it("awards keywords once per accepted play, banks once on victory, and never banks previews", () => {
    const s = run(),
      card = s.cards.find((c) => s.battle!.hand.includes(c.id))!;
    const keywords = cardKeywords(card);
    const def = card.definitionId.endsWith("teamGuard")
      ? undefined
      : card.definitionId.endsWith("attack") || card.definitionId.endsWith("mark")
        ? "enemy-0"
        : "ally-0";
    const result = dispatch(s, { type: "play", cardId: card.id, targetId: def });
    expect(result.accepted).toBe(true);
    expect(result.state.keywordXP).toEqual({});
    keywords.forEach((k) => expect(result.state.battleXP[k]).toBe(1));
    expect(dispatch(result.state, { type: "play", cardId: card.id, targetId: def }).accepted).toBe(false);
    const won = winBattle(result.state);
    expect(Object.values(won.battleXP)).toEqual([]);
    expect(Object.values(won.keywordXP).reduce((a, b) => a + b, 0)).toBe(2);
    const resumed = decodeSave(encodeSave(won));
    expect(resumed).toEqual(won);
    const next = accept(resumed, { type: "continueReward" });
    expect(next.keywordXP).toEqual(won.keywordXP);
    expect(dispatch(next, { type: "continueReward" }).accepted).toBe(false);
  });
  it("banks defeat and abandonment XP without a victory payout", () => {
    const defeat = produce(run(), (d) => {
      d.battleXP = { fire: 7 };
      d.team.forEach((c) => (c.health = 1));
      d.battle!.enemies.forEach((e) => (e.damage = 100));
    });
    let s = defeat;
    while (s.phase === "battle") s = accept(s, { type: "endTurn" });
    expect(s.keywordXP.fire).toBe(7);
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
  it("uses increasing per-keyword thresholds, gates rows, and resets a whole category without losing XP", () => {
    expect([19, 20, 59, 60, 119, 120].map(talentPoints)).toEqual([0, 1, 1, 2, 2, 3]);
    let s = produce(run(), (d) => {
      d.keywordXP = { fire: 420, block: 20 };
    });
    expect(dispatch(s, { type: "buyTalent", talentId: "fire.shelter" }).accepted).toBe(false);
    const actor = s.team.find((c) => c.species === "emberfox")!,
      card = s.cards.find((c) => c.definitionId === "emberfox-attack")!,
      base = actionValue(card, actor, s);
    s = accept(s, { type: "buyTalent", talentId: "fire.potency" });
    expect(actionValue(card, actor, s)).toBe(base + 1);
    expect(dispatch(s, { type: "buyTalent", talentId: "fire.potency" }).accepted).toBe(false);
    for (const t of TALENTS.filter((t) => t.keyword === "fire" && t.effect !== "potency"))
      s = accept(s, { type: "buyTalent", talentId: t.id });
    s = accept(s, { type: "buyTalent", talentId: "block.potency" });
    const xp = s.keywordXP;
    s = accept(s, { type: "resetTalents", keyword: "fire" });
    expect(s.keywordXP).toEqual(xp);
    expect(s.talents).toEqual(["block.potency"]);
    expect(actionValue(card, actor, s)).toBe(base);
    expect(decodeSave(encodeSave(s))).toEqual(s);
  });
  it("recruits only offered distinct species and preserves active choices across battles", () => {
    let s = accept(winBattle(), { type: "continueReward" });
    expect(dispatch(s, { type: "recruit", species: "silkmoth" }).accepted).toBe(false);
    s = accept(s, { type: "recruit", species: "briartooth" });
    expect(s.roster).toContain("briartooth");
    expect(s.team.map((c) => c.species)).toEqual(["mossback", "emberfox", "stormfin"]);
    expect(decodeSave(encodeSave(s))).toEqual(s);
    s = accept(s, { type: "skipRelic" });
    s = accept(s, { type: "swap", activeId: "ally-0", reserve: "briartooth" });
    expect(
      s.cards
        .filter((c) => c.ownerId === s.team[0]!.id)
        .every((c) => c.definitionId.startsWith("briartooth")),
    ).toBe(true);
    expect(dispatch(s, { type: "swap", activeId: "ally-0", reserve: "emberfox" }).accepted).toBe(false);
    s = accept(s, { type: "beginBattle" });
    expect(dispatch(s, { type: "swap", activeId: "ally-0", reserve: "mossback" }).accepted).toBe(false);
  });
  it("requires a replacement at five and can replace either deployed or reserved species", () => {
    for (const replace of ["mossback", "silkmoth"] as const) {
      let s = produce(accept(winBattle(), { type: "continueReward" }), (d) => {
        d.roster.push("silkmoth", "moonhart");
        d.reserves = ["silkmoth", "moonhart"].map((kind) => ({
          id: `recruit-${kind}`,
          species: kind as "silkmoth" | "moonhart",
          health: 20,
          block: 0,
          attacked: false,
        }));
        d.wins = 1;
        d.unlocked.push("moonhart");
      });
      expect(dispatch(s, { type: "recruit", species: "briartooth" }).accepted).toBe(false);
      expect(dispatch(s, { type: "recruit", species: "briartooth", replace: "briartooth" }).accepted).toBe(
        false,
      );
      s = accept(s, { type: "recruit", species: "briartooth", replace });
      expect(s.roster).toHaveLength(5);
      expect(new Set(s.roster).size).toBe(5);
      expect(s.roster).not.toContain(replace);
      expect(decodeSave(encodeSave(s))).toEqual(s);
    }
    const s = accept(winBattle(), { type: "continueReward" });
    expect(dispatch(s, { type: "recruit", species: "briartooth", replace: "mossback" }).accepted).toBe(false);
  });
  it("offers three unique unowned relics, commits one once, and applies opening effects only at battle start", () => {
    let s = accept(accept(winBattle(), { type: "continueReward" }), { type: "skipRecruit" });
    expect(s.phase).toBe("relic");
    expect(new Set(s.reward!.relics).size).toBe(3);
    const chosen = s.reward!.relics[0]!;
    s = accept(s, { type: "chooseRelic", relic: chosen });
    expect(s.relics).toEqual([chosen]);
    expect(dispatch(s, { type: "chooseRelic", relic: chosen }).accepted).toBe(false);
    s = produce(s, (d) => {
      d.relics = ["wind-feather", "river-shell"];
      d.keywordXP.fire = 420;
      d.talents = TALENTS.filter((t) => t.keyword === "fire").map((t) => t.id);
    });
    s = accept(s, { type: "beginBattle" });
    expect(s.battle!.hand).toHaveLength(6);
    expect(s.team.find((c) => c.species === "emberfox")!.block).toBe(5);
    s = accept(s, { type: "resetTalents", keyword: "fire" });
    expect(s.team.find((c) => c.species === "emberfox")!.block).toBe(5);
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
        s.phase = "relic";
      },
      (s: Record<string, unknown>) => {
        s.roster = ["mossback", "mossback", "emberfox"];
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
  const draft = accept(createGame(), { type: "draft", species: "mossback" });
  const ended = accept(draft, { type: "abandon" });
  expect(ended.selected).toEqual([]);
  expect(decodeSave(encodeSave(ended))).toEqual(ended);
});
it("awards a team-wide Block play once rather than once per recipient", () => {
  const s = produce(run(), (d) => {
    const card = d.cards.find((c) => c.definitionId === "mossback-teamGuard")!;
    d.battle!.hand = [card.id];
    d.battle!.draw = d.cards.filter((c) => c.id !== card.id).map((c) => c.id);
    d.battle!.discard = [];
  });
  const next = accept(s, { type: "play", cardId: s.battle!.hand[0]! });
  expect(next.battleXP.block).toBe(1);
  expect(next.team.every((c) => c.block === 5)).toBe(true);
});

it("preserves in-progress version-two upgrades while adding validated progression defaults", () => {
  const old = JSON.parse(encodeSave(run()));
  old.version = 2;
  old.cards[0].level = 2;
  for (const key of ["roster", "keywordXP", "battleXP", "talents", "currency", "relics", "reward"])
    delete old[key];
  const migrated = decodeSave(JSON.stringify(old));
  expect(migrated.version).toBe(5);
  expect(migrated.phase).toBe("battle");
  expect(migrated.roster).toEqual(migrated.team.map((c) => c.species));
  expect(migrated.cards[0]!.level).toBe(2);
  expect(decodeSave(encodeSave(migrated))).toEqual(migrated);
});
it("resolves talent followups once, without replaying opening grants on purchases or resets", () => {
  let s = produce(run(), (d) => {
    d.keywordXP.fire = 420;
    const card = d.cards.find((c) => c.definitionId === "emberfox-attack")!;
    d.battle!.hand = [card.id];
    d.battle!.draw = d.cards.filter((c) => c.id !== card.id).map((c) => c.id);
    d.battle!.discard = [];
    d.team[1]!.health = 20;
  });
  for (const talent of TALENTS.filter((t) => t.keyword === "fire"))
    s = accept(s, { type: "buyTalent", talentId: talent.id });
  expect(s.team[1]!.block).toBe(0);
  const result = dispatch(s, { type: "play", cardId: s.battle!.hand[0]!, targetId: "enemy-0" });
  expect(result.accepted).toBe(true);
  s = result.state;
  expect(s.battle!.enemies[0]!.health).toBe(6);
  expect(s.team[1]!.health).toBe(21);
  expect(s.team[1]!.block).toBe(2);
  expect(s.battleXP.fire).toBe(1);
  s = accept(s, { type: "resetTalents", keyword: "fire" });
  expect(s.team[1]!.health).toBe(21);
  expect(s.team[1]!.block).toBe(2);
});

it("final victory banks permanent rewards without offering recruitment or run-only relics", () => {
  let s = run();
  for (let i = 0; i < 3; i++) {
    s = winBattle(s);
    if (i < 2) {
      while (s.phase !== "teamSelection") s = accept(s, policy(s));
      s = accept(s, { type: "beginBattle" });
    }
  }
  expect(s.reward!.outcome).toBe("victory");
  expect(s.reward!.recruits).toEqual([]);
  expect(s.reward!.relics).toEqual([]);
  s = accept(s, { type: "continueReward" });
  expect(s.phase).toBe("victory");
});
it("swapping one creature preserves unchanged teammates' legacy cards", () => {
  let s = accept(accept(winBattle(), { type: "continueReward" }), { type: "recruit", species: "briartooth" });
  s = accept(s, { type: "skipRelic" });
  s = produce(s, (d) => {
    d.cards.find((c) => c.definitionId === "emberfox-attack")!.level = 2;
  });
  s = accept(s, { type: "swap", activeId: "ally-0", reserve: "briartooth" });
  expect(s.cards.find((c) => c.definitionId === "emberfox-attack")!.level).toBe(2);
  expect(decodeSave(encodeSave(s))).toEqual(s);
});
