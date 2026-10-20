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
  const entered = accept(
    produce(s, (d) => {
      d.currency = 0;
    }),
    { type: "enterSupport", visit: s.support!.id },
  );
  for (const slot of [entered.support!.stock[0]!.slot, "constructor"])
    expect(dispatch(entered, { type: "buyBoon", visit: entered.support!.id, slot }).state).toBe(entered);
});
it("resumes Spring and grants only capped retained currency once", () => {
  let s = merchant();
  s = winBattle(accept(s, { type: "beginBattle", destination: s.expedition!.offers[0]!.location }));
  s = accept(s, { type: "skipRecruit" });
  s = produce(s, (d) => {
    d.currency = 999_997;
  });
  s = accept(s, { type: "enterSupport", visit: s.support!.id });
  s = decodeSave(encodeSave(s));
  const earned = s.journey!.currency;
  const next = accept(s, { type: "springChoice", visit: s.support!.id, choice: "currency" });
  expect(next.currency).toBe(1_000_000);
  expect(next.journey!.currency).toBe(earned + 3);
  expect(dispatch(next, { type: "springChoice", visit: next.support!.id, choice: "currency" }).state).toBe(
    next,
  );
  expect(decodeSave(encodeSave(next))).toEqual(next);
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
it("Spring revives knocked-out reserves by the displayed capped amount and cannot heal twice", () => {
  let s = merchant();
  s = winBattle(accept(s, { type: "beginBattle", destination: s.expedition!.offers[0]!.location }));
  s = accept(s, { type: "recruit", species: s.reward!.recruits[0]! });
  s = produce(s, (d) => {
    d.team.forEach((c) => {
      c.health = 0;
    });
  });
  s = accept(s, { type: "enterSupport", visit: s.support!.id });
  const next = accept(s, { type: "springChoice", visit: s.support!.id, choice: "heal" });
  expect(next.team.every((c) => c.health > 0)).toBe(true);
  expect(dispatch(next, { type: "springChoice", visit: next.support!.id, choice: "heal" }).state).toBe(next);
  expect(decodeSave(encodeSave(next))).toEqual(next);
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
