import fc from "fast-check";
import { expect, it } from "vitest";
import { createGame, dispatch } from "../../../src/game/engine";
import { availablePlays } from "../../../src/game/play-queries";
import { decodeSave, encodeSave } from "../../../src/game/save";
import type { Command, GameState } from "../../../src/game/types";
import { run } from "../../support/game";

// Select from current player choices rather than inventing arbitrary state snapshots.
function choices(state: GameState, autoEndTurn: boolean): Command[] {
  switch (state.phase) {
    case "draft":
      return state.starterOffers.length
        ? state.starterOffers.map((species) => ({ type: "draft", species }))
        : [{ type: "start" }];
    case "teamSelection":
      return [{ type: "beginBattle" }, { type: "visitCampfire" }];
    case "battle": {
      const fallen = state.team.find((unit) => unit.health <= 0);
      const swaps: Command[] = fallen
        ? state.reserves
            .filter((unit) => unit.health > 0)
            .map((unit) => ({ type: "swap", activeId: fallen.id, reserve: unit.id, autoEndTurn }))
        : [];
      return [
        ...swaps,
        ...availablePlays(state, autoEndTurn).flatMap((play) => play.commands),
        { type: "endTurn" },
      ];
    }
    case "recruit":
      return state.reward.selectedRecruit === undefined
        ? state.reward.recruits.map((species) => ({ type: "recruit", species }))
        : [
            { type: "confirmRecruit" },
            ...[...state.team, ...state.reserves].map((unit) => ({
              type: "confirmRecruit" as const,
              replace: unit.id,
            })),
          ];
    case "boon":
      return [
        ...state.reward.boons.map((boon) => ({ type: "chooseBoon" as const, boon })),
        { type: "skipBoon" },
      ];
    case "campfire":
      return [{ type: "rest" }, { type: "leaveCampfire" }];
    case "support":
      return [{ type: "leaveSupport", visit: state.support.id }];
    case "victory":
    case "defeat":
      return [{ type: "newRun", seed: state.rng }];
  }
}

it("preserves command and save contracts across generated player sequences", () => {
  const step = fc.record({ choice: fc.nat(), invalid: fc.boolean(), autoEndTurn: fc.boolean() });
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 0xffffffff }),
      fc.boolean(),
      fc.array(step, { minLength: 20, maxLength: 40 }),
      (seed, battle, steps) => {
        let state = battle ? run(seed) : createGame(seed);
        for (const { choice, invalid, autoEndTurn } of steps) {
          const options = choices(state, autoEndTurn);
          const command: Command =
            invalid || options.length === 0
              ? { type: "play", cardId: "missing-generated-card" }
              : options[choice % options.length]!;
          const before = encodeSave(state);
          const replay = decodeSave(before);
          const result = dispatch(state, command);
          const repeated = dispatch(replay, command);

          expect(encodeSave(state)).toBe(before);
          expect(repeated).toEqual(result);
          if (invalid || options.length === 0) expect(result.accepted).toBe(false);
          if (!result.accepted) {
            expect(result.state).toBe(state);
            expect(result.state.rng).toBe(state.rng);
            expect(result.events).toEqual([]);
          } else {
            expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
          }
          state = result.state;
        }
      },
    ),
    { seed: 741819, numRuns: 20 },
  );
});

it("rejects generated corruptions of valid draft and battle checkpoints", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 0xffffffff }),
      fc.integer({ min: 1, max: 1000000 }),
      fc.integer({ min: 0, max: 5 }),
      (seed, magnitude, corruption) => {
        const original = corruption < 3 ? createGame(seed) : run(seed);
        const raw = encodeSave(original);
        const data = JSON.parse(raw);
        switch (corruption) {
          case 0:
            data.revision = -magnitude;
            break;
          case 1:
            delete data.phase;
            break;
          case 2:
            data.starterOffers.push(data.starterOffers[0]);
            break;
          case 3:
            data.battle.enemies[0].targetId = `missing-${magnitude}`;
            break;
          case 4:
            data.cards = [];
            break;
          case 5:
            data.team[1].id = data.team[0].id;
            break;
        }
        expect(() => decodeSave(JSON.stringify(data))).toThrow();
        expect(decodeSave(raw)).toEqual(original);
      },
    ),
    { seed: 193501, numRuns: 30 },
  );
});
