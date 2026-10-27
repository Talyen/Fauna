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
