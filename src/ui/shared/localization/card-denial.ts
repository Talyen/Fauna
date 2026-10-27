import { species } from "../../../game/content";
import type { Creature } from "../../../game/types";
import type { createMessageReader } from "./messages";

/** Present known admission reasons without changing the engine's validation or inventing a reason. */
export function localizedCardDenial(
  reason: string,
  actor: Creature | undefined,
  i18n: ReturnType<typeof createMessageReader>,
) {
  switch (reason) {
    case "That card is not in your hand.":
      return i18n.message("denial.cardNotInHand", "That card is not in your hand.");
    case "That creature is knocked out.":
      return i18n.message("denial.actorKnockedOut", "That creature is knocked out.");
    case "Unfinished Journey’s limit is spent this turn.":
      return i18n.message("denial.unfinishedJourney", "{{trait}}’s limit is spent this turn.", {
        trait: i18n.content("content.species.oathara.trait", "Unfinished Journey"),
      });
    case "There are no eligible ally cards in Discard.":
      return i18n.message("denial.noDiscardCards", "There are no eligible ally cards in Discard.");
    case "There are no knocked-out allies.":
      return i18n.message("denial.noKnockedOutAllies", "There are no knocked-out allies.");
    case "There are no living backups.":
      return i18n.message("denial.noLivingBackups", "There are no living backups.");
    case "There are no injured allies.":
      return i18n.message("denial.noInjuredAllies", "There are no injured allies.");
    case "Not enough Mana.":
      return i18n.message("denial.notEnoughMana", "Not enough Mana.");
  }
  if (actor) {
    const englishName = species(actor.species).name;
    const name = i18n.content(`content.species.${actor.species}.name`, englishName);
    if (reason === `${englishName} cannot act while Frozen.`)
      return i18n.message("denial.frozen", "{{name}} cannot act while Frozen.", { name });
    if (reason === `${englishName} cannot act while Stunned.`)
      return i18n.message("denial.stunned", "{{name}} cannot act while Stunned.", { name });
    if (reason === `${englishName} cannot act this turn.`)
      return i18n.message("denial.skipped", "{{name}} cannot act this turn.", { name });
  }
  return reason;
}
