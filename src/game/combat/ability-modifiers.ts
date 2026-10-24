import { talentRule } from "../rules/talents";
import { isRosterCreature } from "../battlefield";
import { creaturePassive, hasTalent } from "../progression";
import { chance as succeeds } from "../chance";
import { ensureCombat, grantArmor, triggerArmorBreak, removeArmor, type Combatant } from "./index";
import type { ProgressionKeyword } from "../keywords";
import type { GameState, GameEvent } from "../types";

export function encore(state: GameState, actor: Combatant, events: GameEvent[]) {
  const stats = ensureCombat(actor);
  const chance = creaturePassive(isRosterCreature(actor) ? state : undefined, actor.species).effects.reduce(
    (total, effect) => total + (effect.kind === "encore" ? effect.amount : 0),
    0,
  );
  if (chance <= 0 || stats.encoreUsed) return false;
  stats.encoreUsed = true;
  return succeeds(state, chance / 100, !isRosterCreature(actor), events);
}
export function kindlingFlourish(state: GameState, actor: Combatant, events: GameEvent[]) {
  const chance = creaturePassive(isRosterCreature(actor) ? state : undefined, actor.species).effects.reduce(
    (total, effect) => total + (effect.kind === "kindlingFlourish" ? effect.amount : 0),
    0,
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
  if (!enemy) {
    if (target && keywords.includes("leech") && hasTalent(state, "leech.armor-siphon")) {
      const { removed: stolen, depletion } = removeArmor(target, talentRule("leech.armor-siphon").amount);
      grantArmor(state, actor, stolen, events);
      triggerArmorBreak(state, depletion, events);
    }
    if (
      keywords.includes("block") &&
      hasTalent(state, "armor.armored-surge") &&
      succeeds(state, talentRule("armor.armored-surge").percent / 100, enemy, events)
    )
      grantArmor(state, actor, talentRule("armor.armored-surge").amount, events);
  }
}
export function talentRepeat(
  state: GameState,
  keywords: readonly ProgressionKeyword[],
  enemy: boolean,
  events: GameEvent[],
) {
  const repeatTalents = [
    ["burn", "burn.flash-fire"],
    ["freeze", "freeze.winter-s-grasp"],
    ["nature", "nature.overgrowth"],
    ["poison", "poison.venom-strike"],
    ["stun", "stun.jarring-blow"],
  ] as const;
  return (
    !enemy &&
    repeatTalents.some(
      ([keyword, talent]) =>
        keywords.includes(keyword) &&
        hasTalent(state, talent) &&
        succeeds(state, talentRule(talent).percent / 100, enemy, events),
    )
  );
}
