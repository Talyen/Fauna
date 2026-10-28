import { createBattleActor } from "../../../src/application/battle-actor";
import { freshCombat } from "../../../src/game/combat/index";
import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { createGame, dispatch } from "../../../src/game/engine";
import { SPECIES, species, speciesCards, BOONS } from "../../../src/game/content";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { starterCount } from "../../../src/game/progression";
import { previewCard } from "../../../src/game/engine";
import {
  prepareDestination,
  completeRecruitment,
  accept,
  run,
  winBattle,
  victoryReady,
  bossReward,
  policy,
  FULL_JOURNEY_SEED,
  FULL_JOURNEY_COMMAND_BUDGET,
  fullJourneyRecruit,
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
    s = completeRecruitment(s);
    expect(s.phase).toBe("teamSelection");
    expect(s.reward).toBeNull();
    expect(s.journey!.lastBattle).toEqual(receipt);
    expect(decodeSave(encodeSave(s))).toEqual(s);
    s = accept(s, { type: "beginBattle" });
    expect(s.journey!.lastBattle).toBeNull();
  });

  it.each(["choose", "skip"])(
    "intermediate bosses offer boons after recruitment and %s advances directly",
    (action) => {
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
    },
  );

  it("finishes Boss rewards after recruitment when no Boons remain", () => {
    const ready = produce(bossReward(), (d) => {
      prepareDestination(d);
      d.reward = null;
      d.battle = null;
      d.boons = BOONS.map((boon) => boon.id);
    });
    const recruit = winBattle(accept(ready, { type: "beginBattle" }));
    expect(recruit.phase).toBe("recruit");
    const won = completeRecruitment(recruit);
    expect(won.phase).toBe("teamSelection");
    expect(won.encounter).toBe(4);
    expect(won.reward).toBeNull();
    expect(decodeSave(encodeSave(won))).toEqual(won);
  });

  it("offers defeated creatures even when every species is already collected", () => {
    const started = startedJourney();
    const s = produce(run(), (d) => {
      d.encounter = started.encounter;
      d.expedition = started.expedition;
      d.journey = started.journey;
      d.discovery.encountered = SPECIES.map((entry) => entry.id);
      d.discovery.recruited = Object.fromEntries(SPECIES.map((entry) => [entry.id, 1]));

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
      produce(s, (draft) => {
        prepareDestination(draft);
      }),
      { type: "beginBattle" },
    );
    const ready = victoryReady(battle);
    const preview = previewCard(ready, ready.battle!.hand[0]!, "enemy-0");
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
      d.team[0]!.combat!.deathDoorUsed = true;
      d.battle!.enemies[0]!.species = "emberback";
      d.battle!.enemies[0]!.power = 100;
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
      if (s.phase === "recruit") s = completeRecruitment(s);
      if (s.phase === "boon") s = accept(s, { type: "skipBoon" });
    }
    expect(s.phase).toBe("victory");
    expect(s.journey).toMatchObject({
      outcome: "victory",
      victories: 8,
      currency: 200,
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
    // The battle-finishing fixture needs an attacking starter, rather than a solo support Legendary.
    const attacker = s.starterOffers.find((kind) =>
      speciesCards(kind).some((card) => card.effect === "attack"),
    )!;
    s = accept(s, { type: "draft", species: attacker });
    while (s.selected.length < starterCount(s))
      s = accept(s, { type: "draft", species: s.starterOffers[0]! });
    s = accept(s, { type: "start" });
    expect(s.journey).toMatchObject({ outcome: null, victories: 0, currency: 0, xp: {} });
    for (let i = 0; i < 8; i++) {
      s = winBattle(accept(s, { type: "beginBattle" }));
      if (s.phase === "recruit") s = completeRecruitment(s);
      if (s.phase === "boon") s = accept(s, { type: "skipBoon" });
    }
    expect(s.journey!.currency).toBe(200);
    expect(s.currency).toBe(400);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 13])("rejects obsolete development save version %s", (version) => {
    expect(() => decodeSave(JSON.stringify({ ...startedJourney(), version }))).toThrow();
  });

  it("rejects summaries with impossible earnings, wins, or outcomes", () => {
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

it(
  "deterministically replays the complete one-starter journey through the final boss within the browser budget",
  () => {
    const actor = createBattleActor();
    const initial = createGame(FULL_JOURNEY_SEED);
    let game = accept(accept(initial, { type: "draft", species: initial.starterOffers[0]! }), {
      type: "start",
    });
    let replay = game;
    let deployedThree = false;
    for (let step = 0; step < FULL_JOURNEY_COMMAND_BUDGET && game.phase !== "victory"; step++) {
      deployedThree ||= game.team.length === 3;
      expect(game.phase).not.toBe("defeat");
      expect(game.reward?.outcome).not.toBe("defeat");
      const command =
        game.phase === "recruit"
          ? fullJourneyRecruit(game)
          : game.phase === "battle"
            ? actor.choose(game).command
            : policy(game);
      game = accept(game, command);
      replay = accept(replay, command);
      expect(replay).toEqual(game);
      expect(decodeSave(encodeSave(game))).toEqual(game);
    }
    expect(game.phase).toBe("victory");
    expect(deployedThree).toBe(true);
    // Replacing a solo Legendary can leave one ordinary creature deployed; reserves stay on the roster.
    expect(game.team.length).toBeGreaterThanOrEqual(1);
    expect(game.team.length).toBeLessThanOrEqual(3);
    if (game.team.some((unit) => species(unit.species).legendary)) expect(game.team).toHaveLength(1);
    expect([...game.team, ...game.reserves].map((unit) => unit.species)).toHaveLength(5);
    expect(decodeSave(encodeSave(game))).toEqual(game);
  },
  ciTimeout(20_000),
);

function ciTimeout(ms: number) {
  return process.env.CI ? 0 : ms;
}
