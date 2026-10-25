import { Immer } from "immer";
import { battlefield } from "../battlefield";
import { enemyAbilityValue } from "../ability-rules";
import { cardTargeting } from "../card-rules";
import type { CardDefinition } from "../content/types";
import { observeDecisions } from "../random";
import { swapFromCard } from "../team";
import type { BattleState, CombatState, Enemy } from "../types";
import { executeAbility } from "./abilities";
import { lastWarmth } from "./card-modifiers";
import { courtRemembers } from "./legendary";
import { highestHealth, type Combatant } from "./state";

// Evaluation also accepts live mutable turn drafts; shared branches must never be frozen.
const evaluation = new Immer({ autoFreeze: false });

const benefits = [
  "armor",
  "thorns",
  "waterThorns",
  "fireThorns",
  "dodge",
  "temporaryDodge",
  "nextPhysical",
  "reflect",
  "reflectBurn",
  "nullify",
  "nullifyFreeze",
  "negate",
  "attackReflection",
] as const satisfies readonly (keyof CombatState)[];
const harms = [
  "burn",
  "poison",
  "bleed",
  "stun",
  "freeze",
  "blind",
  "controlTurns",
] as const satisfies readonly (keyof CombatState)[];

function unitValue(unit: Combatant) {
  const stats = unit.combat;
  return (
    unit.health +
    unit.block +
    benefits.reduce((sum, key) => sum + Number(stats?.[key] ?? 0), 0) -
    harms.reduce((sum, key) => sum + Number(stats?.[key] ?? 0), 0)
  );
}
function positionValue(state: BattleState) {
  const rowValue = (side: "player" | "enemy") =>
    battlefield(state, side).reduce((sum, unit) => sum + unitValue(unit), 0);
  const resources = state.battle.enemies.reduce(
    (sum, enemy) =>
      sum + (enemy.deck ? enemy.deck.mana + enemy.deck.hand.length + enemy.deck.buffer.length : 0),
    0,
  );
  return rowValue("enemy") - rowValue("player") + resources + Number(state.battle.repeatNext.enemy);
}

export interface EnemyChoice {
  def: CardDefinition;
  targetId?: string;
  allyTargetId?: string;
  value: number;
}

/** Immediate net gains: one point per actual Health, Block, stack or resource; flags count as one.
 * Production execution owns caps, mitigation, recipients, repeats and secondary effects.
 * Eight fixed probes approximate chance outcomes without reading or advancing the live RNG.
 */
export function enemyCardValue(
  state: BattleState,
  enemy: Enemy,
  def: CardDefinition,
  targetId?: string,
  allyTargetId?: string,
) {
  const before = positionValue(state);
  const spentCard = enemy.deck?.hand.includes(def.id) ? 1 : 0;
  let total = 0;
  for (let probe = 0; probe < 8; probe++) {
    const after = evaluation.produce(state, (draft) => {
      let decision = 0;
      observeDecisions(draft, () => ((probe + 0.5) / 8 + decision++ * 0.618033988749895) % 1);
      const actor = draft.battle.enemies.find((unit) => unit.id === enemy.id)!;
      const lastCardInHand = spentCard > 0 && actor.deck?.hand.length === 1;
      if (actor.deck) {
        actor.deck.mana -= def.cost;
        if (spentCard) {
          actor.deck.hand.splice(actor.deck.hand.indexOf(def.id), 1);
          if (!def.consume) actor.deck.discard.push(def.id);
        }
      }
      executeAbility(
        draft,
        {
          side: "enemy",
          actor,
          def,
          value: enemyAbilityValue(actor, def),
          targetId,
          allyTargetId,
          lastCardInHand,
        },
        [],
        { swap: swapFromCard },
      );
      if (actor.deck) courtRemembers(draft, actor, []);
      if (lastCardInHand) lastWarmth(draft, true, []);
    });
    // Rank effect value, with Mana paid before restoration so resource caps are accurate.
    total += positionValue(after) - before + (enemy.deck ? def.cost + spentCard : 0);
  }
  return total / 8;
}

/** Re-evaluate from current combat after every play; no-repeat preference only breaks equal values. */
export function chooseEnemyCard(state: BattleState, enemy: Enemy, cards: readonly CardDefinition[]) {
  const targetId = highestHealth(battlefield(state, "player"))?.id;
  let best: EnemyChoice | undefined;
  for (const def of cards) {
    if (enemy.deck && def.cost > enemy.deck.mana) continue;
    const allies = battlefield(state, "enemy");
    const recipients =
      def.effect === "resurrect"
        ? state.battle.enemies.filter((unit) => unit.health <= 0).map((unit) => unit.id)
        : cardTargeting(def) === "ally"
          ? allies.filter((unit) => unit.health > 0).map((unit) => unit.id)
          : [enemy.id];
    for (const allyTargetId of recipients) {
      const value = enemyCardValue(state, enemy, def, targetId, allyTargetId);
      if (value <= 0) continue;
      if (
        !best ||
        value > best.value ||
        (value === best.value && best.def.id === enemy.lastAbility && def.id !== enemy.lastAbility)
      )
        best = { def, targetId, allyTargetId, value };
    }
  }
  return best;
}
