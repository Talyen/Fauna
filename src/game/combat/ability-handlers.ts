import { cardActor, drawableOwnerIds } from "../card-actors";
import { grantCardRepeat } from "./card-repeat";
import { createFood } from "./food";
import { takeAttackReflection } from "./attack-reflection";
import { resurrect } from "./resurrection";
import { cardTargeting } from "../card-rules";
import { interceptAttack } from "./interception";
import { battlefield, healingAllies } from "../battlefield";
import { summonEcho, createPearls, drawBossCards } from "./legendary";
import { definition, species } from "../content";
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
import { receiveCard, draw, redrawHand } from "../card-zones";
import type { GameState, GameEvent } from "../types";
import { applyExtras, reflectExtras } from "./ability-extras";
import {
  friendlyRow,
  opposingRow,
  alive,
  type PrimaryHandler,
  type PrimaryHandlers,
  type PrimaryContext,
} from "./ability-context";
import type { AbilityKind } from "../rules/ability-types";
import type { Combatant } from "./state";

function purgeAttackThorns(state: GameState, unit: Combatant, events: GameEvent[], source: Combatant) {
  for (const status of ["thorns", "waterThorns"] as const)
    if (ensureCombat(unit)[status] > 0) removeEffects(unit, "purge", 1, events, state, status, source);
}

function recoverDiscard(state: GameState, events: GameEvent[]) {
  const battle = state.battle!;
  const available = battle.discard.filter((id) => {
    const card = state.cards.find((entry) => entry.id === id)!;
    return card.ownerId === null || drawableOwnerIds(state).has(card.ownerId);
  });
  if (!available.length) return;
  const id =
    available[Math.floor(roll(state, { kind: "index", size: available.length }) * available.length)]!;
  battle.discard.splice(battle.discard.indexOf(id), 1);
  receiveCard(state, id);
  const card = state.cards.find((entry) => entry.id === id)!;
  events.push({
    kind: "action",
    actionType: "support",
    actorId: card.ownerId ?? cardActor(state, card)!.id,
    text: `${definition(card.definitionId).name} returns to your hand`,
  });
}
function hushDome(state: GameState, enemy: boolean, events: GameEvent[]) {
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
}

function teamProtection(
  state: GameState,
  enemy: boolean,
  amount: number,
  events: GameEvent[],
  power: number,
) {
  const block = roll(state, { kind: "chance", threshold: 0.5 }) < 0.5;
  for (const unit of battlefield(state, enemy ? "enemy" : "player")) {
    if (unit.health <= 0) continue;
    if (block) grantBlock(state, unit, scalePower(amount, power), events);
    else grantStatus(unit, "thorns", amount, events, state);
  }
}

const processionAbility: PrimaryHandler<"procession"> = (context) => {
  const { state, action, actor, value, events } = context;
  summonEcho(state, actor, action.side, value, events);
};

const createFoodAbility: PrimaryHandler<"createFood"> = (context) => {
  const { state, action, value, events } = context;
  if (action.side === "player") createFood(state, action.actor, value, events);
};

const createPearlsAbility: PrimaryHandler<"createPearls"> = (context) => {
  const { state, action, actor, value, events } = context;
  createPearls(state, actor, action.side, value, events);
};

const pearlAbility: PrimaryHandler<"pearl"> = (context) => {
  const { state, action, actor, value, events, power } = context;
  if (roll(state, { kind: "chance", threshold: 0.5 }) < 0.5)
    grantBlock(state, actor, scalePower(value, power), events);
  else if (action.side === "enemy" && action.actor.deck)
    action.actor.deck.mana = Math.min(4, action.actor.deck.mana + value);
  else gainMana(state, value, events);
};

const attackAbility: PrimaryHandler<"attack"> = (context) => {
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
  } = context;
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
  for (const intended of targets) {
    if (actor.health <= 0) break;
    const recipient = blindMiss ? intended : interceptAttack(state, actor, intended, events);
    if (def.target !== "allEnemies") attackTarget = recipient;
    if (!blindMiss && negateAttack(state, actor, recipient, events)) {
      negated.add(recipient.id);
      continue;
    }
    if (!blindMiss && takeAttackReflection(actor, recipient, events)) {
      negated.add(recipient.id);
      if (negateAttack(state, recipient, actor, events)) continue;
      if (def.purgeThorns) {
        purgeAttackThorns(state, actor, events, recipient);
      }
      hit(
        state,
        recipient,
        actor,
        value * (def.doubleAgainstHealthier && recipient.health > actor.health ? 2 : 1),
        damageType,
        events,
        {
          origin: "ability",
          delivery: "reflection",
          interceptionChecked: true,
          blindMiss: false,
          leech: def.leech,
          cardLeech: keywords.includes("leech"),
        },
      );
      reflectExtras(state, action, recipient, events, power);
      continue;
    }
    if (def.purgeThorns) {
      purgeAttackThorns(state, recipient, events, actor);
    }
    hit(
      state,
      actor,
      recipient,
      value * (def.doubleAgainstHealthier && recipient.health > actor.health ? 2 : 1),
      damageType,
      events,
      {
        origin: "ability",
        interceptionChecked: true,
        blindMiss,
        criticalBonus,
        leech: def.leech,
        cardLeech: keywords.includes("leech"),
      },
    );
  }
  if (action.side === "player") action.actor.attacked = true;
  context.attackTarget = attackTarget;
};

const guardAbility: PrimaryHandler<"guard"> = (context) => {
  const { state, action, actor, def, value, events } = context;
  const targets =
    def.target === "allAllies"
      ? alive(friendlyRow(state, action))
      : cardTargeting(def) === "self"
        ? [actor]
        : friendlyRow(state, action).filter((unit) => unit.id === action.allyTargetId);
  for (const recipient of targets) grantBlock(state, recipient, value, events);
};

const healAbility: PrimaryHandler<"heal"> = (context) => {
  const { state, action, actor, def, value, events } = context;
  const allies = healingAllies(state, action.side);
  const targets =
    def.target === "allAllies"
      ? alive(allies)
      : cardTargeting(def) === "self"
        ? [actor]
        : def.target === "mostInjured"
          ? [mostInjured(allies)!]
          : friendlyRow(state, action).filter((unit) => unit.id === action.allyTargetId && unit.health > 0);
  for (const recipient of targets) {
    restoreHealth(recipient, value, events, false, state, true, actor);
    applyExtras(state, action, events, { target: recipient, recipientOnly: true });
  }
};

const reflectAttackAbility: PrimaryHandler<"reflectAttack"> = (context) => {
  const { actor, events, name, stats } = context;
  stats.attackReflection = true;
  events.push({
    kind: "status",
    status: "attackReflection",
    outcome: "apply",
    actorId: actor.id,
    targetId: actor.id,
    text: `${name} reflects the next attack`,
  });
};

const resurrectAbility: PrimaryHandler<"resurrect"> = (context) => {
  const { state, action, actor, events, enemy } = context;
  const recipients = enemy ? state.battle.enemies : [...state.team, ...state.reserves];
  const recipient = recipients.find((unit) => unit.id === action.allyTargetId && unit.health === 0);
  if (recipient) resurrect(recipient, actor, events);
};

const dreamDoubleAbility: PrimaryHandler<"dreamDouble"> = (context) => {
  const { state, actor, value, events, name } = context;
  grantStatus(actor, "thorns", value, events, state);
  ensureCombat(actor).negate = true;
  events.push({
    kind: "status",
    actorId: actor.id,
    targetId: actor.id,
    status: "negate",
    outcome: "apply",
    text: `${name} negates the next attack against them`,
  });
};

const nightmareHarvestAbility: PrimaryHandler<"nightmareHarvest"> = (context) => {
  const { state, action, value, events, enemy } = context;
  let removed = 0;
  for (const recipient of alive(friendlyRow(state, action)))
    removed += removeEffects(recipient, "cleanse", Number.MAX_SAFE_INTEGER, events, state);
  if (!enemy) gainMana(state, removed * value, events);
  else if (action.side === "enemy" && action.actor.deck)
    action.actor.deck.mana = Math.min(4, action.actor.deck.mana + removed * value);
};

const waterThornsAbility: PrimaryHandler<"waterThorns"> = (context) => {
  const { state, actor, value, events } = context;
  grantStatus(actor, "waterThorns", value, events, state);
};

const drawAbility: PrimaryHandler<"draw"> = (context) => {
  const { state, action, value, events, enemy } = context;
  if (action.side === "enemy" && action.actor.deck) drawBossCards(state, action.actor.deck, value);
  else if (!enemy) draw(state, value, events);
};

const redistributeBlockAbility: PrimaryHandler<"redistributeBlock"> = (context) => {
  const { state, action, actor, value, events } = context;
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
};

const redrawAbility: PrimaryHandler<"redraw"> = (context) => {
  const { state, events, enemy } = context;
  if (!enemy) redrawHand(state, events);
};

const recoverAbility: PrimaryHandler<"recover"> = (context) => {
  const { state, action, events, enemy } = context;
  if (!enemy) recoverDiscard(state, events);
  applyExtras(state, action, events, {
    target: friendlyRow(state, action).find((unit) => unit.id === action.allyTargetId && unit.health > 0),
    recipientOnly: true,
  });
};

const manaAbility: PrimaryHandler<"mana"> = (context) => {
  const { state, value, events, enemy } = context;
  if (!enemy) gainMana(state, value, events);
};

const dodgeAbility: PrimaryHandler<"dodge"> = (context) => {
  const { state, action, actor, def, value, events } = context;
  for (const unit of def.target === "allAllies" ? alive(friendlyRow(state, action)) : [actor])
    grantTemporaryDodge(unit, value, events);
};

const teamClearBlindAbility: PrimaryHandler<"teamClearBlind"> = (context) => {
  const { state, action, events } = context;
  for (const unit of alive(friendlyRow(state, action)))
    if (ensureCombat(unit).blind) removeEffects(unit, "cleanse", 1, events, state, "blind");
};

const swapLowestAbility: PrimaryHandler<"swapLowest"> = (context) => {
  const { state, action, events, operations } = context;
  const outgoing = alive(action.side === "player" ? state.team : state.battle.enemies).sort(
    (a, b) => a.health - b.health,
  )[0];
  if (outgoing) operations.swap(state, outgoing, events, true);
};

function thawAllies({ state, action, events }: Pick<PrimaryContext, "state" | "action" | "events">) {
  for (const unit of alive(friendlyRow(state, action))) {
    if (action.actor.health <= 0) break;
    removeControlBuildup(state, unit, "freeze", events);
  }
}
const teamThawAbility: PrimaryHandler<"teamThaw"> = thawAllies;

const teamBlindAbility: PrimaryHandler<"teamBlind"> = (context) => {
  const { state, action, actor, events } = context;
  for (const unit of alive(opposingRow(state, action))) applyBlind(state, actor, unit, events);
};

const teamPurgeAbility: PrimaryHandler<"teamPurge"> = (context) => {
  const { state, action, actor, events } = context;
  for (const unit of alive(opposingRow(state, action))) {
    if (actor.health <= 0) break;
    removeEffects(unit, "purge", Number.MAX_SAFE_INTEGER, events, state, undefined, actor);
  }
};

const teamCleanseAbility: PrimaryHandler<"teamCleanse"> = (context) => {
  const { state, action, value, events } = context;
  for (const unit of alive(friendlyRow(state, action))) removeEffects(unit, "cleanse", value, events, state);
};

const nullifyAbility: PrimaryHandler<"nullify"> = (context) => {
  const { state, events, enemy } = context;
  hushDome(state, enemy, events);
};

const teamProtectionAbility: PrimaryHandler<"teamProtection"> = (context) => {
  const { state, value, events, enemy, power } = context;
  teamProtection(state, enemy, value, events, power);
};

const swapAbility: PrimaryHandler<"swap"> = (context) => {
  const { state, actor, events, operations } = context;
  operations.swap(state, actor, events);
};

const swapDodgeAbility: PrimaryHandler<"swapDodge"> = ({ state, actor, value, events, operations }) => {
  const incoming = operations.swap(state, actor, events);
  if (incoming) grantTemporaryDodge(incoming, value, events);
};

const springboundAbility: PrimaryHandler<"springbound"> = (context) => {
  thawAllies(context);
  grantTemporaryDodge(context.actor, context.value, context.events);
};

const repeatNextCardAbility: PrimaryHandler<"repeatNextCard"> = ({ state, action, actor, events }) => {
  grantCardRepeat(state, action.side, actor.id, events);
};

const handlers: PrimaryHandlers = {
  swapDodge: swapDodgeAbility,
  springbound: springboundAbility,
  repeatNextCard: repeatNextCardAbility,
  procession: processionAbility,
  createFood: createFoodAbility,
  createPearls: createPearlsAbility,
  pearl: pearlAbility,
  attack: attackAbility,
  guard: guardAbility,
  heal: healAbility,
  reflectAttack: reflectAttackAbility,
  resurrect: resurrectAbility,
  dreamDouble: dreamDoubleAbility,
  nightmareHarvest: nightmareHarvestAbility,
  waterThorns: waterThornsAbility,
  draw: drawAbility,
  redistributeBlock: redistributeBlockAbility,
  redraw: redrawAbility,
  recover: recoverAbility,
  mana: manaAbility,
  dodge: dodgeAbility,
  teamClearBlind: teamClearBlindAbility,
  swapLowest: swapLowestAbility,
  teamThaw: teamThawAbility,
  teamBlind: teamBlindAbility,
  teamPurge: teamPurgeAbility,
  teamCleanse: teamCleanseAbility,
  nullify: nullifyAbility,
  teamProtection: teamProtectionAbility,
  swap: swapAbility,
};

export function executePrimary<K extends AbilityKind>(context: PrimaryContext<K>) {
  handlers[context.def.effect](context);
}
