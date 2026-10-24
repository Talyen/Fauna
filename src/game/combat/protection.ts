import { talentRule } from "../rules/talents";
import { boonRule } from "../rules/boons";
import { healingValue, restoration, overflowBlock } from "./healing-values";
import { chance as succeeds } from "../chance";
import { isEnemy, battlefield } from "../battlefield";
import { drawKeyword } from "../card-zones";
import { hasTalent, creaturePassive } from "../progression";

import type { GameEvent, GameState } from "../types";
import {
  ensureCombat,
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
  amount = healingValue(state, unit, amount);
  if (unit.health === 0 && !revive) return;
  const { gain, excess } = restoration(unit, amount);
  unit.health += gain;
  if (cardHealing && state && !isEnemy(unit) && excess > 0) {
    if (hasTalent(state, "health.overflow"))
      yield* reaction("grantBlock", state, unit, overflowBlock(excess), events);
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
    if (gain > 0 && state?.phase === "battle" && !isEnemy(unit) && state.boons.includes("groves-favor"))
      yield* reaction("grantStatus", unit, "thorns", boonRule("groves-favor").thorns, events, state);
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
  const allied = !isEnemy(source);
  const chance = creaturePassive(allied ? state : undefined, source.species).effects.reduce(
    (total, entry) => total + (entry.kind === "shareProtection" ? entry.amount : 0),
    0,
  );
  if (chance <= 0) return;
  const pool = battlefield(state, allied ? "player" : "enemy");
  if (!pool.some((unit) => unit.id === source.id)) return;
  const recipients = pool.filter((unit) => unit.id !== source.id && unit.health > 0);
  if (!recipients.length) return;
  if (!succeeds(state, chance / 100, !allied, events)) return;
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
    const allied = !isEnemy(unit);
    const percent = creaturePassive(allied ? state : undefined, unit.species).effects.reduce(
      (sum, effect) => sum + (effect.kind === "blockConversion" ? effect.amount : 0),
      0,
    );
    if (percent > 0) {
      const pool = battlefield(state, allied ? "player" : "enemy");
      const recipient = pool.some((recipient) => recipient.id === unit.id)
        ? mostInjured<Combatant>(pool)
        : undefined;
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
  if (
    !isEnemy(unit) &&
    hasTalent(state, "light.radiant-guard") &&
    succeeds(state, talentRule("light.radiant-guard").percent / 100, false, events)
  )
    drawKeyword(state, "light", events);
  if (!isEnemy(unit) && state.boons.includes("ironwood-buckler"))
    yield* reaction(
      "grantStatus",
      unit,
      "thorns",
      boonRule("ironwood-buckler").thorns,
      events,
      state,
      sharing,
    );
  if (sharing) yield* reaction("shareProtection", state, unit, "block", gained, events);
}
export function* gainMana(state: GameState, amount: number, events: GameEvent[]): Resolution<void> {
  if (!state.battle || amount <= 0) return;
  const gained = Math.min(amount, state.battle.maxMana - state.battle.mana);
  state.battle.mana += gained;
  if (gained > 0) {
    events.push({ kind: "status", amount: gained, text: `Gain ${gained} Mana.` });
    if (hasTalent(state, "mana.arcane-mending"))
      for (const unit of battlefield(state, "player"))
        yield* reaction(
          "restoreHealth",
          unit,
          gained * talentRule("mana.arcane-mending").amount,
          events,
          false,
          state,
        );
  }
}
export function* grantArmor(
  state: GameState,
  unit: Combatant,
  amount: number,
  events: GameEvent[],
): Resolution<void> {
  if (unit.health <= 0 || amount <= 0) return;
  const allied = !isEnemy(unit),
    before = ensureCombat(unit).armor;
  if (allied) {
    if (hasTalent(state, "armor.last-stand") && unit.health < maximumHealth(unit) / 2)
      amount *= 1 + talentRule("armor.last-stand").percent / 100;
    if (
      hasTalent(state, "armor.reinforced") &&
      succeeds(state, talentRule("armor.reinforced").percent / 100, false, events)
    )
      amount *= 2;
  }
  yield* reaction("grantStatus", unit, "armor", Math.round(amount), events, state);
  if (
    allied &&
    ensureCombat(unit).armor > before &&
    hasTalent(state, "armor.purification") &&
    succeeds(state, talentRule("armor.purification").percent / 100, false, events)
  )
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
  let amount = lost / 2;
  if (!isEnemy(unit)) {
    if (afflicted && hasTalent(state, "leech.affliction-siphon"))
      amount *= 1 + talentRule("leech.affliction-siphon").percent / 100;
    if (hasTalent(state, "leech.deep-siphon")) amount += talentRule("leech.deep-siphon").amount;
    if (hasTalent(state, "leech.desperate-siphon") && unit.health < maximumHealth(unit) / 2) amount *= 2;
  }
  const before = unit.health;
  yield* reaction("restoreHealth", unit, amount, events, false, state);
  const restored = unit.health - before;
  if (!isEnemy(unit) && restored > 0) {
    if (
      hasTalent(state, "leech.blood-debt") &&
      succeeds(state, talentRule("leech.blood-debt").percent / 100, false, events)
    )
      gainGold(state, restored, events);
    if (
      hasTalent(state, "leech.sanguine-overflow") &&
      before < maximumHealth(unit) &&
      unit.health === maximumHealth(unit)
    )
      yield* reaction("gainMana", state, talentRule("leech.sanguine-overflow").amount, events);
    if (
      hasTalent(state, "leech.bloodletting") &&
      succeeds(state, talentRule("leech.bloodletting").percent / 100, false, events)
    )
      yield* reaction("removeEffects", unit, "cleanse", 1, events, state);
    if (
      hasTalent(state, "leech.mana-siphon") &&
      succeeds(state, talentRule("leech.mana-siphon").percent / 100, false, events)
    )
      yield* reaction("gainMana", state, talentRule("leech.mana-siphon").amount, events);
  }
}
export function* healthThresholds(
  state: GameState,
  unit: Combatant,
  before: number,
  events: GameEvent[],
): Resolution<void> {
  const stats = ensureCombat(unit);
  if (!isEnemy(unit) && unit.health > 0) {
    if (before >= maximumHealth(unit) / 2 && unit.health < maximumHealth(unit) / 2) {
      if (hasTalent(state, "armor.steadfast"))
        yield* reaction("grantArmor", state, unit, talentRule("armor.steadfast").amount, events);
      if (hasTalent(state, "health.desperate-guard") && !stats.desperateGuardUsed) {
        stats.desperateGuardUsed = true;
        yield* reaction("grantBlock", state, unit, talentRule("health.desperate-guard").amount, events);
      }
    }
    if (
      before >= maximumHealth(unit) / (100 / talentRule("health.last-resort").percent) &&
      unit.health < maximumHealth(unit) / (100 / talentRule("health.last-resort").percent) &&
      hasTalent(state, "health.last-resort")
    )
      yield* reaction("removeEffects", unit, "cleanse", harmfulStatuses.length + 1, events, state);
  }
}
