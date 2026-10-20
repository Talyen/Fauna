import { freshCombat } from "../../src/game/combat";
import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { createGame, dispatch } from "../../src/game/engine";
import { INITIAL_SPECIES, species } from "../../src/game/content";
import { RELICS } from "../../src/game/progression";
import { decodeSave, encodeSave } from "../../src/game/save";
import { previewPlay } from "../../src/game/preview";
import { accept, run, winBattle, victoryReady, bossReward } from "./helpers";

function startedJourney() {
  return accept(accept(createGame(7), { type: "draft", species: "mossback" }), { type: "start" });
}

describe("journey earnings and results", () => {
  it("banks each battle once, skips acknowledgement, and retains a receipt through its choices", () => {
    let s = accept(startedJourney(), { type: "beginBattle" });
    s = produce(s, (d) => {
      d.battleXP = { nature: 4, block: 2 };
    });
    s = winBattle(s);
    expect(s.phase).toBe("recruit");
    expect(s.reward!.relics).toEqual([]);
    expect(s.journey!.victories).toBe(1);
    expect(s.journey!.currency).toBe(20);
    expect(s.journey!.xp).toEqual(s.reward!.xp);
    const receipt = s.journey!.lastBattle;
    expect(dispatch(s, { type: "skipRelic" }).state).toBe(s);
    s = accept(s, { type: "skipRecruit" });
    expect(s.phase).toBe("teamSelection");
    expect(s.reward).toBeNull();
    expect(s.journey!.lastBattle).toEqual(receipt);
    expect(decodeSave(encodeSave(s))).toEqual(s);
    s = accept(s, { type: "beginBattle" });
    expect(s.journey!.lastBattle).toBeNull();
  });

  it.each(["choose", "skip"])("intermediate bosses offer only relics and %s advances directly", (action) => {
    const reward = bossReward();
    expect(reward.phase).toBe("relic");
    expect(reward.reward!.recruits).toEqual([]);
    expect(reward.reward!.relics).toHaveLength(3);
    const chosen = reward.reward!.relics[0]!;
    const command =
      action === "choose" ? { type: "chooseRelic" as const, relic: chosen } : { type: "skipRelic" as const };
    const next = accept(reward, command);
    expect(next.phase).toBe("teamSelection");
    expect(next.expedition!.biome).toBe(1);
    expect(next.reward).toBeNull();
    expect(next.currency).toBe(reward.currency);
    expect(next.keywordXP).toEqual(reward.keywordXP);
    expect(next.relics).toEqual(action === "choose" ? [chosen] : []);
    expect(dispatch(next, command).accepted).toBe(false);
    expect(decodeSave(encodeSave(next))).toEqual(next);
  });

  it("skips the Reward screen when an intermediate boss has no available relic choices", () => {
    const ready = produce(bossReward(), (d) => {
      d.phase = "teamSelection";
      d.reward = null;
      d.battle = null;
      d.expedition!.chosen = null;
      d.relics = RELICS.map((relic) => relic.id);
    });
    const won = winBattle(accept(ready, { type: "beginBattle" }));
    expect(won.phase).toBe("teamSelection");
    expect(won.expedition!.biome).toBe(1);
    expect(won.reward).toBeNull();
    expect(decodeSave(encodeSave(won))).toEqual(won);
  });

  it("offers defeated creatures even when the roster already contains every species", () => {
    const started = startedJourney();
    const s = produce(run(), (d) => {
      d.expedition = started.expedition;
      d.journey = started.journey;
      d.roster = [...INITIAL_SPECIES];
      d.reserves = (["silkmoth", "briartooth"] as const).map((kind) => ({
        id: kind,
        species: kind as "silkmoth" | "briartooth",
        health: species(kind).health,
        block: 0,
        combat: freshCombat(),
        attacked: false,
      }));
      d.relics = RELICS.map((relic) => relic.id);
    });
    // Start from the committed pack so the saved battle receipt matches its destination.
    const battle = accept(
      { ...s, phase: "teamSelection", battle: null, expedition: { ...s.expedition!, chosen: null } },
      { type: "beginBattle" },
    );
    const ready = victoryReady(battle);
    const preview = previewPlay(ready, ready.battle!.hand[0]!, "enemy-0");
    expect(preview.state.battle!.enemies[0]!.health).toBe(0);
    expect(preview.state.phase).toBe("battle");
    expect(preview.state.journey!.currency).toBe(0);
    const won = winBattle(ready);
    expect(won.phase).toBe("recruit");
    expect(won.reward!.recruits).toEqual(battle.battle!.enemies.map((enemy) => enemy.species));
    expect(won.journey!.lastBattle!.currency).toBe(20);
    expect(decodeSave(encodeSave(won))).toEqual(won);
  });

  it("banks unfinished battle XP on return and preserves completed rewards without double counting", () => {
    let s = accept(startedJourney(), { type: "beginBattle" });
    s = produce(s, (d) => {
      d.battleXP = { nature: 3 };
    });
    const returned = accept(s, { type: "abandon" });
    expect(returned.phase).toBe("defeat");
    expect(returned.journey).toMatchObject({
      outcome: "returned",
      victories: 0,
      currency: 0,
      xp: { nature: 3 },
    });
    expect(decodeSave(encodeSave(returned))).toEqual(returned);
    const won = winBattle(s);
    const ended = accept(won, { type: "abandon" });
    expect(ended.journey!.xp).toEqual(won.journey!.xp);
    expect(ended.currency).toBe(won.currency);
    expect(decodeSave(encodeSave(ended))).toEqual(ended);
  });

  it("distinguishes defeat, keeps its XP, and awards no victory currency", () => {
    let s = accept(startedJourney(), { type: "beginBattle" });
    s = produce(s, (d) => {
      d.team[0]!.health = 1;
      d.battleXP = { block: 2 };
    });
    for (let turn = 0; turn < 20 && s.phase === "battle"; turn++) s = accept(s, { type: "endTurn" });
    expect(s.phase).toBe("defeat");
    expect(s.journey).toMatchObject({ outcome: "defeat", victories: 0, currency: 0, xp: { block: 2 } });
    expect(decodeSave(encodeSave(s))).toEqual(s);
  });

  it("retains complete totals and only new unlocks across saving; a new journey resets the summary", () => {
    let s = startedJourney();
    for (let i = 0; i < 8; i++) {
      s = winBattle(accept(s, { type: "beginBattle" }));
      if (s.phase === "recruit") s = accept(s, { type: "skipRecruit" });
      if (s.phase === "relic") s = accept(s, { type: "skipRelic" });
    }
    expect(s.phase).toBe("victory");
    expect(s.journey).toMatchObject({
      outcome: "victory",
      victories: 8,
      currency: 200,
      unlocks: ["moonhart"],
    });
    expect(s.journey!.xp).toEqual(
      Object.fromEntries(Object.entries(s.keywordXP).filter(([, value]) => value > 0)),
    );
    expect(decodeSave(encodeSave(s))).toEqual(s);
    const oldXP = s.keywordXP;
    s = accept(s, { type: "newRun", seed: 8 });
    expect(s.journey).toBeNull();
    expect(s.keywordXP).toEqual(oldXP);
    expect(s.currency).toBe(200);
    s = accept(accept(s, { type: "draft", species: "mossback" }), { type: "start" });
    expect(s.journey).toMatchObject({ outcome: null, victories: 0, currency: 0, xp: {}, unlocks: [] });
    for (let i = 0; i < 8; i++) {
      s = winBattle(accept(s, { type: "beginBattle" }));
      if (s.phase === "recruit") s = accept(s, { type: "skipRecruit" });
      if (s.phase === "relic") s = accept(s, { type: "skipRelic" });
    }
    expect(s.journey!.unlocks).toEqual([]);
    expect(s.journey!.currency).toBe(200);
    expect(s.currency).toBe(400);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])("rejects obsolete development save version %s", (version) => {
    expect(() => decodeSave(JSON.stringify({ ...startedJourney(), version }))).toThrow();
  });

  it("rejects summaries with impossible earnings, wins, unlocks, or outcomes", () => {
    const s = winBattle(accept(startedJourney(), { type: "beginBattle" }));
    for (const mutate of [
      (d: typeof s) => {
        d.journey!.currency = d.currency + 1;
      },
      (d: typeof s) => {
        d.journey!.xp.nature = (d.keywordXP.nature ?? 0) + 1;
      },
      (d: typeof s) => {
        d.journey!.victories = 8;
      },
      (d: typeof s) => {
        d.journey!.unlocks = ["moonhart"];
      },
      (d: typeof s) => {
        d.journey!.outcome = "victory";
      },
    ])
      expect(() => decodeSave(encodeSave(produce(s, mutate)))).toThrow();
  });

  it("reports only currency and XP retained when permanent progression reaches its cap", () => {
    let s = accept(startedJourney(), { type: "beginBattle" });
    s = produce(s, (d) => {
      d.currency = 999_995;
      d.keywordXP.nature = 999_999;
      d.battleXP.nature = 10;
    });
    s = winBattle(s);
    expect(s.currency).toBe(1_000_000);
    expect(s.journey!.currency).toBe(5);
    expect(s.journey!.xp.nature).toBe(1);
    expect(s.reward!.currency).toBe(5);
    expect(s.reward!.xp.nature).toBe(1);
    expect(decodeSave(encodeSave(s))).toEqual(s);
  });
});
