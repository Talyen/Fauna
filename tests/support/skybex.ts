import { produce } from "immer";
import { freshCombat } from "../../src/game/combat/index";
import { species } from "../../src/game/content";
import { addBackups, requireBattle, teamRun } from "./game";

export function skybexBattle() {
  return produce(requireBattle(teamRun(42, ["skybex", "emberback", "prismram"])), (draft) => {
    addBackups(draft, {
      id: "skybex-backup",
      species: "mossguard",
      health: species("mossguard").health,
      block: 0,
      combat: freshCombat(),
      attacked: false,
    });
    const definitions = ["skybex-draw", "skybex-cloudstep", "skybex-sky-shepherd", "emberback-attack"];
    draft.battle.hand = definitions.map((id) => draft.cards.find((card) => card.definitionId === id)!.id);
    draft.battle.discard = [];
    draft.battle.draw = draft.cards
      .filter((card) => !draft.battle.hand.includes(card.id))
      .map((card) => card.id);
    draft.battle.buffer = [];
  });
}
