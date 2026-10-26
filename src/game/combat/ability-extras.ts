import { battlefield } from "../battlefield";
import { species } from "../content";
import { draw, drawKeyword } from "../card-zones";
import { abilityExtras } from "./ability-values";
import { supplementalRule } from "../rules/supplemental";
import type { GameState, GameEvent } from "../types";
import type { AbilityAction } from "./ability-context";
import {
  ensureCombat,
  grantStatus,
  grantArmor,
  restoreHealth,
  triggerArmorBreak,
  removeArmor,
  applyBlind,
  removeEffects,
  gainMana,
  hit,
  type Combatant,
} from "./index";

interface ExtraOptions {
  target?: Combatant;
  blindMiss?: boolean;
  cannotDodge?: boolean;
  criticalBonus?: number;
  recipientOnly?: boolean;
  negated?: ReadonlySet<string>;
  sharedNegate?: import("./policy").SharedNegate;
}
export function applyExtras(
  state: GameState,
  action: AbilityAction,
  events: GameEvent[],
  options: ExtraOptions = {},
) {
  const { actor, def } = action;
  const enemy = action.side === "enemy";
  const power = enemy ? action.actor.power : 1;
  const { target, blindMiss = false, criticalBonus = 0, recipientOnly = false } = options;
  for (const effect of abilityExtras(def, power)) {
    if (recipientOnly !== (supplementalRule(effect.kind).delivery(effect) === "recipient")) continue;
    if (actor.health <= 0) break;
    switch (effect.kind) {
      case "damage":
        if (target && !options.negated?.has(target.id))
          hit(state, actor, target, effect.amount, effect.damageType, events, {
            origin: "ability",
            interceptionChecked: true,
            blindMiss,
            cannotDodge: options.cannotDodge,
            criticalBonus,
            leech: effect.leech,
            cardLeech: def.leech || def.effects?.some((effect) => effect.kind === "damage" && effect.leech),
            sharedNegate: options.sharedNegate,
          });
        break;
      case "status":
        if (effect.status === "armor") grantArmor(state, actor, effect.amount, events);
        else grantStatus(actor, effect.status, effect.amount, events, state);
        break;
      case "meltArmor":
        for (const recipient of battlefield(state, enemy ? "player" : "enemy")) {
          if (actor.health <= 0) break;
          if (recipient.health <= 0 || options.negated?.has(recipient.id)) continue;
          const stats = ensureCombat(recipient);
          const { removed, depletion } = removeArmor(
            recipient,
            Math.ceil((stats.armor * effect.amount) / 100),
          );
          if (!removed) continue;
          events.push({
            kind: "status",
            actorId: actor.id,
            targetId: recipient.id,
            status: "armor",
            outcome: "remove",
            amount: removed,
            text: `${species(recipient.species).name} loses ${removed} Armor`,
          });
          triggerArmorBreak(state, depletion, events);
        }
        break;
      case "blind":
        for (const recipient of battlefield(state, enemy ? "player" : "enemy")) {
          if (actor.health <= 0) break;
          if (recipient.health > 0 && !options.negated?.has(recipient.id))
            applyBlind(state, actor, recipient, events);
        }
        break;
      case "nullifyFreeze":
        ensureCombat(actor).nullifyFreeze = true;
        events.push({
          kind: "status",
          targetId: actor.id,
          status: "nullify",
          outcome: "apply",
          text: "Nullify the next Freeze damage",
        });
        break;
      case "reflect":
        if (effect.status === "burn") ensureCombat(actor).reflectBurn = true;
        else ensureCombat(actor).reflect = true;
        events.push({
          kind: "status",
          targetId: actor.id,
          status: "reflect",
          outcome: "apply",
          text: effect.status === "burn" ? "Reflect the next Burn" : "Reflect the next harmful status effect",
        });
        break;
      case "cleanse":
        for (const recipient of effect.target === "allAllies"
          ? battlefield(state, enemy ? "enemy" : "player").filter((unit) => unit.health > 0)
          : [effect.target === "recipient" && target ? target : actor]) {
          if (actor.health <= 0) break;
          removeEffects(
            recipient,
            "cleanse",
            effect.amount,
            events,
            state,
            undefined,
            actor,
            effect.target !== "allAllies" &&
              !(effect.target === "recipient" && def.effect === "heal" && def.target === "allAllies"),
          );
        }
        break;
      case "purge":
        if (target && !options.negated?.has(target.id))
          removeEffects(target, "purge", effect.amount, events, state, undefined, actor);
        break;
      case "heal": {
        const recipient = effect.target === "recipient" ? target : actor;
        if (recipient) restoreHealth(recipient, effect.amount, events, false, state, true, actor);
        break;
      }
      case "drawKeyword":
        if (!enemy) for (let i = 0; i < effect.amount; i++) drawKeyword(state, effect.keyword, events);
        break;
      case "draw":
        if (!enemy) draw(state, effect.amount, events);
        break;
      case "mana":
        if (!enemy) gainMana(state, effect.amount, events);
        break;
      default: {
        const unhandled: never = effect;
        throw new Error(`Unhandled supplemental effect: ${unhandled}`);
      }
    }
  }
}
/** Return harmful extras only; support extras retain their original actor and delivery window. */
export function reflectExtras(
  state: GameState,
  action: AbilityAction,
  reflectedBy: Combatant,
  events: GameEvent[],
  power: number,
) {
  for (const effect of abilityExtras(action.def, power)) {
    if (action.actor.health <= 0 || reflectedBy.health <= 0) break;
    const actor = action.actor;
    switch (effect.kind) {
      case "damage":
        hit(state, reflectedBy, actor, effect.amount, effect.damageType, events, {
          origin: "ability",
          delivery: "reflection",
          interceptionChecked: true,
          blindMiss: false,
          leech: effect.leech,
        });
        break;
      case "meltArmor": {
        const { depletion } = removeArmor(
          actor,
          Math.ceil((ensureCombat(actor).armor * effect.amount) / 100),
        );
        triggerArmorBreak(state, depletion, events);
        break;
      }
      case "blind":
        applyBlind(state, reflectedBy, actor, events);
        break;
      case "purge":
        removeEffects(actor, "purge", effect.amount, events, state, undefined, reflectedBy);
        break;
      case "status":
      case "nullifyFreeze":
      case "reflect":
      case "cleanse":
      case "heal":
      case "drawKeyword":
      case "draw":
      case "mana":
        break;
      default: {
        const unhandled: never = effect;
        throw new Error(`Unhandled reflected effect: ${unhandled}`);
      }
    }
  }
}
