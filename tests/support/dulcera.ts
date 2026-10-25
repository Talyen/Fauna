import { produce } from "immer";
import { freshCombat } from "../../src/game/combat/index";
import { addBackups, requireBattle, teamRun } from "./game";
import type { BattleState } from "../../src/game/types";

export function dulceraBattle(withBackup = true): BattleState {
  return produce(requireBattle(teamRun(42, ["dulcera", "emberback", "mossguard"])), (draft) => {
    draft.team[0]!.health = 20;
    draft.team[0]!.combat!.burn = 3;
    draft.team[1]!.health = 14;
    draft.team[1]!.combat!.poison = 4;
    draft.team[2]!.health = 12;
    if (withBackup)
      addBackups(draft, {
        id: "backup-coralcurl",
        species: "coralcurl",
        health: 12,
        block: 0,
        combat: { ...freshCombat(), poison: 4, freeze: 3, blind: true },
        attacked: false,
      });
    const definitions = [
      "dulcera-chapel-light",
      "dulcera-meadow-shelter",
      "dulcera-hushed-waters",
      "emberback-attack",
    ];
    draft.battle.hand = definitions.map((id) => draft.cards.find((card) => card.definitionId === id)!.id);
    draft.battle.draw = draft.cards
      .filter((card) => !draft.battle.hand.includes(card.id))
      .map((card) => card.id);
    draft.battle.discard = [];
    draft.battle.buffer = [];
  });
}
