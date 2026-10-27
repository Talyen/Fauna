import { battlefield, combatantById } from "../../../game/battlefield";
import { unitName } from "../../../game/combat/state";
import { CARDS, FOOD_CARDS, SPECIES, species, type CardDefinition } from "../../../game/content";
import { PEARL } from "../../../game/content/creatures/memento";
import { isKeywordId, KEYWORD_DEFINITIONS } from "../../../game/keywords";
import type { GameEvent, GameState } from "../../../game/types";
import type { createMessageReader } from "./messages";
import { localizedCombatantName } from "./combatant-name";

// A repeated English name cannot safely identify a specific authored card.
const cardsByEnglishName = new Map<string, CardDefinition | null>();
for (const card of [...CARDS, ...FOOD_CARDS, PEARL])
  cardsByEnglishName.set(card.name, cardsByEnglishName.has(card.name) ? null : card);
const speciesByEnglishName = new Map<string, (typeof SPECIES)[number] | null>();
for (const entry of SPECIES)
  speciesByEnglishName.set(entry.name, speciesByEnglishName.has(entry.name) ? null : entry);

/** Preview models retain common targetless announcements as text across possible outcomes. */
export function localizedPreviewMessage(text: string, i18n: ReturnType<typeof createMessageReader>) {
  const mana = /^Gain (\d+) Mana\.$/.exec(text);
  return mana
    ? i18n.message("log.gainMana", "Gain {{amount}} Mana.", {
        amount: i18n.locale === "en" ? mana[1]! : Number(mana[1]),
      })
    : text;
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
  const uniqueName = (english: string) => {
    const units = (state: GameState) => [
      ...battlefield(state, "player"),
      ...battlefield(state, "enemy"),
      ...state.reserves,
    ];
    const names = new Set(
      [...units(game), ...(previousGame ? units(previousGame) : [])]
        .filter((unit) => unitName(unit) === english)
        .map((unit) => localizedCombatantName(unit, i18n)),
    );
    return names.size === 1 ? [...names][0] : undefined;
  };
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
    if (
      actor &&
      event.actionType === "support" &&
      event.amount !== undefined &&
      event.text === `${species(actor.species).name} creates ${event.amount} Pearls`
    )
      return i18n.message("log.createPearls", "{{actor}} creates {{count}} Pearls", {
        actor: localizedCombatantName(actor, i18n),
        count: i18n.locale === "en" ? String(event.amount) : event.amount,
      });
    if (
      actor?.species === "memento" &&
      event.actionType === "support" &&
      event.text === "Memento summons an Echo"
    )
      return i18n.message("log.summonEcho", "{{actor}} summons an {{echo}}", {
        actor: localizedCombatantName(actor, i18n),
        echo: i18n.message("creature.echo", "Echo"),
      });
    if (event.actionType === "support" && event.text === "Express Delivery draws an extra card")
      return i18n.message("log.expressDelivery", "{{trait}} draws an extra card", {
        trait: i18n.content("content.species.orifable.trait", "Express Delivery"),
      });
    if (event.actionType === "support" && event.text === "Good Fortune turns the odds")
      return i18n.message("log.goodFortune", "{{trait}} turns the odds", {
        trait: i18n.content("content.species.euphera.trait", "Good Fortune"),
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
    if (actor && event.actionType === "support") {
      const copyPrefix = `${species(actor.species).name} copies `;
      const copySuffix = " with Well Read";
      if (event.text.startsWith(copyPrefix) && event.text.endsWith(copySuffix)) {
        const card = cardsByEnglishName.get(event.text.slice(copyPrefix.length, -copySuffix.length));
        if (card)
          return i18n.message("log.copyWithTrait", "{{actor}} copies {{card}} with {{trait}}", {
            actor: localizedCombatantName(actor, i18n),
            card: i18n.content(`content.card.${card.id}.name`, card.name),
            trait: i18n.content("content.species.rookhaven.trait", "Well Read"),
          });
      }
      const prefix = `${unitName(actor)} repeats `;
      if (event.text.startsWith(prefix)) {
        const rest = event.text.slice(prefix.length);
        const trait = rest.endsWith(" with Kindling Flourish")
          ? {
              suffix: " with Kindling Flourish",
              key: "content.species.wickwaltz.trait",
              name: "Kindling Flourish",
            }
          : rest.endsWith(" with Encore")
            ? { suffix: " with Encore", key: "content.species.chimecricket.trait", name: "Encore" }
            : undefined;
        const card = cardsByEnglishName.get(trait ? rest.slice(0, -trait.suffix.length) : rest);
        if (card) {
          const values = {
            actor: localizedCombatantName(actor, i18n),
            card: i18n.content(`content.card.${card.id}.name`, card.name),
          };
          return trait
            ? i18n.message("log.repeatCardWithTrait", "{{actor}} repeats {{card}} with {{trait}}", {
                ...values,
                trait: i18n.content(trait.key, trait.name),
              })
            : i18n.message("log.repeatCard", "{{actor}} repeats {{card}}", values);
        }
      }
    }
    if (event.actionType === "support" && event.text.startsWith("Use ")) {
      const card = cardsByEnglishName.get(event.text.slice(4));
      if (card?.species === null)
        return i18n.message("log.useFood", "Use {{card}}", {
          card: i18n.content(`content.card.${card.id}.name`, card.name),
        });
    }
    const repeatSuffix = " repeats";
    if (event.actionType === "support" && event.text.endsWith(repeatSuffix)) {
      const card = cardsByEnglishName.get(event.text.slice(0, -repeatSuffix.length));
      if (card?.species === null)
        return i18n.message("log.repeatFood", "{{card}} repeats", {
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
        turn: i18n.locale === "en" ? turn[1]! : Number(turn[1]),
        amount: i18n.locale === "en" ? turn[2]! : Number(turn[2]),
      });
  }
  if (event.kind === "reward") {
    if (event.text === "Boon purchased for this journey.")
      return i18n.message("log.boonPurchased", "Boon purchased for this journey.");
    if (event.amount !== undefined && event.text === `Gain ${event.amount} Gold.`)
      return i18n.message("log.gainGold", "Gain {{amount}} Gold.", {
        amount: i18n.locale === "en" ? String(event.amount) : event.amount,
      });
    const joinedSuffix = " joined your roster.";
    if (event.text.endsWith(joinedSuffix)) {
      const entry = speciesByEnglishName.get(event.text.slice(0, -joinedSuffix.length));
      if (entry)
        return i18n.message("log.creatureJoined", "{{name}} joined your roster.", {
          name: i18n.content(`content.species.${entry.id}.name`, entry.name),
        });
    }
    const discoveredSuffix = " was discovered again; your roster is unchanged.";
    if (event.text.endsWith(discoveredSuffix)) {
      const entry = speciesByEnglishName.get(event.text.slice(0, -discoveredSuffix.length));
      if (entry)
        return i18n.message(
          "log.creatureRediscovered",
          "{{name}} was discovered again; your roster is unchanged.",
          {
            name: i18n.content(`content.species.${entry.id}.name`, entry.name),
          },
        );
    }
  }
  if (
    (event.kind === "reward" || event.kind === "victory") &&
    event.text === "Battle complete. Rewards saved."
  )
    return i18n.message("log.battleComplete", "Battle complete. Rewards saved.");
  if (event.kind === "knockout" && event.text === "Your journey has ended.")
    return i18n.message("log.journeyEnded", "Your journey has ended.");
  if (event.kind === "knockout" && event.text === "You return from the wilds. Discoveries are kept.")
    return i18n.message("log.returnHome", "You return from the wilds. Discoveries are kept.");
  if (event.kind === "action" && event.actionType === "swap" && event.text === "Your formation changes")
    return i18n.message("log.formationChanges", "Your formation changes");
  if (event.kind === "action" && event.actionType === "swap") {
    const actor = combatant(event.actorId);
    if (actor) {
      const prefix = `${species(actor.species).name} replaces `;
      if (event.text.startsWith(prefix) && event.text.endsWith(".")) {
        const replaced = speciesByEnglishName.get(event.text.slice(prefix.length, -1));
        if (replaced)
          return i18n.message("log.replacement", "{{actor}} replaces {{target}}.", {
            actor: localizedCombatantName(actor, i18n),
            target: i18n.content(`content.species.${replaced.id}.name`, replaced.name),
          });
      }
      const target = combatant(event.targetId);
      if (
        target &&
        event.text === `${species(actor.species).name} swaps positions with ${species(target.species).name}.`
      )
        return i18n.message("log.swapPositions", "{{actor}} swaps positions with {{target}}.", {
          actor: localizedCombatantName(actor, i18n),
          target: localizedCombatantName(target, i18n),
        });
    }
  }
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
    if (actor && event.text === `${unitName(actor)} repeats Stun damage with Resonance`)
      return i18n.message("log.repeatStunTrait", "{{actor}} repeats Stun damage with {{trait}}", {
        actor: localizedCombatantName(actor, i18n),
        trait: i18n.content("content.species.ringpalm.trait", "Resonance"),
      });
    if (event.text === `Mountain Guide protects ${englishName}`)
      return i18n.message("log.mountainGuide", "{{trait}} protects {{target}}", {
        trait: i18n.content("content.species.skybex.trait", "Mountain Guide"),
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
    if (event.status === "negate" && event.outcome === "immune") {
      const suffix = ` protects ${englishName} with Devotion Clasp`;
      const bearer = event.text.endsWith(suffix)
        ? uniqueName(event.text.slice(0, -suffix.length))
        : undefined;
      if (bearer)
        return i18n.message("log.sharedNegate", "{{actor}} protects {{target}} with {{boon}}", {
          actor: bearer,
          target: name,
          boon: i18n.content("content.boon.devotion-clasp.name", "Devotion Clasp"),
        });
    }
    if (event.status === "block" && event.text === "Wish Exchange redistributes Block")
      return i18n.message("log.redistributeBlock", "{{card}} redistributes Block", {
        card: i18n.content("content.card.euphera-wish-exchange.name", "Wish Exchange"),
      });
    if (event.outcome === "apply") {
      if (event.status === "nullify" && event.text === "Nullify the next Freeze damage")
        return i18n.message("log.wardNextFreeze", "Nullify the next Freeze damage");
      if (event.status === "reflect" && event.text === "Reflect the next Burn")
        return i18n.message("log.wardNextBurn", "Reflect the next Burn");
      if (event.status === "reflect" && event.text === "Reflect the next harmful status effect")
        return i18n.message("log.wardNextStatus", "Reflect the next harmful status effect");
      if (event.status === "attackReflection" && event.text === `${englishName} reflects the next attack`)
        return i18n.message("log.wardNextAttack", "{{name}} reflects the next attack", { name });
      if (event.status === "negate" && event.text === `${englishName} negates the next attack against them`)
        return i18n.message("log.negateNextAttack", "{{name}} negates the next attack against them", {
          name,
        });
      if (event.status === "negate" && event.text === `${englishName} gains Negate`)
        return i18n.message("log.gainNegate", "{{name}} gains Negate", { name });
      if (
        event.status === "nullify" &&
        event.text === `${species(target.species).name} nullifies the next harmful status effect`
      )
        return i18n.message("log.wardNextHarm", "{{name}} nullifies the next harmful status effect", {
          name,
        });
    }
    if (
      event.status === "negate" &&
      event.outcome === "immune" &&
      event.text === `${englishName} negates the attack`
    )
      return i18n.message("log.negateAttack", "{{name}} negates the attack", { name });
    if (event.status === "deathDoor" && event.outcome === "apply") {
      const prefix = `${englishName} reaches Death's Door: `;
      const turns = event.text.startsWith(prefix)
        ? /^(\d+) grace turns\.$/.exec(event.text.slice(prefix.length))
        : null;
      if (turns)
        return i18n.message("log.reachDeathsDoor", "{{name}} reaches Death's Door: {{amount}} grace turns.", {
          name,
          amount: quantity(Number(turns[1])),
        });
    }
    if (event.status === "reflect" && event.outcome === "apply") {
      const actor = combatant(event.actorId);
      const status = event.affectedStatus ?? "purge";
      const englishStatus = event.affectedStatus ?? "Purge";
      const prefix = actor ? `${unitName(actor)} reflects ${englishStatus} to ` : "";
      const recipient =
        actor && event.text.startsWith(prefix) ? uniqueName(event.text.slice(prefix.length)) : undefined;
      if (actor && recipient)
        return i18n.message("log.reflectStatus", "{{actor}} reflects {{status}} to {{target}}", {
          actor: localizedCombatantName(actor, i18n),
          status:
            i18n.locale === "en"
              ? englishStatus
              : i18n.content(`content.keyword.${status}.label`, KEYWORD_DEFINITIONS[status].label),
          target: recipient,
        });
    }
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
      event.status === "armor" &&
      event.outcome === "remove" &&
      event.text === `${englishName} loses ${event.amount} Armor to Grain Flail`
    )
      return i18n.message("log.loseArmorToBoon", "{{name}} loses {{amount}} Armor to {{boon}}", {
        name,
        amount: quantity(event.amount),
        boon: i18n.content("content.boon.grain-flail.name", "Grain Flail"),
      });
    if (
      event.status === "cleanse" &&
      event.outcome === "remove" &&
      event.affectedStatus === "poison" &&
      event.amount < 0 &&
      event.text === `${englishName} Cleanses ${-event.amount} Poison.`
    )
      return i18n.message("log.cleansePoison", "{{name}} Cleanses {{amount}} Poison.", {
        name,
        amount: quantity(-event.amount),
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
  if (event.kind === "block") {
    if (event.amount < 0 && event.text === `${englishName} loses ${-event.amount} Block to Ashfall Pendant`)
      return i18n.message("log.loseBlockToBoon", "{{name}} loses {{amount}} Block to {{boon}}", {
        name,
        amount: quantity(-event.amount),
        boon: i18n.content("content.boon.ashfall-pendant.name", "Ashfall Pendant"),
      });
    const prefix = `${englishName} keeps `;
    const kept = event.text.startsWith(prefix)
      ? /^(\d+) Block with Tide Anklet$/.exec(event.text.slice(prefix.length))
      : null;
    if (kept && event.amount > 0)
      return i18n.message("log.keepBlockWithBoon", "{{name}} keeps {{amount}} Block with {{boon}}", {
        name,
        amount: quantity(Number(kept[1])),
        boon: i18n.content("content.boon.tide-anklet.name", "Tide Anklet"),
      });
    const lostPrefix = `${englishName} loses `;
    const lost = event.text.startsWith(lostPrefix)
      ? /^(\d+) Block to Coral Net Weight$/.exec(event.text.slice(lostPrefix.length))
      : null;
    if (lost && event.amount < 0)
      return i18n.message("log.loseBlockToBoon", "{{name}} loses {{amount}} Block to {{boon}}", {
        name,
        amount: quantity(Number(lost[1])),
        boon: i18n.content("content.boon.coral-net-weight.name", "Coral Net Weight"),
      });
  }
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
