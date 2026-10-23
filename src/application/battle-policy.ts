import { pendingReplacement, formationForSwap } from "../game/team";
import { coverageScore, offenseValue } from "./team-policy";
import { controlled } from "../game/combat/state";
import { species } from "../game/content";
import { availablePlays } from "../game/play-queries";
import {
  battleBenefits,
  battleBenefitFacts,
  type BattleBenefit,
  type OrdinaryHit,
  type SupportPriority,
} from "./battle-benefits";
import type { Command, GameState } from "../game/types";

export const BATTLE_POLICY_VERSION = 28;
const BATTLE_FINISH_PRIORITY = 1_000_000_000;
const priorities = {
  none: 0,
  summon: 1600,
  summonRecovery: 1200,
  protection: 100,
  pearl: 500,
  resource: 400,
  healing: 3000,
  utility: 150,
  standardUtility: 200,
  controlRemoval: 200,
  redraw: 190,
  defensePurge: 1700,
  purge: 160,
} satisfies Record<SupportPriority, number>;
export interface BattleChoice {
  command: Command;
  score: number;
  reason: string;
}

function ordinaryHitScore(hit: OrdinaryHit) {
  const damagePriority = hit.main ? 1000 : 250;
  const defensePriority = hit.main ? 500 : 125;
  const progress =
    hit.lost > 0
      ? damagePriority + (hit.lethal ? damagePriority : 0) + Math.min(hit.lost, hit.health)
      : hit.blocked > 0
        ? defensePriority + hit.blocked
        : hit.eroded > 0
          ? 300 + hit.eroded
          : 0;
  return Math.max(progress, hit.usefulExtras ? priorities.standardUtility : 0);
}
function benefitScore(benefit: BattleBenefit) {
  if (benefit.kind === "support") {
    const unitValue = benefit.priority === "controlRemoval" ? 100 : 1;
    return priorities[benefit.priority] + benefit.amount * unitValue;
  }
  const sum = benefit.groups.reduce(
    (total, group) => total + group.reduce((sum, hit) => sum + ordinaryHitScore(hit), 0) / group.length,
    0,
  );
  const progress = benefit.aggregate === "mean" && benefit.groups.length ? sum / benefit.groups.length : sum;
  return (benefit.finish ? BATTLE_FINISH_PRIORITY : 0) + progress;
}

/** Legal candidates, visible benefits and deterministic ranking have distinct owners. */
export function rankedBattleChoices(state: GameState, autoEndTurn = true): BattleChoice[] {
  if (state.phase !== "battle") return [];
  const outgoing = pendingReplacement(state);
  if (outgoing) {
    const remaining = state.team.filter((unit) => unit.health > 0 && !controlled(unit));
    const needsDamage = !remaining.some((unit) => offenseValue(state, unit.species) > 0);
    const all = [...state.team, ...state.reserves];
    const active = state.team.map((unit) => unit.id);
    const incoming = [...state.reserves]
      .sort((a, b) => a.id.localeCompare(b.id))
      .filter((unit) => unit.health > 0)
      .map((unit) => {
        const ids = formationForSwap(all, active, outgoing.id, unit.id);
        const lineup = ids
          .map((id) => all.find((entry) => entry.id === id)!)
          .filter((entry) => entry.health > 0);
        const kinds = lineup.map((entry) => entry.species);
        const damage = needsDamage ? offenseValue(state, unit.species) : 0;
        const score =
          (damage > 0 ? 1_000_000 : 0) +
          (!controlled(unit) ? 100_000 : 0) +
          coverageScore(state, kinds) +
          damage * 100 +
          (unit.health / species(unit.species).health) * 100;
        return { unit, score };
      })
      .sort((a, b) => b.score - a.score)[0]?.unit;
    if (incoming)
      return [
        {
          command: {
            type: "swap",
            activeId: outgoing.id,
            reserve: incoming.id,
            ...(autoEndTurn ? {} : { autoEndTurn: false }),
          },
          score: BATTLE_FINISH_PRIORITY,
          reason:
            "Replace a knocked-out creature; restore missing deployed damage, then favor usable complementary backups",
        },
      ];
  }
  const facts = battleBenefitFacts(state);
  return availablePlays(state, autoEndTurn)
    .flatMap((play) =>
      battleBenefits(state, play, facts).flatMap((benefit) => {
        const score = benefitScore(benefit);
        const command = play.commands.find((command) => command.targetId === benefit.targetId);
        return score > 0 && command
          ? [
              {
                command,
                score,
                reason: benefit.reason ?? `Use ${play.def.name} for its visible benefit`,
                key: `${play.card.id}:${benefit.targetId ?? ""}`,
              },
            ]
          : [];
      }),
    )
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
    .map(({ command, score, reason }) => ({ command, score, reason }));
}
export function battleChoices(state: GameState, autoEndTurn = true): Command[] {
  return rankedBattleChoices(state, autoEndTurn).map((choice) => choice.command);
}
export function chooseBattleCommand(state: GameState, autoEndTurn = true): Command {
  return rankedBattleChoices(state, autoEndTurn)[0]?.command ?? { type: "endTurn" };
}
