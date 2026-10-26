import { talentRule } from "../rules/talents";
import { boonRule } from "../rules/boons";
import { manaCapacity } from "../ability-rules";
import { healingValue, restoration, overflowBlock, overflowRecipients } from "./healing-values";
import { chance as succeeds, talentChance } from "../chance";
import { isEnemy, battlefield, healingAllies } from "../battlefield";
import { drawKeyword } from "../card-zones";
import { hasTalent, passiveAmount } from "../progression";

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
import { clearHarmfulStatus } from "./status-state";

export function* restoreHealth(
  unit: Combatant,
  amount: number,
  events: GameEvent[],
  revive = false,
  state?: GameState,
  cardHealing = false,
  source?: Combatant,
  options: { shareOverflow?: boolean; adjusted?: boolean; bounce?: boolean } = {},
): Resolution<void> {
  const baseAmount = amount;
  if (!options.adjusted) amount = healingValue(state, unit, amount);
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
  if (gain > 0 && state?.phase === "battle" && !isEnemy(unit)) {
    const stats = ensureCombat(unit);
    if (source && !isEnemy(source) && source.health > 0 && state.boons.includes("grafting-needle")) {
      // A floor copies resilience without compounding Armor-gain multipliers or healing reactions
      const floor = Math.round(ensureCombat(source).armor / boonRule("grafting-needle").divisor);
      if (floor > stats.armor)
        yield* reaction("grantStatus", unit, "armor", floor - stats.armor, events, state);
    }
    if (state.boons.includes("thaw-spoon") && stats.freeze > 0) {
      const removed = Math.min(gain, stats.freeze);
      stats.freeze -= removed;
      if (!stats.freeze) clearHarmfulStatus(stats, "freeze");
      events.push({
        kind: "status",
        targetId: unit.id,
        status: "freeze",
        outcome: "remove",
        amount: removed,
        text: `${unitName(unit)} loses ${removed} Freeze buildup`,
      });
    }
    if (
      source &&
      !isEnemy(source) &&
      source.id !== unit.id &&
      source.health > 0 &&
      state.boons.includes("lovers-knot")
    )
      yield* reaction("restoreHealth", source, gain, events, false, state, false, undefined, {
        adjusted: true,
      });
  }
  if (gain > 0 && source && options.bounce !== false && state?.phase === "battle")
    yield* reaction("bounce", state, source, unit, {
      effect: "heal",
      amount: baseAmount,
      events,
      cardHealing,
    });
  if (
    options.shareOverflow !== false &&
    excess > 0 &&
    state?.phase === "battle" &&
    !isEnemy(unit) &&
    state.boons.includes("last-threshold")
  ) {
    let remaining = excess;
    const recipients = overflowRecipients(state, unit);
    while (remaining > 0) {
      const recipient = mostInjured(recipients);
      if (!recipient) break;
      recipients.splice(recipients.indexOf(recipient), 1);
      const amount = Math.min(remaining, maximumHealth(recipient) - recipient.health);
      remaining -= amount;
      yield* reaction("restoreHealth", recipient, amount, events, false, state, false, undefined, {
        adjusted: true,
        shareOverflow: false,
      });
    }
  }
}
export function* shareProtection(
  state: GameState,
  source: Combatant,
  effect: "block" | "thorns" | "waterThorns" | "fireThorns",
  amount: number,
  events: GameEvent[],
): Resolution<void> {
  if (state.phase !== "battle" || !state.battle || source.health <= 0 || amount <= 0) return;
  const allied = !isEnemy(source);
  const chance = passiveAmount(allied ? state : undefined, source.species, "shareProtection");
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
    const percent = passiveAmount(allied ? state : undefined, unit.species, "blockConversion");
    if (percent > 0) {
      const pool = battlefield(state, allied ? "player" : "enemy");
      const recipient = pool.some((recipient) => recipient.id === unit.id)
        ? mostInjured<Combatant>(healingAllies(state, allied ? "player" : "enemy"))
        : undefined;
      if (recipient) {
        const converted = Math.min(
          Math.round((gained * percent) / 100),
          maximumHealth(recipient) - recipient.health,
        );
        gained -= converted;
        if (converted > 0)
          yield* reaction("restoreHealth", recipient, converted, events, false, state, false, unit, {
            bounce: false,
          });
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
  if (!isEnemy(unit) && talentChance(state, "light.radiant-guard", events))
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
  const capacity = manaCapacity(state);
  const gained = Math.max(0, Math.min(amount, capacity - state.battle.mana));
  state.battle.mana += gained;
  if (gained > 0) {
    events.push({ kind: "status", amount: gained, text: `Gain ${gained} Mana.` });
    if (hasTalent(state, "mana.arcane-mending"))
      for (const unit of healingAllies(state))
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
    if (talentChance(state, "armor.reinforced", events)) amount *= 2;
  }
  yield* reaction("grantStatus", unit, "armor", Math.round(amount), events, state);
  if (allied && ensureCombat(unit).armor > before && talentChance(state, "armor.purification", events))
    yield* reaction("removeEffects", unit, "cleanse", 1, events, state);
}
export function* leechHealth(
  state: GameState,
  unit: Combatant,
  dealt: number,
  events: GameEvent[],
  afflicted = false,
  target?: Combatant,
): Resolution<void> {
  if (dealt <= 0) return;
  let amount = dealt / 2;
  if (!isEnemy(unit)) {
    if (afflicted && hasTalent(state, "leech.affliction-siphon"))
      amount *= 1 + talentRule("leech.affliction-siphon").percent / 100;
    if (hasTalent(state, "leech.deep-siphon")) amount += talentRule("leech.deep-siphon").amount;
    if (hasTalent(state, "leech.desperate-siphon") && unit.health < maximumHealth(unit) / 2) amount *= 2;
  }
  const before = unit.health;
  const excess = restoration(unit, healingValue(state, unit, amount)).excess;
  yield* reaction("restoreHealth", unit, amount, events, false, state);
  const restored = unit.health - before;
  if (!isEnemy(unit) && restored > 0) {
    if (talentChance(state, "leech.blood-debt", events)) gainGold(state, restored, events);
    if (
      hasTalent(state, "leech.sanguine-overflow") &&
      before < maximumHealth(unit) &&
      unit.health === maximumHealth(unit)
    )
      yield* reaction("gainMana", state, talentRule("leech.sanguine-overflow").amount, events);
    if (talentChance(state, "leech.bloodletting", events))
      yield* reaction("removeEffects", unit, "cleanse", 1, events, state);
    if (talentChance(state, "leech.mana-siphon", events))
      yield* reaction("gainMana", state, talentRule("leech.mana-siphon").amount, events);
  }
  if (
    state.phase === "battle" &&
    unit.health > 0 &&
    !isEnemy(unit) &&
    target &&
    isEnemy(target) &&
    target.health > 0 &&
    excess > 0 &&
    state.boons.includes("obsidian-pitcher")
  ) {
    const burn = Math.round(excess / boonRule("obsidian-pitcher").divisor);
    if (burn > 0) yield* reaction("applyHarmfulStatus", state, unit, target, burn, "burn", events);
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
