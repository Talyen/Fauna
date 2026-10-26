import { expect, it } from "vitest";
import { produce } from "immer";
import { dispatch } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { canVisitCampfire } from "../../../src/game/destinations";
import { authoredPack, prepareDestination, accept, run, starterJourney } from "../../support/game";
function destinations() {
  return starterJourney(3, "captoad");
}
it.each([22, 21, 20, 0])("uses the exact 30%% missing Health threshold at %s/30", (health) => {
  const s = produce(destinations(), (d) => {
    d.team[0]!.health = health;
  });
  const result = dispatch(s, { type: "visitCampfire" });
  expect(result.accepted).toBe(health <= 21);
  if (health > 21) expect(result.state).toBe(s);
  else expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
});
it.each([0, 1, 2, 3, 4, 5, 6, 7])("offers Campfire at encounter %s without rerolling combat", (encounter) => {
  const s = produce(destinations(), (d) => {
    d.encounter = encounter;
    d.journey!.victories = d.encounter;
    d.journey!.victories = encounter;
    d.expedition = { pack: authoredPack(d.encounter), recruit: null, lastRoom: null };
    d.team[0]!.health = 21;
  });
  const rested = accept(accept(s, { type: "visitCampfire" }), { type: "rest" });
  expect(rested.team[0]!.health).toBe(30);
  expect(rested.expedition).toEqual({ ...s.expedition, lastRoom: "campfire" });
  expect(rested.rng).toBe(s.rng);
  expect(rested.encounter).toBe(encounter);
  expect(canVisitCampfire(rested)).toBe(false);
  expect(decodeSave(encodeSave(rested))).toEqual(rested);
});
it("counts reserves and restores knocked-out reserves without overfilling healthy allies", () => {
  const s = produce(run(), (d) => {
    prepareDestination(d);
    d.expedition = { pack: authoredPack(d.encounter), recruit: null, lastRoom: null };
    d.discovery.encountered.push("captoad");
    d.discovery.recruited.captoad = 1;
    d.reserves.push({ id: "reserve", species: "captoad", health: 0, block: 0, attacked: false });
  });
  expect(canVisitCampfire(s)).toBe(true);
  let next = accept(s, { type: "visitCampfire" });
  next = accept(decodeSave(encodeSave(next)), { type: "rest" });
  expect(next.team[0]!.health).toBe(32);
  expect(next.reserves[0]!.health).toBe(9);
  expect(decodeSave(encodeSave(next))).toEqual(next);
});
it("rejects a Campfire save without qualifying damage", () => {
  expect(() => decodeSave(JSON.stringify({ ...destinations(), phase: "campfire" }))).toThrow();
});
