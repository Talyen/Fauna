import { talentRule } from "../rules/talents";
import { isRosterCreature } from "../battlefield";
import { hasTalent, passiveAmount } from "../progression";
import { chance as succeeds, talentChance } from "../chance";
import {
  ensureCombat,
  grantArmor,
  triggerArmorBreak,
  removeArmor,
  armorStealRewards,
  type Combatant,
} from "./index";
import type { ProgressionKeyword } from "../keywords";
import type { GameState, GameEvent } from "../types";

export function encore(state: GameState, actor: Combatant, events: GameEvent[]) {
  const stats = ensureCombat(actor);
  if (stats.encoreUsed) return false;
  const chance = passiveAmount(isRosterCreature(actor) ? state : undefined, actor.species, "encore");
  if (chance <= 0) return false;
  stats.encoreUsed = true;
  return succeeds(state, chance / 100, !isRosterCreature(actor), events);
}
export function kindlingFlourish(state: GameState, actor: Combatant, events: GameEvent[]) {
  const chance = passiveAmount(
    isRosterCreature(actor) ? state : undefined,
    actor.species,
    "kindlingFlourish",
  );
  return succeeds(state, chance / 100, !isRosterCreature(actor), events);
}
export function beforeAbility(
  state: GameState,
  actor: Combatant,
  target: Combatant | undefined,
  keywords: readonly ProgressionKeyword[],
  enemy: boolean,
  events: GameEvent[],
) {
  if (enemy) return;
  if (target && keywords.includes("leech") && hasTalent(state, "leech.armor-siphon")) {
    const { removed: stolen, depletion } = removeArmor(target, talentRule("leech.armor-siphon").amount);
    grantArmor(state, actor, stolen, events);
    if (state.boons.includes("orbit-tongs")) armorStealRewards(state, actor, stolen, events);
    triggerArmorBreak(state, depletion, events);
  }
  if (keywords.includes("block") && talentChance(state, "armor.armored-surge", events))
    grantArmor(state, actor, talentRule("armor.armored-surge").amount, events);
}
export function talentRepeat(
  state: GameState,
  keywords: readonly ProgressionKeyword[],
  enemy: boolean,
  events: GameEvent[],
) {
  if (enemy) return false;
  return (
    (keywords.includes("burn") && talentChance(state, "burn.flash-fire", events)) ||
    (keywords.includes("freeze") && talentChance(state, "freeze.winter-s-grasp", events)) ||
    (keywords.includes("nature") && talentChance(state, "nature.overgrowth", events)) ||
    (keywords.includes("poison") && talentChance(state, "poison.venom-strike", events)) ||
    (keywords.includes("stun") && talentChance(state, "stun.jarring-blow", events))
  );
}
