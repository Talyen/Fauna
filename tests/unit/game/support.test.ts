import { expect, it } from "vitest";
import type { GameState } from "../../../src/game/types";
import { produce } from "immer";
import { BOONS } from "../../../src/game/content";
import { createGame, dispatch } from "../../../src/game/engine";
import { encodeSave, decodeSave } from "../../../src/game/save";
import {
  recruitChoice,
  accept,
  winBattle,
  merchantDestination as merchant,
  completeRecruitment,
} from "../../support/game";
it("saves an atomic purchase, rejects repeats and progresses to fresh destinations", () => {
  const s = merchant();
  const v = s.support!;
  const entered = accept(s, { type: "enterSupport", visit: v.id });
  const bought = accept(entered, { type: "buyBoon", visit: v.id, slot: v.stock[0]!.slot });
  expect(bought.currency).toBe(s.currency - v.stock[0]!.price);
  expect(bought.rng).toBe(entered.rng);
  expect(bought.journey!.currency).toBe(20);
  expect(decodeSave(encodeSave(bought))).toEqual(bought);
  expect(dispatch(bought, { type: "buyBoon", visit: v.id, slot: v.stock[1]!.slot }).state).toBe(bought);
  const left = accept(bought, { type: "leaveSupport", visit: v.id });
  expect(left.expedition!.lastRoom).toBe("merchant");
  expect(left.encounter).toBe(s.encounter);
  expect(left.rng).not.toBe(bought.rng);
  expect(left.expedition!.pack).not.toBe(s.expedition!.pack);
  expect(left.support).toBeNull();
  expect(decodeSave(encodeSave(left))).toEqual(left);
  expect(dispatch(left, { type: "enterSupport", visit: v.id }).state).toBe(left);
});
it("rejects stale and unaffordable purchases without changing state or RNG", () => {
  const s = merchant();
  const entered = accept(s, { type: "enterSupport", visit: s.support!.id });
  const purchase = {
    type: "buyBoon" as const,
    visit: entered.support!.id,
    slot: entered.support!.stock[0]!.slot,
  };
  expect(dispatch(entered, purchase).accepted).toBe(true);
  for (const command of [
    { ...purchase, visit: `${purchase.visit}-stale` },
    { ...purchase, slot: "constructor" },
  ]) {
    const result = dispatch(entered, command);
    expect(result.accepted).toBe(false);
    expect(result.state).toBe(entered);
    expect(result.events).toEqual([]);
  }
  const poor = produce(entered, (d) => {
    d.currency = 0;
  });
  const rejected = dispatch(poor, purchase);
  expect(rejected.accepted).toBe(false);
  expect(rejected.state).toBe(poor);
  expect(rejected.events).toEqual([]);
});
it("can roll no Merchant after an ordinary victory", () => {
  let s: GameState = merchant();
  s = winBattle(accept(s, { type: "beginBattle" }));
  s = accept(
    produce(s, (draft) => {
      draft.rng = 0;
    }),
    recruitChoice(s),
  );
  expect(s.encounter).toBe(2);
  expect(s.support).toBeNull();
  expect(decodeSave(encodeSave(s))).toEqual(s);
});
it("preserves eight battles after Merchant purchases", () => {
  let s: GameState = merchant();
  for (let i = 1; i < 8; i++) {
    if (s.support?.kind === "merchant" && s.support.stock.some((slot) => slot.price <= s.currency)) {
      s = accept(s, { type: "enterSupport", visit: s.support.id });
      s = accept(s, {
        type: "buyBoon",
        visit: s.support!.id,
        slot: s.support!.stock.find((slot) => slot.price <= s.currency)!.slot,
      });
      s = accept(s, { type: "leaveSupport", visit: s.support!.id });
    }
    s = winBattle(accept(s, { type: "beginBattle" }));
    if (s.phase === "recruit") s = completeRecruitment(s);
    if (s.phase === "boon") {
      expect(s.reward!.boons.length).toBeGreaterThan(0);
      s = accept(s, { type: "chooseBoon", boon: s.reward!.boons[0]! });
    }
    expect(decodeSave(encodeSave(s))).toEqual(s);
  }
  expect(s.journey!.victories).toBe(8);
});
it("keeps Merchant stock and combat offers through Campfire rest and reload", () => {
  let s: GameState = produce(merchant(), (d) => {
    d.team[0]!.health = 0;
  });
  const route = s.expedition,
    visit = s.support;
  s = accept(s, { type: "visitCampfire" });
  s = decodeSave(encodeSave(s));
  s = accept(s, { type: "rest" });
  expect(s.expedition).toEqual({ ...route, lastRoom: "campfire" });
  expect(s.support).toEqual(visit);
  expect(decodeSave(encodeSave(s))).toEqual(s);
  expect(accept(s, { type: "enterSupport", visit: visit!.id }).phase).toBe("support");
});
it.each([-1, 0])("checks the cheapest committed price at affordability offset %s", (offset) => {
  const ready = merchant();
  const gold = Math.min(...ready.support!.stock.map((slot) => slot.price)) + offset;
  const s = produce(ready, (d) => {
    d.currency = gold;
  });
  const result = dispatch(s, { type: "enterSupport", visit: s.support!.id });
  expect(result.accepted).toBe(offset >= 0);
  if (!result.accepted) expect(result.state).toBe(s);
});
it("rejects obsolete saves and retired Spring visits", () => {
  const s = merchant();
  expect(() => decodeSave(JSON.stringify({ ...s, version: 14 }))).toThrow();
  expect(() => decodeSave(JSON.stringify({ ...s, support: { ...s.support, kind: "spring" } }))).toThrow();
});

it.each([BOONS.length - 2, BOONS.length - 1, BOONS.length])(
  "offers every remaining boss Boon when an explicit checkpoint owns %s Boons",
  (owned) => {
    let s: GameState = merchant();
    for (let i = 0; i < 2; i++) {
      s = winBattle(accept(s, { type: "beginBattle" }));
      s = completeRecruitment(s);
    }
    // Explicit loadout fixture; these Boons are not claimed as earned purchases.
    s = produce(s, (d) => {
      d.boons = BOONS.slice(0, owned).map((b) => b.id);
    });
    s = winBattle(accept(s, { type: "beginBattle" }));
    expect(s.phase).toBe("recruit");
    expect(decodeSave(encodeSave(s))).toEqual(s);
    s = completeRecruitment(s);
    expect(s.phase).toBe(owned === BOONS.length ? "teamSelection" : "boon");
    if (owned < BOONS.length) expect(s.reward!.boons).toHaveLength(BOONS.length - owned);
    expect(decodeSave(encodeSave(s))).toEqual(s);
  },
);
it("discounts each new Merchant with Favor and persists the paid price", () => {
  let state: GameState = merchant();
  state = produce(state, (draft) => {
    draft.boons = ["merchants-favor"];
  });
  // Stock is already committed. Favor applies when the next Merchant is prepared.
  for (let battle = 0; battle < 4; battle++) {
    state = winBattle(accept(state, { type: "beginBattle" }));
    if (state.phase === "recruit") {
      // Fix the preparation roll; this test owns pricing rather than event frequency.
      if (battle === 3)
        state = produce(state, (draft) => {
          draft.rng = 10;
        });
      state = completeRecruitment(state);
    }
    if (state.phase === "boon") state = accept(state, { type: "skipBoon" });
  }
  expect(state.support!.stock.every((slot) => slot.price >= 13 && slot.price <= 33)).toBe(true);
  const price = state.support!.stock[0]!.price;
  const before = state.currency;
  state = accept(state, { type: "enterSupport", visit: state.support!.id });
  state = accept(state, { type: "buyBoon", visit: state.support!.id, slot: state.support!.stock[0]!.slot });
  expect(state.currency).toBe(before - price);
  expect(decodeSave(encodeSave(state))).toEqual(state);
});
it("adds Smuggler's Map to the settled reward once without duplicating combat earnings", () => {
  let state = produce(
    accept(accept(createGame(7), { type: "draft", species: createGame(7).starterOffers[0]! }), {
      type: "start",
    }),
    (draft) => {
      draft.boons = ["smugglers-map"];
    },
  );
  state = winBattle(accept(state, { type: "beginBattle" }));
  expect(state.currency).toBe(22);
  expect(state.reward!.currency).toBe(22);
  expect(state.journey!.currency).toBe(22);
  state = accept(decodeSave(encodeSave(state)), recruitChoice(state));
  expect(state.currency).toBe(22);
});

it("leaves Campfire without healing or changing the encounter and rejects leaving elsewhere", () => {
  const before = produce(merchant(), (draft) => {
    draft.team[0]!.health = 0;
  });
  expect(dispatch(before, { type: "leaveCampfire" }).state).toBe(before);
  const visiting = accept(before, { type: "visitCampfire" });
  const left = accept(decodeSave(encodeSave(visiting)), { type: "leaveCampfire" });
  expect(left.phase).toBe("teamSelection");
  expect(left.team).toEqual(before.team);
  expect(left.reserves).toEqual(before.reserves);
  expect(left.expedition).toEqual({ ...before.expedition, lastRoom: "campfire" });
  expect(left.support).toEqual(before.support);
  expect(left.rng).toBe(before.rng);
  expect(decodeSave(encodeSave(left))).toEqual(left);
});

it("leaving without buying progresses once and replaces the old destination set", () => {
  const before = produce(merchant(), (draft) => {
    draft.expedition!.recruit = "cadenza";
  });
  const entered = accept(before, { type: "enterSupport", visit: before.support!.id });
  expect(decodeSave(encodeSave(entered))).toEqual(entered);
  const command = { type: "leaveSupport", visit: entered.support!.id } as const;
  const left = accept(entered, command);
  expect(left.currency).toBe(before.currency);
  expect(left.boons).toEqual(before.boons);
  expect(left.team).toEqual(before.team);
  expect(left.journey).toEqual(before.journey);
  expect(left.encounter).toBe(before.encounter);
  expect(left.expedition!.lastRoom).toBe("merchant");
  expect(left.expedition).not.toEqual(before.expedition);
  expect(left.rng).not.toBe(before.rng);
  expect(left.support).toBeNull();
  expect(decodeSave(encodeSave(left))).toEqual(left);
  expect(dispatch(left, command).state).toBe(left);
  expect(dispatch(left, { type: "enterSupport", visit: command.visit }).state).toBe(left);
});

it.each([0, 1, 2, 3, BOONS.length])(
  "stocks up to three distinct unowned Boons when %s remain",
  (remaining) => {
    const initial = createGame(7);
    let game = accept(initial, { type: "draft", species: initial.starterOffers[0]! });
    game = produce(game, (draft) => {
      draft.currency = 100;
      draft.boons = BOONS.slice(0, BOONS.length - remaining).map((boon) => boon.id);
      // Fix a successful independent Merchant roll, including before battle one.
      draft.rng = 10;
    });
    game = accept(game, { type: "start" });
    if (!remaining) expect(game.support).toBeNull();
    else {
      expect(game.support!.stock).toHaveLength(Math.min(3, remaining));
      const ids = game.support!.stock.map((slot) => slot.boon);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.some((id) => game.boons.includes(id))).toBe(false);
    }
    expect(decodeSave(encodeSave(game))).toEqual(game);
  },
);

it.each([false, true])("rolls and saves every inclusive price with Favor=%s", (favor) => {
  const observed = new Set<number>();
  const low = favor ? 13 : 20,
    high = favor ? 33 : 40;
  for (let seed = 1; seed <= 500; seed++) {
    const initial = createGame(seed);
    const drafted = produce(
      accept(initial, { type: "draft", species: initial.starterOffers[0]! }),
      (draft) => {
        draft.currency = 100;
        if (favor) draft.boons = ["merchants-favor"];
      },
    );
    const command = { type: "start" } as const;
    const state = accept(drafted, command);
    expect(accept(drafted, command)).toEqual(state);
    if (!state.support) continue;
    for (const slot of state.support.stock) {
      expect(Number.isInteger(slot.price)).toBe(true);
      expect(slot.price).toBeGreaterThanOrEqual(low);
      expect(slot.price).toBeLessThanOrEqual(high);
      observed.add(slot.price);
    }
    expect(decodeSave(encodeSave(state))).toEqual(state);
  }
  expect([...observed].sort((a, b) => a - b)).toEqual(Array.from({ length: 21 }, (_, i) => low + i));
});
