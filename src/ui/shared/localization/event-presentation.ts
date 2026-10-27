import { combatantById } from "../../../game/battlefield";
import { unitName } from "../../../game/combat/state";
import { CARDS, FOOD_CARDS, species, type CardDefinition } from "../../../game/content";
import { PEARL } from "../../../game/content/creatures/memento";
import { isKeywordId, KEYWORD_DEFINITIONS } from "../../../game/keywords";
import type { GameEvent, GameState } from "../../../game/types";
import type { createMessageReader } from "./messages";
import { localizedCombatantName } from "./combatant-name";

// A repeated English name cannot safely identify a specific authored card.
const cardsByEnglishName = new Map<string, CardDefinition | null>();
for (const card of [...CARDS, ...FOOD_CARDS, PEARL])
  cardsByEnglishName.set(card.name, cardsByEnglishName.has(card.name) ? null : card);

/** Preview models retain common targetless announcements as text across possible outcomes. */
export function localizedPreviewMessage(text: string, i18n: ReturnType<typeof createMessageReader>) {
  const mana = /^Gain (\d+) Mana\.$/.exec(text);
  return mana ? i18n.message("log.gainMana", "Gain {{amount}} Mana.", { amount: mana[1]! }) : text;
}

/** Translate only recognized complete events; preserve unfamiliar announcements verbatim. */
export function eventPresentation(
  game: GameState,
  event: GameEvent,
  i18n: ReturnType<typeof createMessageReader>,
  previousGame?: GameState | null,
) {
  const combatant = (id: string | undefined) =>
    combatantById(game, id) ?? (previousGame ? combatantById(previousGame, id) : undefined);
  if (event.kind === "action" && event.actionType !== "swap") {
    if (event.actionType === "attack" && event.text === "The Court Remembers")
      return i18n.content("content.species.memento.trait", "The Court Remembers");
    if (event.actionType === "support" && event.text === "Your next card is played twice")
      return i18n.message("log.repeatNextPlayerCard", "Your next card is played twice");
    if (event.actionType === "support" && event.text === "The enemy's next card is played twice")
      return i18n.message("log.repeatNextEnemyCard", "The enemy's next card is played twice");
    const actor = combatant(event.actorId);
    if (
      actor &&
      event.actionType === "support" &&
      event.amount !== undefined &&
      event.text === `${species(actor.species).name} creates ${event.amount} Food cards`
    )
      return i18n.message("log.createFood", "{{actor}} creates {{count}} Food cards", {
        actor: localizedCombatantName(actor, i18n),
        count: i18n.locale === "en" ? String(event.amount) : event.amount,
      });
    if (actor) {
      const prefix = `${unitName(actor)} uses `;
      if (event.text.startsWith(prefix) && event.text.endsWith(".")) {
        const card = cardsByEnglishName.get(event.text.slice(prefix.length, -1));
        if (card)
          return i18n.message("log.useCard", "{{actor}} uses {{card}}.", {
            actor: localizedCombatantName(actor, i18n),
            card: i18n.content(`content.card.${card.id}.name`, card.name),
          });
      }
    }
    if (event.actionType === "support" && event.text.startsWith("Use ")) {
      const card = cardsByEnglishName.get(event.text.slice(4));
      if (card?.species === null)
        return i18n.message("log.useFood", "Use {{card}}", {
          card: i18n.content(`content.card.${card.id}.name`, card.name),
        });
    }
    const discardSuffix = " is drawn from Discard";
    if (actor && event.actionType === "support" && event.text.endsWith(discardSuffix)) {
      const card = cardsByEnglishName.get(event.text.slice(0, -discardSuffix.length));
      if (card)
        return i18n.message("log.drawDiscard", "{{card}} is drawn from Discard", {
          card: i18n.content(`content.card.${card.id}.name`, card.name),
        });
    }
    const returnSuffix = " returns to hand";
    if (actor && event.actionType === "support" && event.text.endsWith(returnSuffix)) {
      const card = cardsByEnglishName.get(event.text.slice(0, -returnSuffix.length));
      if (card)
        return i18n.message("log.returnCard", "{{card}} returns to hand", {
          card: i18n.content(`content.card.${card.id}.name`, card.name),
        });
    }
  }
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
  const target = combatant(event.targetId);
  if (!target) return event.text;
  const englishName = unitName(target);
  const name = localizedCombatantName(target, i18n);
  const quantity = (amount: number) => (i18n.locale === "en" ? String(amount) : amount);
  if (event.kind === "action" && event.actionType === "support") {
    const actor = combatant(event.actorId);
    if (actor && event.text === `${unitName(actor)} intercepts the attack against ${englishName}`)
      return i18n.message("log.intercept", "{{actor}} intercepts the attack against {{target}}", {
        actor: localizedCombatantName(actor, i18n),
        target: name,
      });
  }
  if (
    event.kind === "status" &&
    event.status === "dodge" &&
    event.outcome === "dodge" &&
    event.text === `${englishName} Dodges.`
  )
    return i18n.message("log.dodge", "{{name}} Dodges.", { name });
  if (event.kind === "knockout" && event.text === `${englishName} is knocked out.`)
    return i18n.message("log.knockout", "{{name}} is knocked out.", { name });
  if (event.kind === "status") {
    if (event.status === "attackReflection" && event.outcome === "immune") {
      const actor = combatant(event.actorId);
      if (actor && event.text === `${unitName(actor)} reflects the attack back at ${englishName}`)
        return i18n.message("log.reflectAttack", "{{actor}} reflects the attack back at {{target}}", {
          actor: localizedCombatantName(actor, i18n),
          target: name,
        });
    }
    if (
      event.status === "nullify" &&
      event.outcome === "gain" &&
      event.text === `${englishName} gains Nullify`
    )
      return i18n.message("log.gainNullify", "{{name}} gains Nullify", { name });
    if (event.status === "blind" && event.outcome === "apply" && event.text === `${englishName} is Blinded`)
      return i18n.message("log.blinded", "{{name}} is Blinded", { name });
    if (
      event.status === "nullify" &&
      event.outcome === "immune" &&
      event.affectedStatus === "freeze" &&
      event.text === `${englishName} nullifies Freeze damage`
    )
      return i18n.message("log.nullifyFreezeDamage", "{{name}} nullifies Freeze damage", { name });
    if (
      event.status === "nullify" &&
      (event.outcome === "immune" || event.outcome === "remove") &&
      event.affectedStatus &&
      isKeywordId(event.affectedStatus) &&
      event.text === `${englishName} nullifies ${event.affectedStatus}`
    ) {
      const status = event.affectedStatus;
      return i18n.message("log.nullifyEffect", "{{name}} nullifies {{status}}", {
        name,
        status:
          i18n.locale === "en"
            ? status
            : i18n.content(`content.keyword.${status}.label`, KEYWORD_DEFINITIONS[status].label),
      });
    }
    if ((event.status === "freeze" || event.status === "stun") && event.outcome === "immune") {
      const status = event.status;
      if (event.text === `${englishName} is immune to ${status} buildup.`)
        return i18n.message("log.immuneBuildup", "{{name}} is immune to {{status}} buildup.", {
          name,
          status:
            i18n.locale === "en"
              ? status
              : i18n.content(`content.keyword.${status}.label`, KEYWORD_DEFINITIONS[status].label),
        });
    }
    if ((event.status === "freeze" || event.status === "stun") && event.outcome === "apply") {
      const englishStatus = event.status === "freeze" ? "Frozen" : "Stunned";
      if (event.text === `${englishName} is ${englishStatus}.`)
        return i18n.message("log.controlApplied", "{{name}} is {{status}}.", {
          name,
          status:
            i18n.locale === "en"
              ? englishStatus
              : i18n.content(
                  `content.keyword.${event.status}.label`,
                  KEYWORD_DEFINITIONS[event.status].label,
                ),
        });
    }
    if ((event.status === "freeze" || event.status === "stun") && event.outcome === "skip") {
      const englishStatus = event.status === "freeze" ? "Frozen" : "Stunned";
      if (event.text === `${englishName} skips its ${englishStatus} turn.`)
        return i18n.message("log.skipControlledTurn", "{{name}} skips its {{status}} turn.", {
          name,
          status:
            i18n.locale === "en"
              ? englishStatus
              : i18n.content(
                  `content.keyword.${event.status}.label`,
                  KEYWORD_DEFINITIONS[event.status].label,
                ),
        });
    }
  }
  if (event.kind === "status" && event.amount !== undefined) {
    if (
      event.status === "deathDoor" &&
      event.outcome === "apply" &&
      event.text === `${englishName} reaches Death's Door: ${event.amount} grace turns.`
    )
      return i18n.message("log.reachDeathsDoor", "{{name}} reaches Death's Door: {{amount}} grace turns.", {
        name,
        amount: quantity(event.amount),
      });
    if (
      event.status === "armor" &&
      event.outcome === "remove" &&
      event.text === `${englishName} loses ${event.amount} Armor`
    )
      return i18n.message("log.loseArmor", "{{name}} loses {{amount}} Armor", {
        name,
        amount: quantity(event.amount),
      });
    if (
      event.status === "dodge" &&
      event.outcome === "gain" &&
      event.text === `${englishName} gains ${event.amount}% Dodge until its next turn`
    )
      return i18n.message("log.temporaryDodge", "{{name}} gains {{amount}}% Dodge until its next turn", {
        name,
        amount: quantity(event.amount),
      });
    if (
      event.status === "freeze" &&
      event.outcome === "remove" &&
      event.text === `${englishName} loses ${event.amount} Freeze buildup`
    )
      return i18n.message("log.loseFreezeBuildup", "{{name}} loses {{amount}} Freeze buildup", {
        name,
        amount: quantity(event.amount),
      });
  }
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
  if (event.kind === "heal" && event.actorId) {
    const actor = combatant(event.actorId);
    if (actor && event.text === `${unitName(actor)} Resurrects ${englishName} with ${event.amount} Health`)
      return i18n.message("log.resurrect", "{{actor}} Resurrects {{target}} with {{amount}} Health", {
        actor: localizedCombatantName(actor, i18n),
        target: name,
        amount: quantity(event.amount),
      });
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
