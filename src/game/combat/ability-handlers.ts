import { TURN_MANA } from "../state-limits";
import { shareNegate } from "./damage";
import { grantCardRepeat } from "./card-repeat";
import { createFood } from "./food";
import { takeAttackReflection } from "./attack-reflection";
import { resurrect } from "./resurrection";
import { cardTargeting } from "../card-rules";
import { interceptAttack } from "./interception";
import { battlefield, healingAllies, isDepartedMinion } from "../battlefield";
import { summonEcho, createPearls, drawBossCards } from "./legendary";
import { species } from "../content";
import { scalePower } from "./ability-values";
import {
  ensureCombat,
  grantBlock,
  grantStatus,
  restoreHealth,
  applyBlind,
  removeEffects,
  gainMana,
  hit,
  negateAttack,
  mostInjured,
  grantTemporaryDodge,
  removeControlBuildup,
} from "./index";
import { roll } from "../random";
import { drawDiscard, draw, redrawHand } from "../card-zones";
import type { GameState, GameEvent } from "../types";
import { applyExtras, reflectExtras } from "./ability-extras";
import { friendlyRow, opposingRow, alive, type PrimaryContext } from "./ability-context";
import type { Combatant } from "./state";

function purgeAttackThorns(state: GameState, unit: Combatant, events: GameEvent[], source: Combatant) {
  for (const status of ["thorns", "waterThorns", "fireThorns"] as const)
    if (ensureCombat(unit)[status] > 0) removeEffects(unit, "purge", 1, events, state, status, source);
}

export function executePrimary(context: PrimaryContext) {
  const {
    state,
    action,
    actor,
    def,
    value,
    events,
    power,
    target,
    keywords,
    blindMiss,
    criticalBonus,
    negated,
    name,
    stats,
    enemy,
    operations,
  } = context;
  switch (def.effect) {
    case "procession":
      summonEcho(state, actor, action.side, value, events);
      return;
    case "createFood":
      if (action.side === "player") createFood(state, action.actor, value, events);
      return;
    case "createPearls":
      createPearls(state, actor, action.side, value, events);
      return;
    case "pearl":
      if (roll(state, { kind: "chance", threshold: 0.5 }) < 0.5)
        grantBlock(state, actor, scalePower(value, power), events);
      else if (action.side === "enemy" && action.actor.deck)
        action.actor.deck.mana = Math.min(TURN_MANA, action.actor.deck.mana + value);
      else gainMana(state, value, events);
      return;
    case "attack": {
      let { attackTarget } = context;
      const damageType =
        def.alternateDamageType && roll(state, { kind: "chance", threshold: 0.5 }) < 0.5
          ? def.alternateDamageType
          : def.damageType;
      const targets =
        def.target === "allEnemies"
          ? alive(opposingRow(state, action))
          : target && target.health > 0
            ? [target]
            : [];
      const sharedNegate = shareNegate(state, actor, targets, blindMiss);
      context.sharedNegate = sharedNegate;
      for (const intended of targets) {
        if (actor.health <= 0) break;
        if (isDepartedMinion(state, intended)) continue;
        const recipient = blindMiss ? intended : interceptAttack(state, actor, intended, events);
        if (def.target !== "allEnemies") attackTarget = recipient;
        const negation =
          !blindMiss && negateAttack(state, actor, recipient, events, true, damageType, sharedNegate);
        if (negation === "negated") {
          negated.add(recipient.id);
          continue;
        }
        const reflected =
          !blindMiss && (negation === "reflected" || takeAttackReflection(actor, recipient, events));
        if (reflected) {
          negated.add(recipient.id);
          if (negateAttack(state, recipient, actor, events, false, damageType)) continue;
        }
        const source = reflected ? recipient : actor;
        const victim = reflected ? actor : recipient;
        if (def.purgeThorns) purgeAttackThorns(state, victim, events, source);
        hit(
          state,
          source,
          victim,
          value * (def.doubleAgainstHealthier && victim.health > source.health ? 2 : 1),
          damageType,
          events,
          {
            origin: "ability",
            delivery: reflected ? "reflection" : undefined,
            interceptionChecked: true,
            blindMiss: reflected ? false : blindMiss,
            criticalBonus,
            leech: def.leech,
            cardLeech: keywords.includes("leech"),
            sharedNegate: reflected ? undefined : sharedNegate,
          },
        );
        if (reflected) reflectExtras(state, action, recipient, events, power);
      }
      if (action.side === "player") action.actor.attacked = true;
      context.attackTarget = attackTarget;
      return;
    }
    case "guard": {
      const targets =
        def.target === "allAllies"
          ? alive(friendlyRow(state, action))
          : cardTargeting(def) === "self"
            ? [actor]
            : friendlyRow(state, action).filter((unit) => unit.id === action.allyTargetId);
      for (const recipient of targets) grantBlock(state, recipient, value, events);
      return;
    }
    case "heal": {
      const allies = healingAllies(state, action.side);
      const targets =
        def.target === "allAllies"
          ? alive(allies)
          : cardTargeting(def) === "self"
            ? [actor]
            : def.target === "mostInjured"
              ? [mostInjured(allies)!]
              : friendlyRow(state, action).filter(
                  (unit) => unit.id === action.allyTargetId && unit.health > 0,
                );
      for (const recipient of targets) {
        if (actor.health <= 0) break;
        restoreHealth(recipient, value, events, false, state, true, actor);
        applyExtras(state, action, events, { target: recipient, recipientOnly: true });
      }
      return;
    }
    case "reflectAttack":
      stats.attackReflection = true;
      events.push({
        kind: "status",
        status: "attackReflection",
        outcome: "apply",
        actorId: actor.id,
        targetId: actor.id,
        text: `${name} reflects the next attack`,
      });
      return;
    case "resurrect": {
      const recipients = enemy ? state.battle.enemies : [...state.team, ...state.reserves];
      const recipient = recipients.find((unit) => unit.id === action.allyTargetId && unit.health === 0);
      if (recipient) resurrect(recipient, actor, events);
      return;
    }
    case "dreamDouble":
    case "sparkDecoy":
      grantStatus(actor, def.effect === "dreamDouble" ? "thorns" : "fireThorns", value, events, state);
      ensureCombat(actor).negate = true;
      events.push({
        kind: "status",
        actorId: actor.id,
        targetId: actor.id,
        status: "negate",
        outcome: "apply",
        text:
          def.effect === "dreamDouble"
            ? `${name} negates the next attack against them`
            : `${name} gains Negate`,
      });
      return;
    case "nightmareHarvest": {
      let removed = 0;
      for (const recipient of alive(friendlyRow(state, action))) {
        if (action.actor.health <= 0) break;
        removed += removeEffects(
          recipient,
          "cleanse",
          Number.MAX_SAFE_INTEGER,
          events,
          state,
          undefined,
          undefined,
          false,
        );
      }
      if (action.actor.health <= 0) return;
      if (!enemy) gainMana(state, removed * value, events);
      else if (action.side === "enemy" && action.actor.deck)
        action.actor.deck.mana = Math.min(TURN_MANA, action.actor.deck.mana + removed * value);
      return;
    }
    case "waterThorns":
      grantStatus(actor, "waterThorns", value, events, state);
      return;
    case "draw":
      if (action.side === "enemy" && action.actor.deck) drawBossCards(state, action.actor.deck, value);
      else if (!enemy) draw(state, value, events);
      return;
    case "redistributeBlock": {
      const recipients = alive(friendlyRow(state, action));
      const total = recipients.reduce((sum, unit) => sum + unit.block, 0);
      const share = Math.floor(total / recipients.length);
      const remainder = total % recipients.length;
      // This moves existing protection, so it must not trigger gain/conversion/sharing rewards.
      recipients.forEach((unit, index) => {
        const next = share + Number(index < remainder);
        const delta = next - unit.block;
        unit.block = next;
        if (delta)
          events.push({
            kind: "status",
            status: "block",
            outcome: delta > 0 ? "gain" : "remove",
            actorId: actor.id,
            targetId: unit.id,
            amount: delta,
            text: "Wish Exchange redistributes Block",
          });
      });
      for (const recipient of recipients) grantBlock(state, recipient, value, events);
      return;
    }
    case "redraw":
      if (!enemy) redrawHand(state, events);
      return;
    case "recover":
      if (!enemy) drawDiscard(state, events, def.allyOnly ? actor.id : undefined);
      applyExtras(state, action, events, {
        target: friendlyRow(state, action).find((unit) => unit.id === action.allyTargetId && unit.health > 0),
        recipientOnly: true,
      });
      return;
    case "mana":
      if (!enemy) gainMana(state, value, events);
      return;
    case "dodge":
      for (const unit of def.target === "allAllies" ? alive(friendlyRow(state, action)) : [actor])
        grantTemporaryDodge(unit, value, events);
      return;
    case "teamClearBlind":
      if (def.draw) {
        if (action.side === "player") draw(state, value, events);
        else if (action.actor.deck) drawBossCards(state, action.actor.deck, value);
      }
      for (const unit of alive(friendlyRow(state, action))) {
        if (action.actor.health <= 0) break;
        if (ensureCombat(unit).blind)
          removeEffects(unit, "cleanse", 1, events, state, "blind", undefined, false);
      }
      return;
    case "swapLowest": {
      const outgoing = alive(action.side === "player" ? state.team : state.battle.enemies).sort(
        (a, b) => a.health - b.health,
      )[0];
      if (outgoing) operations.swap(state, outgoing, events, true);
      return;
    }
    case "teamBlind":
      for (const unit of alive(opposingRow(state, action))) {
        if (actor.health <= 0) break;
        applyBlind(state, actor, unit, events);
      }
      return;
    case "teamPurge":
      for (const unit of alive(opposingRow(state, action))) {
        if (actor.health <= 0) break;
        removeEffects(unit, "purge", Number.MAX_SAFE_INTEGER, events, state, undefined, actor);
      }
      return;
    case "teamCleanse":
      for (const unit of alive(friendlyRow(state, action))) {
        if (action.actor.health <= 0) break;
        removeEffects(unit, "cleanse", value, events, state, undefined, undefined, false);
      }
      return;
    case "nullify":
      for (const unit of battlefield(state, enemy ? "enemy" : "player")) {
        if (unit.health <= 0) continue;
        ensureCombat(unit).nullify = true;
        events.push({
          kind: "status",
          targetId: unit.id,
          status: "nullify",
          outcome: "apply",
          text: `${species(unit.species).name} nullifies the next harmful status effect`,
        });
      }
      return;
    case "teamProtection": {
      const block = roll(state, { kind: "chance", threshold: 0.5 }) < 0.5;
      for (const unit of battlefield(state, enemy ? "enemy" : "player")) {
        if (unit.health <= 0) continue;
        if (block) grantBlock(state, unit, scalePower(value, power), events);
        else grantStatus(unit, "thorns", value, events, state);
      }
      return;
    }
    case "swap":
      operations.swap(state, actor, events, def.backupOnly);
      return;
    case "swapChosen":
      if (action.side === "player" && action.allyTargetId)
        operations.swap(state, actor, events, true, action.allyTargetId);
      return;
    case "swapDodge": {
      const incoming = operations.swap(state, actor, events);
      if (incoming) grantTemporaryDodge(incoming, value, events);
      return;
    }
    case "springbound":
    case "teamThaw":
      for (const unit of alive(friendlyRow(state, action))) {
        if (action.actor.health <= 0) break;
        removeControlBuildup(state, unit, "freeze", events, false);
      }
      if (def.effect === "springbound") grantTemporaryDodge(actor, value, events);
      return;
    case "repeatNextCard":
      grantCardRepeat(state, action.side, actor.id, events);
      return;
    default: {
      const unhandled: never = def;
      throw new Error(`Unhandled ability: ${unhandled}`);
    }
  }
}
