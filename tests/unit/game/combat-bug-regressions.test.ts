import { expect, it } from "vitest";
import { freshCombat, hit, gainMana } from "../../../src/game/combat/index";
import { summonEcho } from "../../../src/game/combat/legendary";
import { species } from "../../../src/game/content";
import type { BattleState, GameEvent } from "../../../src/game/types";
import { dispatch } from "../../../src/game/engine";
import { pendingReplacement } from "../../../src/game/team";
import { accept, authoredPack, prepareDestination, requireBattle, run, teamRun } from "../../support/game";
import { produce } from "immer";

function bossBattle() {
  const destination = produce(teamRun(42, ["pollenmoth"]), (state) => {
    prepareDestination(state);
    state.encounter = 3;
    state.journey!.victories = 3;
    state.expedition = { pack: authoredPack(3), recruit: null, lastRoom: "boss" };
  });
  return structuredClone(requireBattle(accept(destination, { type: "beginBattle" })));
}

it("Pollenmoth's Light bounces reach living enemy Echoes", () => {
  const state = bossBattle();
  const source = state.team[0]!;
  const boss = state.battle.enemies[0]!;
  boss.block = 0;
  boss.combat = { ...freshCombat(), controlled: "stun", controlTurns: 1 };
  summonEcho(state, boss, "enemy", 6, []);
  const echo = state.battle.minions![0]!;
  echo.combat.controlled = "stun";
  echo.combat.controlTurns = 1;
  const events: GameEvent[] = [];
  hit(state, source, boss, 3, "light", events);
  expect(echo.health).toBeLessThan(6);
  expect(events.some((event) => event.kind === "damage" && event.targetId === echo.id)).toBe(true);
});

it("Arcane Mending heals deployed Echoes along with their summoner", () => {
  const state = structuredClone(teamRun(42, ["memento"])) as BattleState;
  const actor = state.team[0]!;
  state.talents = ["mana.arcane-mending"];
  summonEcho(state, actor, "player", 6, []);
  const echo = state.battle.minions![0]!;
  echo.health = 2;
  actor.health -= 4;
  state.battle.mana = 0;
  gainMana(state, 2, []);
  expect(actor.health).toBe(species(actor.species).health - 2);
  expect(echo.health).toBe(4);
});

it("returns a knockout replacement after one round even when its backup skipped that turn", () => {
  const state = structuredClone(run());
  for (const ally of state.team) {
    ally.health = 1;
    ally.block = 0;
    ally.combat = { ...freshCombat(), deathDoorUsed: true, poison: 2 };
  }
  state.reserves.push({
    id: "backup",
    species: "pollenmoth",
    health: species("pollenmoth").health,
    block: 0,
    attacked: false,
    combat: { ...freshCombat(), controlled: "freeze", controlTurns: 1, poison: 2 },
  });
  state.roster.push("pollenmoth");
  for (const enemy of state.battle!.enemies) {
    enemy.combat.controlled = "stun";
    enemy.combat.controlTurns = 1;
  }
  const result = dispatch(state, { type: "endTurn" });
  expect(result.accepted).toBe(true);
  expect(result.state.phase).toBe("battle");
  expect(pendingReplacement(result.state)).toBeDefined();
  expect(result.state.battle!.turn).toBe(state.battle!.turn + 1);
  expect(result.state.reserves[0]!.combat!.skipped).toBe(true);
  expect(result.state.reserves[0]!.health).toBe(species("pollenmoth").health - 2);
});
