import { expect, it } from "vitest";
import { produce } from "immer";
import { BOONS } from "../../src/game/progression";
import { createGame, dispatch } from "../../src/game/engine";
import { encodeSave, decodeSave } from "../../src/game/save";
import { accept, winBattle } from "./helpers";
function merchant() {
  let s = accept(accept(createGame(7), { type: "draft", species: "mossback" }), { type: "start" });
  s = winBattle(accept(s, { type: "beginBattle", destination: s.expedition!.offers[0]!.location }));
  return accept(s, { type: "skipRecruit" });
}
it("saves an atomic purchase, rejects repeats and leaves the exact destination offers", () => {
  const s = merchant();
  const v = s.support!;
  const entered = accept(s, { type: "enterSupport", visit: v.id });
  const bought = accept(entered, { type: "buyBoon", visit: v.id, slot: v.stock[0]!.slot });
  expect(bought.currency).toBe(0);
  expect(bought.journey!.currency).toBe(20);
  expect(decodeSave(encodeSave(bought))).toEqual(bought);
  expect(dispatch(bought, { type: "buyBoon", visit: v.id, slot: v.stock[1]!.slot }).state).toBe(bought);
  const left = accept(bought, { type: "leaveSupport", visit: v.id });
  expect(left.expedition).toEqual(s.expedition);
  expect(dispatch(left, { type: "enterSupport", visit: v.id }).state).toBe(left);
});
it("rejects stale and unaffordable purchases without changing state or RNG", () => {
  const s = merchant();
  const entered = produce(accept(s, { type: "enterSupport", visit: s.support!.id }), (d) => {
    d.currency = 0;
  });
  for (const slot of [entered.support!.stock[0]!.slot, "constructor"])
    expect(dispatch(entered, { type: "buyBoon", visit: entered.support!.id, slot }).state).toBe(entered);
});
it("offers no support visit after the second ordinary victory", () => {
  let s = merchant();
  s = winBattle(accept(s, { type: "beginBattle" }));
  s = accept(s, { type: "skipRecruit" });
  expect(s.expedition!.step).toBe(2);
  expect(s.support).toBeNull();
  expect(decodeSave(encodeSave(s))).toEqual(s);
});
it("preserves eight battles after Merchant purchases", () => {
  let s = merchant();
  for (let i = 1; i < 8; i++) {
    if (s.support?.kind === "merchant") {
      s = accept(s, { type: "enterSupport", visit: s.support.id });
      s = accept(s, { type: "buyBoon", visit: s.support!.id, slot: s.support!.stock[0]!.slot });
      s = accept(s, { type: "leaveSupport", visit: s.support!.id });
    }
    s = winBattle(accept(s, { type: "beginBattle", destination: s.expedition!.offers[0]!.location }));
    if (s.phase === "boon") {
      expect(s.reward!.boons.length).toBeGreaterThan(0);
      s = accept(s, { type: "chooseBoon", boon: s.reward!.boons[0]! });
    }
    if (s.phase === "recruit") s = accept(s, { type: "skipRecruit" });
    expect(decodeSave(encodeSave(s))).toEqual(s);
  }
  expect(s.journey!.victories).toBe(8);
});
it("keeps Merchant stock and combat offers through Campfire rest and reload", () => {
  let s = produce(merchant(), (d) => {
    d.team[0]!.health = 0;
  });
  const route = s.expedition,
    visit = s.support;
  s = accept(s, { type: "visitCampfire" });
  s = decodeSave(encodeSave(s));
  s = accept(s, { type: "rest" });
  expect(s.expedition).toEqual(route);
  expect(s.support).toEqual(visit);
  expect(decodeSave(encodeSave(s))).toEqual(s);
  expect(accept(s, { type: "enterSupport", visit: visit!.id }).phase).toBe("support");
});
it.each([0, 19, 20])("requires enough Gold to enter the Merchant with %s Gold", (gold) => {
  const s = produce(merchant(), (d) => {
    d.currency = gold;
  });
  const result = dispatch(s, { type: "enterSupport", visit: s.support!.id });
  expect(result.accepted).toBe(gold >= 20);
  if (gold < 20) expect(result.state).toBe(s);
});
it("rejects obsolete saves and retired Spring visits", () => {
  const s = merchant();
  expect(() => decodeSave(JSON.stringify({ ...s, version: 14 }))).toThrow();
  expect(() => decodeSave(JSON.stringify({ ...s, support: { ...s.support, kind: "spring" } }))).toThrow();
});

it.each([2, 3, 4])("offers every remaining boss Boon when an explicit checkpoint owns %s Boons", (owned) => {
  let s = merchant();
  for (let i = 0; i < 2; i++) {
    s = winBattle(accept(s, { type: "beginBattle", destination: s.expedition!.offers[0]!.location }));
    s = accept(s, { type: "skipRecruit" });
  }
  // Explicit loadout fixture; these Boons are not claimed as earned purchases.
  s = produce(s, (d) => {
    d.boons = BOONS.slice(0, owned).map((b) => b.id);
  });
  s = winBattle(accept(s, { type: "beginBattle", destination: s.expedition!.offers[0]!.location }));
  expect(s.phase).toBe(owned === 4 ? "teamSelection" : "boon");
  if (owned < 4) expect(s.reward!.boons).toHaveLength(4 - owned);
  expect(decodeSave(encodeSave(s))).toEqual(s);
});
