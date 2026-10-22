import { describe, it, expect, vi } from "vitest";
import { produce } from "immer";
import { dispatch, previewCard } from "../../../src/game/engine";
import { encodeSave, decodeSave } from "../../../src/game/save";
import { chooseBattleCommand } from "../../../src/application/battle-policy";
import { createSession } from "../../../src/application/session";
import { observeUnlocks } from "../../../src/ui/expedition/unlock-reveals";
import { scheduleAutoplay } from "../../../src/ui/battle/autoplay";
import {
  prepareDestination,
  accept,
  run,
  victoryReady,
  bossReward,
  teamRun,
  recruitChoice,
} from "../../support/game";

describe("combat controls", () => {
  it("manual turn keeps zero Mana while preview never settles and victory still settles", () => {
    const state = produce(victoryReady(), (d) => {
      d.battle!.mana = 1;
    });
    const command = {
      type: "play" as const,
      cardId: state.battle!.hand[0]!,
      targetId: "enemy-0",
      autoEndTurn: false,
    };
    expect(previewCard(state, command.cardId, command.targetId).state.phase).toBe("battle");
    const won = dispatch(state, command);
    expect(won.accepted).toBe(true);
    expect(won.state.phase).toBe("recruit");
    const ordinary = produce(state, (d) => {
      d.battle!.enemies.forEach((e) => {
        e.health = e.maxHealth;
        e.combat.controlled = null;
        e.combat.controlTurns = 0;
      });
    });
    const manual = dispatch(ordinary, command).state;
    expect(manual.battle!.mana).toBe(0);
    expect(decodeSave(encodeSave(manual))).toEqual(manual);
    expect(manual.battle!.turn).toBe(ordinary.battle!.turn);
    expect(dispatch(ordinary, { ...command, autoEndTurn: true }).state.battle!.turn).toBe(
      ordinary.battle!.turn + 1,
    );
  });
  it("dev win is denied by default, settles once, preserves Health and banks actual XP", () => {
    const state = produce(run(), (d) => {
      d.battleXP = { physical: 3 };
      d.team[0]!.health = 9;
    });
    expect(dispatch(state, { type: "devWinBattle" }).state).toBe(state);
    const result = dispatch(state, { type: "devWinBattle" }, true);
    expect(result.state.phase).toBe("recruit");
    expect(result.state.team[0]!.health).toBe(9);
    expect(result.state.currency).toBe(20);
    expect(result.state.keywordXP.physical).toBe(3);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
    expect(dispatch(result.state, { type: "devWinBattle" }, true).accepted).toBe(false);
  });
  it("dev intermediate-boss victories offer normal boons and recovery swaps cannot cycle", () => {
    const defeated = bossReward();
    const ready = accept(
      produce(defeated, (draft) => {
        prepareDestination(draft);
      }),
      { type: "beginBattle" },
    );
    const won = dispatch(ready, { type: "devWinBattle" }, true);
    expect(won.state.phase).toBe("recruit");
    const reward = accept(won.state, recruitChoice(won.state));
    expect(reward.phase).toBe("boon");
    expect(reward.reward!.boons).toHaveLength(3);
    const state = produce(run(), (d) => {
      const reserve = d.team.pop()!;
      d.reserves = [reserve];
      d.team[0]!.health = 0;
    });
    const chosen = chooseBattleCommand(state);
    expect(chosen.type).toBe("swap");
    const swapped = dispatch(state, chosen);
    expect(swapped.accepted).toBe(true);
    expect(chooseBattleCommand(swapped.state).type).not.toBe("swap");
  });
  it("policy ignores hidden targets and never samples RNG", () => {
    const state = run();
    const hidden = produce(state, (d) => {
      d.rng = 999;
      d.battle!.draw.reverse();
      d.battle!.enemies.forEach((e) => {
        e.targetId = "hidden";
      });
    });
    expect(chooseBattleCommand(hidden)).toEqual(chooseBattleCommand(state));
    expect(dispatch(state, chooseBattleCommand(state)).accepted).toBe(true);
  });
  it("scores elemental finishers using visible bonuses without applying Physical armor to Fire", () => {
    const state = produce(teamRun(42, ["mossguard", "emberback", "prismram"]), (d) => {
      const fire = d.cards.find((card) => card.definitionId === "emberback-furnace-breath")!;
      const other = d.cards.find((card) => card.definitionId === "prismram-attack")!;
      d.battle!.hand = [other.id, fire.id];
      d.battle!.enemies.forEach((enemy, index) => {
        enemy.health = index === 0 ? 2 : index === 1 ? 1 : 1000;
        enemy.block = 0;
        enemy.combat.armor = index === 1 ? 0 : 100;
      });
    });
    expect(chooseBattleCommand(state)).toMatchObject({
      type: "play",
      cardId: "ally-1:emberback-furnace-breath",
    });
  });
  it("cancels even an already queued timer callback", () => {
    let callback = () => {};
    const action = vi.fn();
    const cancel = scheduleAutoplay(
      action,
      ((fn: () => void) => {
        callback = fn;
        return 1;
      }) as unknown as typeof setTimeout,
      vi.fn(),
    );
    cancel();
    callback();
    expect(action).not.toHaveBeenCalled();
  });
  it("does not reveal a retired victory unlock or replay completed checkpoints", async () => {
    const starting = accept(
      produce(run(), (d) => {
        d.journey = { outcome: null, victories: 7, currency: 0, xp: {}, unlocks: [], lastBattle: null };
        d.encounter = 7;
        d.journey!.victories = d.encounter;
        prepareDestination(d);
        d.expedition = { pack: 0, recruit: null, lastRoom: null };
      }),
      { type: "beginBattle" },
    );
    const platform = {
      desktop: false,
      steam: { available: false },
      saves: {
        readCandidates: async () => [{ source: "primary" as const, data: encodeSave(starting) }],
        write: async () => {},
      },
    };
    expect(decodeSave(encodeSave(starting))).toEqual(starting);
    const session = createSession(platform, 1, { development: true });
    await session.load();
    const reveal = vi.fn();
    const stop = observeUnlocks(session, reveal);
    expect(session.command({ type: "devWinBattle" })).toBe(true);
    expect(reveal).not.toHaveBeenCalled();
    const completed = encodeSave(session.store.getState().game);
    stop();
    await session.dispose();
    const restored = createSession({
      ...platform,
      saves: {
        ...platform.saves,
        readCandidates: async () => [{ source: "primary" as const, data: completed }],
      },
    });
    const replay = vi.fn();
    const cleanup = observeUnlocks(restored, replay);
    await restored.load();
    expect(replay).not.toHaveBeenCalled();
    cleanup();
    await restored.dispose();
  });
});
