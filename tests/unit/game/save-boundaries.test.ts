import { expect, it } from "vitest";
import { produce } from "immer";
import { createSession } from "../../../src/application/session";
import { dispatch } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { accept, bossReward, recruitChoice, starterJourney, winBattle } from "../../support/game";

it.each([
  { controlled: "stun" as const, controlTurns: 0 },
  { controlled: "freeze" as const, controlTurns: 0 },
  { controlled: null, controlTurns: 1 },
  { controlled: null, controlTurns: 2 },
])("rejects contradictory control duration %j", (patch) => {
  const state = accept(starterJourney(3, "captoad"), { type: "beginBattle" });
  const corrupt = produce(state, (draft) => {
    Object.assign(draft.team[0]!.combat!, patch);
  });
  expect(() => decodeSave(encodeSave(corrupt))).toThrow();
});

it.each([0, 1, 2])("round-trips a coherent control duration of %s", (turns) => {
  const state = accept(starterJourney(3, "captoad"), { type: "beginBattle" });
  const controlled = produce(state, (draft) => {
    Object.assign(draft.team[0]!.combat!, {
      controlled: turns ? "freeze" : null,
      controlTurns: turns,
    });
  });
  expect(decodeSave(encodeSave(controlled))).toEqual(controlled);
});

it("rejects a victory receipt presented as a returned journey", () => {
  const won = bossReward();
  const corrupt = produce(won, (draft) => {
    draft.phase = "defeat";
    if (draft.journey) draft.journey.outcome = "returned";
  });
  expect(() => decodeSave(encodeSave(corrupt))).toThrow();
  expect(decodeSave(encodeSave(accept(won, { type: "abandon" })))).toEqual(accept(won, { type: "abandon" }));
});

it.each([1, 14, 19, 21, 1000000])("rejects an impossible Merchant price of %s", (price) => {
  const won = winBattle(accept(starterJourney(3, "captoad"), { type: "beginBattle" }));
  const destinations = accept(won, recruitChoice(won));
  expect(destinations.support).not.toBeNull();
  expect(decodeSave(encodeSave(destinations))).toEqual(destinations);
  const corrupt = produce(destinations, (draft) => {
    draft.support!.stock[0]!.price = price;
  });
  expect(() => decodeSave(encodeSave(corrupt))).toThrow();
});

it("rejects a Merchant discount without Merchant's Favor", () => {
  const won = winBattle(accept(starterJourney(3, "captoad"), { type: "beginBattle" }));
  const destinations = accept(won, recruitChoice(won));
  const corrupt = produce(destinations, (draft) => {
    for (const slot of draft.support!.stock) slot.price = 13;
  });
  expect(() => decodeSave(encodeSave(corrupt))).toThrow();
});

it("keeps the committed full price when Favor is purchased from the current Merchant", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const won = winBattle(accept(starterJourney(seed, "captoad"), { type: "beginBattle" }));
    const destinations = accept(won, recruitChoice(won));
    const visit = destinations.support!;
    const favor = visit.stock.find((slot) => slot.boon === "merchants-favor");
    if (!favor) continue;
    const shopping = accept(destinations, { type: "enterSupport", visit: visit.id });
    const purchased = accept(shopping, { type: "buyBoon", visit: visit.id, slot: favor.slot });
    expect(purchased.support!.stock.every((slot) => slot.price === 20)).toBe(true);
    expect(decodeSave(encodeSave(purchased))).toEqual(purchased);
    return;
  }
  throw new Error("No seeded Merchant offered Favor");
});

it("rejects a final victory receipt on a Boon choice screen", () => {
  const destinations = produce(starterJourney(3, "captoad"), (draft) => {
    draft.encounter = 7;
    draft.journey!.victories = 7;
    draft.expedition!.pack = 0;
  });
  const battle = accept(destinations, { type: "beginBattle" });
  const won = dispatch(battle, { type: "devWinBattle" }, true).state;
  expect(decodeSave(encodeSave(won))).toEqual(won);
  const corrupt = produce(won, (draft) => {
    draft.phase = "boon";
    draft.journey!.outcome = null;
    draft.reward!.boons = ["bone-charm"];
  });
  expect(() => decodeSave(encodeSave(corrupt))).toThrow();
});

it.each(["control", "reward", "price"])(
  "silently recovers a backup after rejecting corrupt %s data",
  async (kind) => {
    const won = winBattle(accept(starterJourney(3, "captoad"), { type: "beginBattle" }));
    const good = kind === "reward" ? won : accept(won, recruitChoice(won));
    const corrupt = produce(good, (draft) => {
      if (kind === "control") {
        draft.team[0]!.combat!.controlled = "freeze";
        draft.team[0]!.combat!.controlTurns = 0;
      } else if (kind === "reward") {
        draft.phase = "defeat";
        draft.journey!.outcome = "returned";
      } else draft.support!.stock[0]!.price = 1;
    });
    const writes: string[] = [];
    const session = createSession({
      desktop: false,
      steam: { available: false },
      saves: {
        readCandidates: async () => [
          { source: "primary", data: encodeSave(corrupt) },
          { source: "backup", data: encodeSave(good) },
        ],
        write: async (data) => {
          writes.push(data);
        },
      },
    });
    try {
      await session.load();
      expect(session.store.getState().game).toEqual(good);
      expect(session.store.getState()).toMatchObject({ ready: true, error: "" });
      expect(writes).toEqual([]);
    } finally {
      await session.dispose();
    }
  },
);
