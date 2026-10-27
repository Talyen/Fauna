import { combatantById } from "../../../game/battlefield";
import { unitName } from "../../../game/combat/state";
import { species } from "../../../game/content";
import { isKeywordId, KEYWORD_DEFINITIONS } from "../../../game/keywords";
import type { GameEvent, GameState } from "../../../game/types";
import type { createMessageReader } from "./messages";

/** Translate only recognized complete events; preserve unfamiliar announcements verbatim. */
export function eventPresentation(
  game: GameState,
  event: GameEvent,
  i18n: ReturnType<typeof createMessageReader>,
) {
  if (event.kind === "turn") {
    if (event.text === "Your journey begins.")
      return i18n.message("log.journeyBegins", "Your journey begins.");
    const turn = /^Turn (\d+)\. (\d+) Mana restored\.$/.exec(event.text);
    if (turn)
      return i18n.message("log.turnRestored", "Turn {{turn}}. {{amount}} Mana restored.", {
        turn: turn[1]!,
        amount: turn[2]!,
      });
  }
  if (event.kind === "reward") {
    if (event.text === "Boon purchased for this journey.")
      return i18n.message("log.boonPurchased", "Boon purchased for this journey.");
    if (event.amount !== undefined && event.text === `Gain ${event.amount} Gold.`)
      return i18n.message("log.gainGold", "Gain {{amount}} Gold.", {
        amount: i18n.locale === "en" ? String(event.amount) : event.amount,
      });
  }
  if (event.kind === "knockout" && event.text === "You return from the wilds. Discoveries are kept.")
    return i18n.message("log.returnHome", "You return from the wilds. Discoveries are kept.");
  if (event.kind === "action" && event.actionType === "swap" && event.text === "Your formation changes")
    return i18n.message("log.formationChanges", "Your formation changes");
  if (event.kind === "status" && event.targetId === undefined && event.text === `Gain ${event.amount} Mana.`)
    return i18n.message("log.gainMana", "Gain {{amount}} Mana.", {
      amount: i18n.locale === "en" ? String(event.amount) : event.amount,
    });
  if (!("targetId" in event) || !event.targetId) return event.text;
  const target = combatantById(game, event.targetId);
  if (!target) return event.text;
  const englishName = unitName(target);
  const speciesName = species(target.species).name;
  const name =
    englishName === speciesName
      ? i18n.content(`content.species.${target.species}.name`, speciesName)
      : englishName;
  const quantity = (amount: number) => (i18n.locale === "en" ? String(amount) : amount);
  if (event.kind === "knockout" && event.text === `${englishName} is knocked out.`)
    return i18n.message("log.knockout", "{{name}} is knocked out.", { name });
  if (event.kind === "status" && event.outcome === "remove") {
    const { status, affectedStatus } = event;
    if (status === "cleanse" || status === "purge") {
      const action = status === "cleanse" ? "Cleanse" : "Purge";
      const localizedAction = i18n.content(`content.keyword.${status}.label`, action);
      if (
        event.amount === 0 &&
        !affectedStatus &&
        event.text === `${englishName}: ${action} removes no effects.`
      )
        return i18n.message("log.removeNoEffects", "{{name}}: {{action}} removes no effects.", {
          name,
          action: localizedAction,
        });
      if (affectedStatus && isKeywordId(affectedStatus)) {
        const label = i18n.content(
          `content.keyword.${affectedStatus}.label`,
          KEYWORD_DEFINITIONS[affectedStatus].label,
        );
        if (event.text === `${englishName}: ${action} ${affectedStatus}.`)
          return i18n.message("log.removeEffect", "{{name}}: {{action}} {{status}}.", {
            name,
            action: localizedAction,
            status: i18n.locale === "en" ? affectedStatus : label,
          });
        if (
          status === "cleanse" &&
          (affectedStatus === "stun" || affectedStatus === "freeze") &&
          event.text === `${englishName}: Cleanse ${KEYWORD_DEFINITIONS[affectedStatus].label} build-up`
        )
          return i18n.message("log.removeBuildup", "{{name}}: Cleanse {{status}} build-up", {
            name,
            status: label,
          });
      }
    }
  }
  if (event.kind === "status" && event.outcome === "gain" && event.amount !== undefined) {
    const status = event.status;
    if (isKeywordId(status)) {
      const keyword =
        i18n.locale === "en"
          ? status
          : i18n.content(`content.keyword.${status}.label`, KEYWORD_DEFINITIONS[status].label);
      const values = { name, amount: quantity(event.amount), status: keyword };
      if (event.text === `${englishName} gains ${event.amount} ${status}.`)
        return i18n.message("log.gainStatus", "{{name}} gains {{amount}} {{status}}.", values);
      if (
        (status === "stun" || status === "freeze") &&
        event.text === `${englishName} gains ${event.amount} ${status} buildup.`
      )
        return i18n.message("log.gainBuildup", "{{name}} gains {{amount}} {{status}} buildup.", values);
    }
  }
  if (event.kind === "heal" && event.text === `${englishName} restores ${event.amount} Health.`)
    return i18n.message("log.heal", "{{name}} restores {{amount}} Health.", {
      name,
      amount: quantity(event.amount),
    });
  if (event.kind === "block" && event.text === `${englishName} gains ${event.amount} Block.`)
    return i18n.message("log.gainBlock", "{{name}} gains {{amount}} Block.", {
      name,
      amount: quantity(event.amount),
    });
  if (event.kind === "block" && event.text === `${englishName} blocks ${-event.amount} damage.`)
    return i18n.message("log.absorb", "{{name}} blocks {{amount}} damage.", {
      name,
      amount: quantity(-event.amount),
    });
  if (event.kind === "damage") {
    const { amount, damageType, critical } = event;
    if (event.text !== `${englishName} takes ${amount} ${damageType} damage${critical ? " (Critical)" : ""}.`)
      return event.text;
    const type =
      i18n.locale !== "en" && isKeywordId(damageType)
        ? i18n.content(`content.keyword.${damageType}.label`, KEYWORD_DEFINITIONS[damageType].label)
        : damageType;
    return critical
      ? i18n.message("log.criticalDamage", "{{name}} takes {{amount}} {{type}} damage (Critical).", {
          name,
          amount: quantity(amount),
          type,
        })
      : i18n.message("log.damage", "{{name}} takes {{amount}} {{type}} damage.", {
          name,
          amount: quantity(amount),
          type,
        });
  }
  return event.text;
}
