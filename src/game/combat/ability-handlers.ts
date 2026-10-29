import { passiveAmount } from "../progression";
import { boonRule } from "../rules/boons";
import { swapFromCard } from "../team";
import { emitStatus, emitSupport } from "../events";
import { TURN_MANA } from "../state-limits";
import { shareNegate, shareDodge } from "./damage";
import { grantCardRepeat } from "./card-repeat";
import { createFood } from "./food";
import { CLOCKWORK_BEE } from "../content/creatures/tinkervale";
import { takeAttackReflection } from "./attack-reflection";
import { resurrect } from "./resurrection";
import { cardTargeting } from "../card-rules";
import { interceptAttack } from "./interception";
import {
  battlefield,
  enemyReflectionRecipients,
  battlefieldView,
  findLivingBattlefield,
  healingAllies,
  isDepartedMinion,
} from "../battlefield";
import {
  summonEcho,
  summonPendulums,
  summonRoyalBlooms,
  pendulumBonus,
  createPearls,
  drawBossCards,
} from "./legendary";
import { scalePower } from "./ability-values";
import { species, speciesCards } from "../content";
import {
  ensureCombat,
  grantArmor,
  grantBlock,
  grantStatus,
  restoreHealth,
  applyBlind,
  applyHarmfulStatus,
  triggerArmorBreak,
  removeEffects,
  gainMana,
  hit,
  negateAttack,
  mostInjured,
  grantTemporaryDodge,
  removeControlBuildup,
} from "./index";
import { roll } from "../random";
import {
  drawDiscard,
  draw,
  drawKeyword,
  redrawHand,
  createTemporaryCard,
  receiveDraw,
  fillHand,
  battleCardCapacity,
  receiveCard,
} from "../card-zones";
import type { GameState, GameEvent } from "../types";
import { applyExtras, reflectExtras } from "./ability-extras";
import { actorPower, livingFriends, livingOpponents, type PrimaryContext } from "./ability-context";
import { hasHarmfulEffects, unitName, type Combatant } from "./state";

function purgeAttackThorns(state: GameState, unit: Combatant, events: GameEvent[], source: Combatant) {
  if (ensureCombat(unit).thorns > 0) removeEffects(unit, "purge", 1, events, state, "thorns", source);
}

export function restoreFallen(context: PrimaryContext, recipient: Combatant, health?: number) {
  const { state, action, events } = context;
  const { actor } = action;
  const enemy = action.side === "enemy";
  resurrect(recipient, actor, events, health);
  if (
    recipient.health > 0 &&
    (enemy
      ? state.battle.enemies.some((unit) => unit.id === recipient.id)
      : state.team.some((unit) => unit.id === recipient.id))
  ) {
    summonPendulums(state, recipient, action.side, events);
    summonRoyalBlooms(state, recipient, action.side, events);
  }
  if (!enemy && recipient.health > 0 && hasHarmfulEffects(recipient) && state.boons.includes("memory-cairn"))
    removeEffects(recipient, "cleanse", 6, events, state, undefined, actor, false);
  if (!enemy && recipient.health > 0 && state.boons.includes("remembrance-wreath")) {
    ensureCombat(recipient).negate = true;
    emitStatus(events, recipient.id, "negate", "apply", { text: `${unitName(recipient)} gains Negate` });
  }
}

export function executePrimary(context: PrimaryContext) {
  const {
    state,
    action,
    events,
    target,
    keywords,
    blindMiss,
    cannotDodge,
    criticalBonus,
    oasisLeech,
    toothpickPurge,
    additionalTarget,
    name,
    stats,
  } = context;
  const { actor, def, value } = action;
  const enemy = action.side === "enemy";
  const power = actorPower(action);
  switch (def.effect) {
    case "stealEffect":
      if (target && target.health > 0)
        removeEffects(target, "purge", 1, events, state, undefined, actor, true, false, true);
      return;
    case "borrowBackup": {
      if (action.side !== "player") return;
      const choices = state.reserves
        .filter((unit) => unit.health > 0)
        .flatMap((unit) => speciesCards(unit.species).map((card) => ({ species: unit.species, card })));
      if (choices.length && battleCardCapacity(state) > 0) {
        const chosen =
          choices[Math.floor(roll(state, { kind: "index", size: choices.length }) * choices.length)]!;
        const copy = createTemporaryCard(state, {
          definitionId: chosen.card.id,
          ownerId: actor.id,
          level: 0,
          borrowedFrom: chosen.species,
        });
        if (copy) {
          fillHand(state);
          receiveDraw(state, copy.id, events);
          emitSupport(events, actor.id, { text: `${name} draws a copy of ${chosen.card.name}` });
        }
      }
      gainMana(state, 1, events);
      return;
    }
    case "teamNegate":
      for (const unit of livingFriends(state, action)) {
        ensureCombat(unit).negate = true;
        emitStatus(events, unit.id, "negate", "apply", { text: `${unitName(unit)} gains Negate` });
      }
      return;
    case "bridgeRewind":
      restoreHealth(actor, value, events, false, state, true, actor);
      if (actor.health > 0)
        summonPendulums(state, actor, action.side, events, 1, actor.species !== "chronora");
      return;
    case "royalRepose":
      restoreHealth(actor, value, events, false, state, true, actor);
      for (const unit of livingFriends(state, action)) {
        if (actor.health <= 0) break;
        grantBlock(state, unit, scalePower(1, power), events);
      }
      return;
    case "meadowDecree":
      summonRoyalBlooms(state, actor, action.side, events, 1, value, actor.species !== "velvetmonarch");
      for (const unit of healingAllies(state, action.side)) {
        if (actor.health <= 0) break;
        restoreHealth(unit, scalePower(2, power), events, false, state, true, actor);
      }
      return;
    case "procession":
      summonEcho(state, actor, action.side, value, events);
      return;
    case "createBees": {
      let created = 0;
      if (action.side === "enemy") {
        const before = action.actor.clockworkBees ?? 0;
        action.actor.clockworkBees = Math.min(6, before + value);
        created = action.actor.clockworkBees - before;
      } else {
        for (let index = 0; index < value; index++) {
          const bee = createTemporaryCard(state, {
            definitionId: CLOCKWORK_BEE.id,
            ownerId: actor.id,
            level: 0,
            ...(actor.species !== "tinkervale" ? { borrowedFrom: "tinkervale" as const } : {}),
          });
          if (!bee) break;
          receiveCard(state, bee.id);
          created++;
        }
      }
      if (created)
        emitSupport(events, actor.id, { amount: created, text: `${name} creates ${created} Clockwork Bees` });
      return;
    }
    case "armorAlly": {
      const recipient = battlefieldView(state, action.side).find(
        (unit) => unit.id === action.allyTargetId && unit.health > 0,
      );
      if (recipient) grantArmor(state, recipient, value, events);
      return;
    }
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
      let attackTarget = target;
      const negated = new Set<string>();
      const damageType =
        def.alternateDamageType && roll(state, { kind: "chance", threshold: 0.5 }) < 0.5
          ? def.alternateDamageType
          : def.damageType;
      const targets =
        def.target === "allEnemies"
          ? livingOpponents(state, action)
          : target && target.health > 0
            ? [target, ...(additionalTarget && additionalTarget.health > 0 ? [additionalTarget] : [])]
            : [];
      let extraAttackTarget: Combatant | undefined;
      const sharedNegate = shareNegate(state, actor, targets, blindMiss);
      const sheltered = enemy && targets.length > 1 && state.boons.includes("sandfold-parasol");
      const recipients = sheltered
        ? targets.map((intended) => (blindMiss ? intended : interceptAttack(state, actor, intended, events)))
        : undefined;
      const sharedDodge = shareDodge(state, actor, recipients ?? targets, events, blindMiss, sharedNegate);
      for (const [index, intended] of targets.entries()) {
        if (actor.health <= 0) break;
        if (isDepartedMinion(state, intended)) continue;
        const recipient =
          recipients?.[index] ?? (blindMiss ? intended : interceptAttack(state, actor, intended, events));
        if (toothpickPurge && !blindMiss)
          removeEffects(
            recipient,
            "purge",
            boonRule("dragons-toothpick").purge,
            events,
            state,
            undefined,
            actor,
          );
        if (def.target !== "allEnemies") {
          if (intended.id === target?.id) attackTarget = recipient;
          else extraAttackTarget = recipient;
        }
        const negation =
          !blindMiss &&
          !sharedDodge &&
          negateAttack(state, actor, recipient, events, true, damageType, sharedNegate);
        if (negation === "negated") {
          negated.add(recipient.id);
          continue;
        }
        const reflected =
          !blindMiss &&
          !sharedDodge &&
          (negation === "reflected" || takeAttackReflection(actor, recipient, events));
        if (reflected) {
          negated.add(recipient.id);
        }
        const source = reflected ? recipient : actor;
        const reflectedTargets =
          reflected && action.side === "enemy" && state.boons.includes("ripple-mirror")
            ? enemyReflectionRecipients(state, actor)
            : reflected
              ? [actor]
              : [recipient];
        for (const victim of reflectedTargets) {
          if (source.health <= 0 || victim.health <= 0) continue;
          if (reflected && negateAttack(state, recipient, victim, events, false, damageType)) continue;
          if (def.purgeThorns) purgeAttackThorns(state, victim, events, source);
          hit(
            state,
            source,
            victim,
            (value + (reflected ? 0 : pendulumBonus(state, actor))) *
              (def.doubleAgainstHealthier && victim.health > source.health ? 2 : 1),
            damageType,
            events,
            {
              origin: "ability",
              attackAbility: true,
              delivery: reflected ? "reflection" : undefined,
              interceptionChecked: true,
              blindMiss: reflected ? false : blindMiss,
              cannotDodge: !reflected && cannotDodge,
              sharedDodge: reflected ? undefined : sharedDodge,
              criticalBonus,
              leech:
                def.leech ||
                (!reflected &&
                  (oasisLeech ||
                    (action.side === "player" &&
                      damageType === "water" &&
                      actor.block > 0 &&
                      state.boons.includes("lagoon-chalice")))),
              cardLeech: keywords.includes("leech"),
              sharedNegate: reflected ? undefined : sharedNegate,
            },
          );
          if (sharedDodge) negated.add(victim.id);
          if (reflected) reflectExtras(state, action, recipient, events, power, victim);
        }
      }
      if (action.side === "player") action.actor.attacked = true;
      return { attackTarget, extraAttackTarget, negated, sharedNegate };
    }
    case "guard": {
      const targets =
        def.target === "allAllies"
          ? livingFriends(state, action)
          : cardTargeting(def) === "self"
            ? [actor]
            : battlefieldView(state, action.side).filter((unit) => unit.id === action.allyTargetId);
      for (const recipient of targets) {
        if (actor.health <= 0) break;
        grantBlock(state, recipient, value, events);
      }
      return;
    }
    case "heal": {
      const amount = passiveAmount(enemy ? undefined : state, actor.species, "mendTheBroken");
      const chosen = enemy
        ? state.battle.enemies.find((unit) => unit.id === action.allyTargetId)
        : [...state.team, ...state.reserves].find((unit) => unit.id === action.allyTargetId);
      if (amount && chosen?.health === 0) {
        restoreFallen(context, chosen, Math.min(amount, value));
        return;
      }
      const targets =
        def.target === "allAllies"
          ? healingAllies(state, action.side)
          : cardTargeting(def) === "self"
            ? [actor]
            : def.target === "mostInjured"
              ? [
                  amount && !enemy && chosen?.health
                    ? chosen
                    : mostInjured(healingAllies(state, action.side))!,
                ]
              : battlefieldView(state, action.side).filter(
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
    case "reflectAlly": {
      const recipient =
        def.effect === "reflectAlly"
          ? findLivingBattlefield(state, action.side, (unit) => unit.id === action.allyTargetId)
          : actor;
      if (!recipient) return;
      ensureCombat(recipient).attackReflection = true;
      events.push({
        kind: "status",
        status: "attackReflection",
        outcome: "apply",
        actorId: actor.id,
        targetId: recipient.id,
        text: `${unitName(recipient)} reflects the next attack`,
      });
      return;
    }
    case "resurrect": {
      const matches = (unit: Combatant) => unit.id === action.allyTargetId && unit.health === 0;
      const recipient = enemy
        ? state.battle.enemies.find(matches)
        : (state.team.find(matches) ?? state.reserves.find(matches));
      if (recipient) restoreFallen(context, recipient);
      return;
    }
    case "dreamDouble":
    case "sparkDecoy":
      if (def.effect === "dreamDouble") grantStatus(actor, "thorns", value, events, state);
      else
        for (const recipient of livingOpponents(state, action)) {
          if (actor.health <= 0) break;
          const result = applyHarmfulStatus(state, actor, recipient, value, "burn", events);
          for (const depletion of result.depletions) triggerArmorBreak(state, depletion, events);
        }
      if (actor.health <= 0) return;
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
      for (const recipient of livingFriends(state, action)) {
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
    case "draw":
      if (action.side === "enemy" && action.actor.deck) drawBossCards(state, action.actor.deck, value);
      else if (!enemy) draw(state, value, events);
      return;
    case "redistributeBlock": {
      const recipients = livingFriends(state, action);
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
      for (const recipient of recipients) {
        if (actor.health <= 0) break;
        grantBlock(state, recipient, value, events);
      }
      return;
    }
    case "redraw":
      if (!enemy) redrawHand(state, events);
      return;
    case "recover":
      if (!enemy) drawDiscard(state, events, def.allyOnly ? actor.id : undefined);
      applyExtras(state, action, events, {
        target: findLivingBattlefield(state, action.side, (unit) => unit.id === action.allyTargetId),
        recipientOnly: true,
      });
      return;
    case "mana":
      if (!enemy) gainMana(state, value, events);
      return;
    case "dodge":
      for (const unit of def.target === "allAllies" ? livingFriends(state, action) : [actor])
        grantTemporaryDodge(state, unit, value, events);
      return;
    case "moonlitWaltz":
      stats.dodgeFreezeRetaliation = 3;
      grantTemporaryDodge(state, actor, value, events);
      return;
    case "raincall":
      if (!enemy) drawKeyword(state, "water", events);
      for (const unit of livingFriends(state, action)) {
        if (actor.health <= 0) break;
        if (ensureCombat(unit).burn > 0)
          removeEffects(unit, "cleanse", 1, events, state, "burn", actor, false);
      }
      return;
    case "teamClearBlind":
      if (def.draw) {
        if (action.side === "player") draw(state, value, events);
        else if (action.actor.deck) drawBossCards(state, action.actor.deck, value);
      }
      for (const unit of livingFriends(state, action)) {
        if (action.actor.health <= 0) break;
        if (ensureCombat(unit).blind)
          removeEffects(unit, "cleanse", 1, events, state, "blind", undefined, false);
      }
      return;
    case "swapLowest": {
      let outgoing: Combatant | undefined;
      for (const unit of action.side === "player" ? state.team : state.battle.enemies)
        if (unit.health > 0 && (!outgoing || unit.health < outgoing.health)) outgoing = unit;
      if (outgoing) swapFromCard(state, outgoing, events, true);
      return;
    }
    case "teamBlind":
      for (const unit of livingOpponents(state, action)) {
        if (actor.health <= 0) break;
        applyBlind(state, actor, unit, events);
      }
      return;
    case "teamPurge":
      for (const unit of livingOpponents(state, action)) {
        if (actor.health <= 0) break;
        removeEffects(unit, "purge", Number.MAX_SAFE_INTEGER, events, state, undefined, actor);
      }
      return;
    case "teamCleanse":
      for (const unit of livingFriends(state, action)) {
        if (action.actor.health <= 0) break;
        removeEffects(unit, "cleanse", value, events, state, undefined, undefined, false);
      }
      return;
    case "nullify":
      for (const unit of battlefieldView(state, enemy ? "enemy" : "player")) {
        if (unit.health <= 0) continue;
        ensureCombat(unit).nullify = true;
        emitStatus(events, unit.id, "nullify", "apply", {
          text: `${species(unit.species).name} nullifies the next harmful status effect`,
        });
      }
      return;
    case "teamProtection": {
      const block = roll(state, { kind: "chance", threshold: 0.5 }) < 0.5;
      for (const unit of battlefield(state, enemy ? "enemy" : "player")) {
        if (actor.health <= 0) break;
        if (unit.health <= 0) continue;
        if (block) grantBlock(state, unit, scalePower(value, power), events);
        else grantStatus(unit, "thorns", value, events, state);
      }
      return;
    }
    case "swap":
      swapFromCard(state, actor, events, def.backupOnly);
      return;
    case "swapChosen":
      if (action.side === "player" && action.allyTargetId)
        swapFromCard(state, actor, events, true, action.allyTargetId);
      return;
    case "swapThorns": {
      const incoming = swapFromCard(state, actor, events, true);
      if (incoming && incoming.health > 0) grantStatus(incoming, "thorns", value, events, state);
      return;
    }
    case "swapDodge": {
      const incoming = swapFromCard(state, actor, events);
      if (incoming) grantTemporaryDodge(state, incoming, value, events);
      return;
    }
    case "springbound":
    case "teamThaw":
      for (const unit of livingFriends(state, action)) {
        if (action.actor.health <= 0) break;
        removeControlBuildup(state, unit, "freeze", events, false);
      }
      if (def.effect === "springbound") grantTemporaryDodge(state, actor, value, events);
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
