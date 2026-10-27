import { Immer } from "immer";
import { battlefield } from "../battlefield";
import { cardTargeting } from "../card-rules";
import type { CardDefinition } from "../content/types";
import { observeDecisions } from "../random";
import type { BattleState, CombatState, Enemy } from "../types";
import { lastWarmth } from "./card-modifiers";
import { playEnemyAbility } from "./enemy-action";
import { highestHealth, type Combatant } from "./state";

// Evaluation also accepts live mutable turn drafts; shared branches must never be frozen.
const evaluation = new Immer({ autoFreeze: false });

const benefits = [
  "armor",
  "thorns",
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
  if (unit.health <= 0) return 0;
  const stats = unit.combat;
  let benefit = 0;
  let harm = 0;
  for (const key of benefits) benefit += Number(stats?.[key] ?? 0);
  for (const key of harms) harm += Number(stats?.[key] ?? 0);
  return unit.health + unit.block + benefit - harm;
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

interface EnemyChoice {
  def: CardDefinition;
  targetId?: string;
  allyTargetId?: string;
  value: number;
}

/** Immediate net gains: one point per actual Health, Block, stack or resource; flags count as one.
 * Production execution owns caps, mitigation, recipients, repeats and secondary effects.
 * Up to eight fixed probes approximate chance outcomes without reading or advancing the live RNG.
 */
export function enemyCardValue(
  state: BattleState,
  enemy: Enemy,
  def: CardDefinition,
  targetId?: string,
  allyTargetId?: string,
) {
  return evaluateEnemyCard(
    state,
    enemy,
    def,
    positionValue(state),
    state.battle.enemies.findIndex((unit) => unit.id === enemy.id),
    targetId,
    allyTargetId,
  );
}

function evaluateEnemyCard(
  state: BattleState,
  enemy: Enemy,
  def: CardDefinition,
  before: number,
  actorIndex: number,
  targetId?: string,
  allyTargetId?: string,
) {
  const spentCard = enemy.deck?.hand.includes(def.id) ? 1 : 0;
  let total = 0;
  for (let probe = 0; probe < 8; probe++) {
    let decisions = 0;
    const after = evaluation.produce(state, (draft) => {
      observeDecisions(draft, () => ((probe + 0.5) / 8 + decisions++ * 0.618033988749895) % 1);
      const actor = draft.battle.enemies[actorIndex]!;
      const lastCardInHand = playEnemyAbility(draft, actor, def, targetId, allyTargetId, []);
      if (lastCardInHand) lastWarmth(draft, true, []);
    });
    // Rank effect value, with Mana paid before restoration so resource caps are accurate.
    const value = positionValue(after) - before + (enemy.deck ? def.cost + spentCard : 0);
    total += value;
    if (probe === 0 && decisions === 0) {
      // With no random or hidden decision, every remaining probe follows the same path.
      // Keep the original addition order, including its floating-point behavior.
      for (let remaining = 1; remaining < 8; remaining++) total += value;
      break;
    }
  }
  return total / 8;
}

function recipientIds(units: readonly Combatant[], living: boolean) {
  const ids: string[] = [];
  for (const unit of units) if (living ? unit.health > 0 : unit.health <= 0) ids.push(unit.id);
  return ids;
}

/** Re-evaluate from current combat after every play; no-repeat preference only breaks equal values. */
export function chooseEnemyCard(state: BattleState, enemy: Enemy, cards: readonly CardDefinition[]) {
  if (!cards.length) return;
  let targetId: string | undefined;
  let targetResolved = false;
  let before: number | undefined;
  let actorIndex: number | undefined;
  let livingAllies: string[] | undefined;
  let fallenAllies: string[] | undefined;
  // Probes use the same state and fixed decisions throughout this choice. Keep
  // this cache local because the live turn draft can change after every play.
  const values = enemy.deck ? new Map<CardDefinition, Map<string, number>>() : undefined;
  let best: EnemyChoice | undefined;
  let self: string[] | undefined;
  for (const def of cards) {
    if (enemy.deck && def.cost > enemy.deck.mana) continue;
    const recipients =
      def.effect === "resurrect"
        ? (fallenAllies ??= recipientIds(state.battle.enemies, false))
        : cardTargeting(def) === "ally"
          ? (livingAllies ??= recipientIds(battlefield(state, "enemy"), true))
          : (self ??= [enemy.id]);
    for (const allyTargetId of recipients) {
      let cardValues = values?.get(def);
      if (values && !cardValues) values.set(def, (cardValues = new Map()));
      let value = cardValues?.get(allyTargetId);
      if (value === undefined) {
        if (!targetResolved) {
          targetId = highestHealth(battlefield(state, "player"))?.id;
          targetResolved = true;
        }
        value = evaluateEnemyCard(
          state,
          enemy,
          def,
          (before ??= positionValue(state)),
          (actorIndex ??= state.battle.enemies.findIndex((unit) => unit.id === enemy.id)),
          targetId,
          allyTargetId,
        );
        cardValues?.set(allyTargetId, value);
      }
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
