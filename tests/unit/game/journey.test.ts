import { chooseBattleCommand } from "../../../src/application/battle-policy";
import { freshCombat } from "../../../src/game/combat";
import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { createGame, dispatch } from "../../../src/game/engine";
import { FIRST_RUN_STARTERS, species } from "../../../src/game/content";
import { BOONS } from "../../../src/game/progression";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { previewPlay } from "../../../src/game/preview";
import {
  recruitChoice,
  accept,
  run,
  winBattle,
  victoryReady,
  bossReward,
  policy,
  FULL_JOURNEY_SEED,
} from "../../support/game";

function startedJourney() {
  return accept(accept(createGame(7), { type: "draft", species: createGame(7).starterOffers[0]! }), {
    type: "start",
  });
}

describe("journey earnings and results", () => {
  it("banks each battle once, skips acknowledgement, and retains a receipt through its choices", () => {
    let s = accept(startedJourney(), { type: "beginBattle" });
    s = produce(s, (d) => {
      d.battleXP = { nature: 4, block: 2 };
    });
    s = winBattle(s);
    expect(s.phase).toBe("recruit");
    expect(s.reward!.boons).toEqual([]);
    expect(s.journey!.victories).toBe(1);
    expect(s.journey!.currency).toBe(20);
    expect(s.journey!.xp).toEqual(s.reward!.xp);
    const receipt = s.journey!.lastBattle;
    expect(dispatch(s, { type: "skipBoon" }).state).toBe(s);
    s = accept(s, recruitChoice(s));
    expect(s.phase).toBe("teamSelection");
    expect(s.reward).toBeNull();
    expect(s.journey!.lastBattle).toEqual(receipt);
    expect(decodeSave(encodeSave(s))).toEqual(s);
    s = accept(s, { type: "beginBattle" });
    expect(s.journey!.lastBattle).toBeNull();
  });

  it.each(["choose", "skip"])("intermediate bosses offer only boons and %s advances directly", (action) => {
    const reward = bossReward();
    expect(reward.phase).toBe("boon");
    expect(reward.reward!.recruits).toEqual([]);
    expect(reward.reward!.boons).toHaveLength(3);
    const chosen = reward.reward!.boons[0]!;
    const command =
      action === "choose" ? { type: "chooseBoon" as const, boon: chosen } : { type: "skipBoon" as const };
    const next = accept(reward, command);
    expect(next.phase).toBe("teamSelection");
    expect(next.encounter).toBe(4);
    expect(next.reward).toBeNull();
    expect(next.currency).toBe(reward.currency);
    expect(next.keywordXP).toEqual(reward.keywordXP);
    expect(next.boons).toEqual(action === "choose" ? [chosen] : []);
    expect(dispatch(next, command).accepted).toBe(false);
    expect(decodeSave(encodeSave(next))).toEqual(next);
  });

  it("skips the Reward screen when an intermediate boss has no available boon choices", () => {
    const ready = produce(bossReward(), (d) => {
      d.phase = "teamSelection";
      d.reward = null;
      d.battle = null;
      d.boons = BOONS.map((boon) => boon.id);
    });
    const won = winBattle(accept(ready, { type: "beginBattle" }));
    expect(won.phase).toBe("teamSelection");
    expect(won.encounter).toBe(4);
    expect(won.reward).toBeNull();
    expect(decodeSave(encodeSave(won))).toEqual(won);
  });

  it("offers defeated creatures even when every species is already collected", () => {
    const started = startedJourney();
    const s = produce(run(), (d) => {
      d.expedition = started.expedition;
      d.journey = started.journey;
      d.discovery.encountered = [...FIRST_RUN_STARTERS];
      d.discovery.recruited = Object.fromEntries(FIRST_RUN_STARTERS.map((kind) => [kind, 1]));
      d.roster = [...d.team.map((unit) => unit.species), "pollenmoth", "captoad"];
      d.reserves = (["pollenmoth", "captoad"] as const).map((kind) => ({
        id: kind,
        species: kind,
        health: species(kind).health,
        block: 0,
        combat: freshCombat(),
        attacked: false,
      }));
      d.boons = BOONS.map((boon) => boon.id);
    });
    // Start from the committed pack so the saved battle receipt matches its encounter.
    const battle = accept(
      { ...s, phase: "teamSelection", battle: null, expedition: s.expedition },
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
    // The all-Boons fixture includes Smuggler's Map's +2 battle reward.
    expect(won.journey!.lastBattle!.currency).toBe(22);
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

  it("retains complete totals and the complete roster across saving; a new journey resets the summary", () => {
    let s = startedJourney();
    for (let i = 0; i < 8; i++) {
      s = winBattle(accept(s, { type: "beginBattle" }));
      if (s.phase === "recruit") s = accept(s, recruitChoice(s));
      if (s.phase === "boon") s = accept(s, { type: "skipBoon" });
    }
    expect(s.phase).toBe("victory");
    expect(s.journey).toMatchObject({
      outcome: "victory",
      victories: 8,
      currency: 200,
      unlocks: [],
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
    for (let pick = 0; pick < 3; pick++) s = accept(s, { type: "draft", species: s.starterOffers[0]! });
    s = accept(s, { type: "start" });
    expect(s.journey).toMatchObject({ outcome: null, victories: 0, currency: 0, xp: {}, unlocks: [] });
    for (let i = 0; i < 8; i++) {
      s = winBattle(accept(s, { type: "beginBattle" }));
      if (s.phase === "recruit") s = accept(s, recruitChoice(s));
      if (s.phase === "boon") s = accept(s, { type: "skipBoon" });
    }
    expect(s.journey!.unlocks).toEqual([]);
    expect(s.journey!.currency).toBe(200);
    expect(s.currency).toBe(400);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 13])("rejects obsolete development save version %s", (version) => {
    expect(() => decodeSave(JSON.stringify({ ...startedJourney(), version }))).toThrow();
  });

  it("rejects summaries with impossible earnings, wins, unlocks, or outcomes", () => {
    const s = winBattle(accept(startedJourney(), { type: "beginBattle" }));
    for (const mutate of [
      (d: typeof s) => {
        d.journey!.currency = 1_000_001;
      },
      (d: typeof s) => {
        d.journey!.xp.nature = (d.keywordXP.nature ?? 0) + 1;
      },
      (d: typeof s) => {
        d.journey!.victories = 8;
      },
      (d: typeof s) => {
        d.journey!.unlocks = ["prismram"];
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

it("completes the one-starter recruitment path through the final boss within the browser journey budget", () => {
  const initial = createGame(FULL_JOURNEY_SEED);
  let game = accept(accept(initial, { type: "draft", species: initial.starterOffers[0]! }), {
    type: "start",
  });
  for (let step = 0; step < 400 && game.phase !== "victory"; step++) {
    expect(game.phase).not.toBe("defeat");
    expect(game.reward?.outcome).not.toBe("defeat");
    const command =
      game.phase === "recruit" && game.roster.length < 5
        ? {
            type: "recruit" as const,
            species:
              game.reward!.recruits.find((kind) => !game.roster.includes(kind)) ?? game.reward!.recruits[0]!,
          }
        : game.phase === "battle"
          ? chooseBattleCommand(game)
          : policy(game);
    game = accept(game, command);
  }
  expect(game.phase).toBe("victory");
  expect(game.team).toHaveLength(3);
  expect(game.roster).toHaveLength(5);
  expect(decodeSave(encodeSave(game))).toEqual(game);
});
