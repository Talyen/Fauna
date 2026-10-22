import { roll } from "../random";
import { drawKeyword } from "../card-zones";
import { hasTalent, creaturePassive } from "../progression";

import type { GameEvent, GameState } from "../types";
import {
  combat,
  maximumHealth,
  unitName,
  mostInjured,
  STACK_LIMIT,
  harmfulStatuses,
  gainGold,
  type Combatant,
} from "./state";

import { reaction, type Resolution } from "./operations";

export function* restoreHealth(
  unit: Combatant,
  amount: number,
  events: GameEvent[],
  revive = false,
  state?: GameState,
  cardHealing = false,
  source?: Combatant,
): Resolution<void> {
  const baseAmount = amount;
  if (state?.phase === "battle") {
    if (!("maxHealth" in unit) && hasTalent(state, "health.mending")) amount *= 1.1;
    if ("maxHealth" in unit && unit.combat.poison > 0 && hasTalent(state, "poison.necrosis")) amount *= 0.5;
    if ("maxHealth" in unit && unit.combat.bleed > 0 && hasTalent(state, "bleed.mortal-wound")) amount *= 0.5;
  }
  if (unit.health === 0 && !revive) return;
  const gain = Math.min(Math.max(0, Math.round(amount)), maximumHealth(unit) - unit.health);
  const excess = Math.max(0, Math.round(amount) - gain);
  unit.health += gain;
  if (cardHealing && state && !("maxHealth" in unit) && excess > 0) {
    if (hasTalent(state, "health.overflow"))
      yield* reaction("grantBlock", state, unit, Math.round(excess * 0.25), events);
    if (hasTalent(state, "health.clean-slate"))
      yield* reaction("removeEffects", unit, "cleanse", 1, events, state);
  }
  if (gain || amount > 0) {
    events.push({
      kind: "heal",
      targetId: unit.id,
      amount: gain,
      text: `${unitName(unit)} restores ${gain} Health.`,
    });
    if (
      gain > 0 &&
      state?.phase === "battle" &&
      !("maxHealth" in unit) &&
      state.boons.includes("groves-favor")
    )
      yield* reaction("grantStatus", unit, "thorns", 1, events, state);
  }
  if (gain > 0 && source && state?.phase === "battle")
    yield* reaction("bounce", state, source, unit, {
      effect: "heal",
      amount: baseAmount,
      events,
      cardHealing,
    });
}
export function* shareProtection(
  state: GameState,
  source: Combatant,
  effect: "block" | "thorns" | "waterThorns",
  amount: number,
  events: GameEvent[],
): Resolution<void> {
  if (state.phase !== "battle" || !state.battle || source.health <= 0 || amount <= 0) return;
  const allied = !("maxHealth" in source);
  const pool = allied ? state.team : state.battle.enemies;
  if (!pool.some((unit) => unit.id === source.id)) return;
  const recipients = pool.filter((unit) => unit.id !== source.id && unit.health > 0);
  if (!recipients.length) return;
  const chance = creaturePassive(allied ? state : undefined, source.species).effects.reduce(
    (total, entry) => total + (entry.kind === "shareProtection" ? entry.amount : 0),
    0,
  );
  if (chance <= 0 || (chance < 100 && roll(state) >= chance / 100)) return;
  for (const recipient of recipients) {
    if (effect === "block") yield* reaction("grantBlock", state, recipient, amount, events, false);
    else yield* reaction("grantStatus", recipient, effect, amount, events, state, false);
  }
}
export function* grantBlock(
  state: GameState,
  unit: Combatant,
  amount: number,
  events: GameEvent[],
  sharing = true,
): Resolution<void> {
  if (unit.health <= 0 || amount <= 0) return;
  let gained = Math.min(STACK_LIMIT - unit.block, Math.round(amount));
  if (gained > 0 && state.phase === "battle" && state.battle) {
    const allied = !("maxHealth" in unit);
    const pool = allied ? state.team : state.battle.enemies;
    if (pool.some((recipient) => recipient.id === unit.id)) {
      const percent = creaturePassive(allied ? state : undefined, unit.species).effects.reduce(
        (sum, effect) => sum + (effect.kind === "blockConversion" ? effect.amount : 0),
        0,
      );
      const recipient = percent > 0 ? mostInjured<Combatant>(pool) : undefined;
      if (recipient) {
        const converted = Math.min(
          Math.round((gained * percent) / 100),
          maximumHealth(recipient) - recipient.health,
        );
        gained -= converted;
        if (converted > 0) yield* reaction("restoreHealth", recipient, converted, events, false, state);
      }
    }
  }
  if (!gained) return;
  unit.block += gained;
  events.push({
    kind: "block",
    targetId: unit.id,
    amount: gained,
    text: `${unitName(unit)} gains ${gained} Block.`,
  });
  if (!("maxHealth" in unit) && hasTalent(state, "light.radiant-guard") && roll(state) < 0.1)
    drawKeyword(state, "light", events);
  if (!("maxHealth" in unit) && state.boons.includes("ironwood-buckler"))
    yield* reaction("grantStatus", unit, "thorns", 1, events, state, sharing);
  if (sharing) yield* reaction("shareProtection", state, unit, "block", gained, events);
}
export function* gainMana(state: GameState, amount: number, events: GameEvent[]): Resolution<void> {
  if (!state.battle || amount <= 0) return;
  const gained = Math.min(amount, state.battle.maxMana - state.battle.mana);
  state.battle.mana += gained;
  if (gained > 0) {
    events.push({ kind: "status", amount: gained, text: `Gain ${gained} Mana.` });
    if (hasTalent(state, "mana.arcane-mending"))
      for (const unit of state.team) yield* reaction("restoreHealth", unit, gained, events, false, state);
  }
}
export function* grantArmor(
  state: GameState,
  unit: Combatant,
  amount: number,
  events: GameEvent[],
): Resolution<void> {
  if (unit.health <= 0 || amount <= 0) return;
  const allied = !("maxHealth" in unit),
    before = combat(unit).armor;
  if (allied) {
    if (hasTalent(state, "armor.last-stand") && unit.health < maximumHealth(unit) / 2) amount *= 1.25;
    if (hasTalent(state, "armor.reinforced") && roll(state) < 0.1) amount *= 2;
  }
  yield* reaction("grantStatus", unit, "armor", Math.round(amount), events, state);
  if (allied && combat(unit).armor > before && hasTalent(state, "armor.purification") && roll(state) < 0.1)
    yield* reaction("removeEffects", unit, "cleanse", 1, events, state);
}
export function* leechHealth(
  state: GameState,
  unit: Combatant,
  lost: number,
  events: GameEvent[],
  afflicted = false,
): Resolution<void> {
  if (lost <= 0) return;
  let amount = Math.round(lost / 2);
  if (!("maxHealth" in unit)) {
    if (afflicted && hasTalent(state, "leech.affliction-siphon")) amount *= 1.1;
    if (hasTalent(state, "leech.deep-siphon")) amount++;
    if (hasTalent(state, "leech.desperate-siphon") && unit.health < maximumHealth(unit) / 2) amount *= 2;
  }
  const before = unit.health;
  yield* reaction("restoreHealth", unit, amount, events, false, state);
  const restored = unit.health - before;
  if (!("maxHealth" in unit) && restored > 0) {
    if (hasTalent(state, "leech.blood-debt") && roll(state) < 0.1) gainGold(state, restored, events);
    if (
      hasTalent(state, "leech.sanguine-overflow") &&
      before < maximumHealth(unit) &&
      unit.health === maximumHealth(unit)
    )
      yield* reaction("gainMana", state, 1, events);
    if (hasTalent(state, "leech.bloodletting") && roll(state) < 0.1)
      yield* reaction("removeEffects", unit, "cleanse", 1, events, state);
    if (hasTalent(state, "leech.mana-siphon") && roll(state) < 0.1)
      yield* reaction("gainMana", state, 1, events);
  }
}
export function* healthThresholds(
  state: GameState,
  unit: Combatant,
  before: number,
  events: GameEvent[],
): Resolution<void> {
  const stats = combat(unit);
  if (!("maxHealth" in unit) && unit.health > 0) {
    if (before >= maximumHealth(unit) / 2 && unit.health < maximumHealth(unit) / 2) {
      if (hasTalent(state, "armor.steadfast")) yield* reaction("grantArmor", state, unit, 3, events);
      if (hasTalent(state, "health.desperate-guard") && !stats.desperateGuardUsed) {
        stats.desperateGuardUsed = true;
        yield* reaction("grantBlock", state, unit, 6, events);
      }
    }
    if (
      before >= maximumHealth(unit) / 4 &&
      unit.health < maximumHealth(unit) / 4 &&
      hasTalent(state, "health.last-resort")
    )
      yield* reaction("removeEffects", unit, "cleanse", harmfulStatuses.length + 1, events, state);
  }
}
