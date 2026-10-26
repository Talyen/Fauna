import { setBattleCards } from "./cards";
import { produce } from "immer";
import { teamRun } from "./game";

/** Explicit, save-valid conditions for inspecting chance forecasts without committing a play. */
export function uncertainBattle(draw = false) {
  return produce(teamRun(42, [draw ? "chimecricket" : "cindernewt", "mossguard", "prismram"]), (state) => {
    const card = state.cards.find(
      (entry) => entry.definitionId === (draw ? "chimecricket-attack" : "cindernewt-attack"),
    )!;
    setBattleCards(state, [card.id]);
    state.battle!.enemies[0]!.combat.dodge = 25;
    state.battle!.enemies[0]!.health = 4;
    state.battle!.enemies[0]!.block = 0;
  });
}
