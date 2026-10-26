import { addReserve, requireBattle, teamRun } from "./game";
import { produce } from "immer";
import { freshCombat } from "../../src/game/combat/index";

export function wisterelleBattle() {
  return produce(requireBattle(teamRun(42, ["wisterelle", "emberback", "prismram"])), (draft) => {
    draft.team.forEach((unit) => (unit.health = 12));
    addReserve(draft, "backup-mossguard", "mossguard", 20, freshCombat());
    addReserve(draft, "backup-coralcurl", "coralcurl", 15, freshCombat());
    const definitions = [
      "wisterelle-forgotten-junction",
      "wisterelle-lantern-fare",
      "wisterelle-left-luggage",
      "prismram-attack",
    ];
    draft.battle.hand = definitions.map((id) => draft.cards.find((card) => card.definitionId === id)!.id);
    draft.battle.discard = [draft.cards.find((card) => card.definitionId === "emberback-attack")!.id];
    draft.battle.buffer = [];
    draft.battle.draw = draft.cards
      .filter((card) => !draft.battle.hand.includes(card.id) && !draft.battle.discard.includes(card.id))
      .map((card) => card.id);
  });
}
