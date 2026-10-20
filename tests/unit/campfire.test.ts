import { expect, it } from "vitest";
import { produce } from "immer";
import { createGame, dispatch } from "../../src/game/engine";
import { decodeSave, encodeSave } from "../../src/game/save";
import { BIOMES } from "../../src/game/destinations";
import { canVisitCampfire } from "../../src/game/support";
import { accept, run } from "./helpers";
function destinations() {
  return accept(accept(createGame(7), { type: "draft", species: "briartooth" }), { type: "start" });
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
    const biome = Math.floor(encounter / 4),
      step = encounter % 4;
    d.encounter = encounter;
    d.journey!.victories = encounter;
    d.expedition = {
      biome,
      step,
      chosen: null,
      offers: (step === 3 ? [BIOMES[biome]!.boss] : BIOMES[biome]!.locations.slice(0, 3)).map((location) => ({
        location,
        pack: 0,
      })),
    };
    d.team[0]!.health = 21;
  });
  const rested = accept(accept(s, { type: "visitCampfire" }), { type: "rest" });
  expect(rested.team[0]!.health).toBe(30);
  expect(rested.expedition).toEqual(s.expedition);
  expect(rested.rng).toBe(s.rng);
  expect(rested.encounter).toBe(encounter);
  expect(canVisitCampfire(rested)).toBe(false);
  expect(decodeSave(encodeSave(rested))).toEqual(rested);
});
it("counts reserves and restores knocked-out reserves without overfilling healthy allies", () => {
  const s = produce(run(), (d) => {
    d.phase = "teamSelection";
    d.battle = null;
    d.expedition = destinations().expedition;
    d.roster.push("briartooth");
    d.reserves.push({ id: "reserve", species: "briartooth", health: 0, block: 0, attacked: false });
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
