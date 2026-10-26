import { talentRule } from "../rules/talents";
import { isRosterCreature } from "../battlefield";
import { hasTalent, passiveAmount } from "../progression";
import { chance as succeeds, talentChance } from "../chance";
import { ensureCombat, grantArmor, triggerArmorBreak, removeArmor, type Combatant } from "./index";
import type { ProgressionKeyword } from "../keywords";
import type { GameState, GameEvent } from "../types";

export function encore(state: GameState, actor: Combatant, events: GameEvent[]) {
  const stats = ensureCombat(actor);
  const chance = passiveAmount(isRosterCreature(actor) ? state : undefined, actor.species, "encore");
  if (chance <= 0 || stats.encoreUsed) return false;
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
  const repeatTalents = [
    ["burn", "burn.flash-fire"],
    ["freeze", "freeze.winter-s-grasp"],
    ["nature", "nature.overgrowth"],
    ["poison", "poison.venom-strike"],
    ["stun", "stun.jarring-blow"],
  ] as const;
  return repeatTalents.some(
    ([keyword, talent]) => keywords.includes(keyword) && talentChance(state, talent, events),
  );
}
