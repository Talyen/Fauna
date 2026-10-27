import { produce } from "immer";
import { requireBattle, teamRun } from "./game";

export function ravellandBattle() {
  return produce(requireBattle(teamRun(42, ["ravelland"])), (draft) => {
    const definitions = ["ravelland-antler-pass", "ravelland-canyon-rebuke", "ravelland-rainward"];
    draft.battle.hand = definitions.map((id) => draft.cards.find((card) => card.definitionId === id)!.id);
    draft.battle.discard = [];
    draft.battle.buffer = [];
    draft.battle.draw = draft.cards
      .filter((card) => !draft.battle.hand.includes(card.id))
      .map((card) => card.id);
  });
}
