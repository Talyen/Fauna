import { battlefield } from "../battlefield";
import { species } from "../content";
import { draw, drawKeyword } from "../card-zones";
import { abilityExtras } from "./ability-values";
import { supplementalRule } from "../rules/supplemental";
import type { SupplementalEffect, SupplementalKind } from "../rules/ability-types";
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
  criticalBonus?: number;
  recipientOnly?: boolean;
  negated?: ReadonlySet<string>;
  sharedNegate?: import("./policy").SharedNegate;
}
interface ExtraContext<K extends SupplementalKind> {
  state: GameState;
  actor: Combatant;
  def: AbilityAction["def"];
  enemy: boolean;
  target: Combatant | undefined;
  events: GameEvent[];
  options: ExtraOptions;
  blindMiss: boolean;
  criticalBonus: number;
  effect: SupplementalEffect & { kind: K };
}
type ExtraHandler<K extends SupplementalKind> = (context: ExtraContext<K>) => void;
interface ReflectedContext<K extends SupplementalKind> {
  state: GameState;
  actor: Combatant;
  reflectedBy: Combatant;
  effect: SupplementalEffect & { kind: K };
  events: GameEvent[];
}
type ExtraHandlers = {
  [K in SupplementalKind]: {
    execute: ExtraHandler<K>;
    reflect: ((context: ReflectedContext<K>) => void) | null;
  };
};

const damageExtra: ExtraHandler<"damage"> = (context) => {
  const { state, actor, def, target, events, options, blindMiss, criticalBonus, effect } = context;
  if (target && !options.negated?.has(target.id))
    hit(state, actor, target, effect.amount, effect.damageType, events, {
      origin: "ability",
      interceptionChecked: true,
      blindMiss,
      criticalBonus,
      leech: effect.leech,
      cardLeech: def.leech || def.effects?.some((effect) => effect.kind === "damage" && effect.leech),
      sharedNegate: options.sharedNegate,
    });
};

const statusExtra: ExtraHandler<"status"> = (context) => {
  const { state, actor, events, effect } = context;
  if (effect.status === "armor") grantArmor(state, actor, effect.amount, events);
  else grantStatus(actor, effect.status, effect.amount, events, state);
};

const meltArmorExtra: ExtraHandler<"meltArmor"> = (context) => {
  const { state, actor, enemy, events, options, effect } = context;
  for (const recipient of battlefield(state, enemy ? "player" : "enemy")) {
    if (actor.health <= 0) break;
    if (recipient.health <= 0 || options.negated?.has(recipient.id)) continue;
    const stats = ensureCombat(recipient);
    const { removed, depletion } = removeArmor(recipient, Math.ceil((stats.armor * effect.amount) / 100));
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
};

const blindExtra: ExtraHandler<"blind"> = (context) => {
  const { state, actor, enemy, events, options } = context;
  for (const recipient of battlefield(state, enemy ? "player" : "enemy")) {
    if (actor.health <= 0) break;
    if (recipient.health > 0 && !options.negated?.has(recipient.id))
      applyBlind(state, actor, recipient, events);
  }
};

const nullifyFreezeExtra: ExtraHandler<"nullifyFreeze"> = (context) => {
  const { actor, events } = context;
  ensureCombat(actor).nullifyFreeze = true;
  events.push({
    kind: "status",
    targetId: actor.id,
    status: "nullify",
    outcome: "apply",
    text: "Nullify the next Freeze damage",
  });
};

const reflectExtra: ExtraHandler<"reflect"> = (context) => {
  const { actor, events, effect } = context;
  if (effect.status === "burn") ensureCombat(actor).reflectBurn = true;
  else ensureCombat(actor).reflect = true;
  events.push({
    kind: "status",
    targetId: actor.id,
    status: "reflect",
    outcome: "apply",
    text: effect.status === "burn" ? "Reflect the next Burn" : "Reflect the next harmful status effect",
  });
};

const cleanseExtra: ExtraHandler<"cleanse"> = (context) => {
  const { state, actor, enemy, target, events, effect } = context;
  for (const recipient of effect.target === "allAllies"
    ? battlefield(state, enemy ? "enemy" : "player").filter((unit) => unit.health > 0)
    : [effect.target === "recipient" && target ? target : actor]) {
    if (actor.health <= 0) break;
    removeEffects(recipient, "cleanse", effect.amount, events, state);
  }
};

const purgeExtra: ExtraHandler<"purge"> = (context) => {
  const { state, actor, target, events, options, effect } = context;
  if (target && !options.negated?.has(target.id))
    removeEffects(target, "purge", effect.amount, events, state, undefined, actor);
};

const healExtra: ExtraHandler<"heal"> = (context) => {
  const { state, actor, target, events, effect } = context;
  const recipient = effect.target === "recipient" ? target : actor;
  if (recipient) restoreHealth(recipient, effect.amount, events, false, state, true, actor);
};

const drawKeywordExtra: ExtraHandler<"drawKeyword"> = (context) => {
  const { state, enemy, events, effect } = context;
  if (!enemy) for (let i = 0; i < effect.amount; i++) drawKeyword(state, effect.keyword, events);
};

const drawExtra: ExtraHandler<"draw"> = (context) => {
  const { state, enemy, events, effect } = context;
  if (!enemy) draw(state, effect.amount, events);
};

const manaExtra: ExtraHandler<"mana"> = (context) => {
  const { state, enemy, events, effect } = context;
  if (!enemy) gainMana(state, effect.amount, events);
};

const handlers: ExtraHandlers = {
  damage: {
    execute: damageExtra,
    reflect: ({ state, actor, reflectedBy, effect, events }) => {
      hit(state, reflectedBy, actor, effect.amount, effect.damageType, events, {
        origin: "ability",
        delivery: "reflection",
        interceptionChecked: true,
        blindMiss: false,
        leech: effect.leech,
      });
    },
  },
  status: { execute: statusExtra, reflect: null },
  meltArmor: {
    execute: meltArmorExtra,
    reflect: ({ state, actor, effect, events }) => {
      const { depletion } = removeArmor(actor, Math.ceil((ensureCombat(actor).armor * effect.amount) / 100));
      triggerArmorBreak(state, depletion, events);
    },
  },
  blind: {
    execute: blindExtra,
    reflect: ({ state, actor, reflectedBy, events }) => {
      applyBlind(state, reflectedBy, actor, events);
    },
  },
  nullifyFreeze: { execute: nullifyFreezeExtra, reflect: null },
  reflect: { execute: reflectExtra, reflect: null },
  cleanse: { execute: cleanseExtra, reflect: null },
  purge: {
    execute: purgeExtra,
    reflect: ({ state, actor, reflectedBy, effect, events }) => {
      removeEffects(actor, "purge", effect.amount, events, state, undefined, reflectedBy);
    },
  },
  heal: { execute: healExtra, reflect: null },
  drawKeyword: { execute: drawKeywordExtra, reflect: null },
  draw: { execute: drawExtra, reflect: null },
  mana: { execute: manaExtra, reflect: null },
};

function executeExtra<K extends SupplementalKind>(context: ExtraContext<K>) {
  handlers[context.effect.kind].execute(context);
}
function dispatchReflectedExtra<K extends SupplementalKind>(context: ReflectedContext<K>) {
  handlers[context.effect.kind].reflect?.(context);
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
    executeExtra({ state, actor, def, enemy, target, events, options, blindMiss, criticalBonus, effect });
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
    dispatchReflectedExtra({ state, actor: action.actor, reflectedBy, effect, events });
  }
}
