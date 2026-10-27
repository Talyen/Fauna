import { pendingReplacement, formationForSwap } from "../game/team";
import { coverageScore, offenseValue } from "./team-policy";
import { controlled } from "../game/combat/state";
import { species } from "../game/content";
import { availablePlays } from "../game/play-queries";
import { battleBenefits, battleBenefitFacts, BATTLE_FINISH_PRIORITY } from "./battle-benefits";
import type { Command, GameState } from "../game/types";

export const BATTLE_POLICY_VERSION = 39;

export interface BattleChoice {
  command: Command;
  score: number;
  reason: string;
}

/** Legal candidates, visible benefits and deterministic ranking have distinct owners. */
export function rankedBattleChoices(state: GameState, autoEndTurn = true): BattleChoice[] {
  if (state.phase !== "battle") return [];
  const outgoing = pendingReplacement(state);
  if (outgoing) {
    const needsDamage = !state.team.some(
      (unit) => unit.health > 0 && !controlled(unit, state) && offenseValue(state, unit.species) > 0,
    );
    const all = [...state.team, ...state.reserves];
    const active = state.team.map((unit) => unit.id);
    let best: { unit: (typeof state.reserves)[number]; score: number } | undefined;
    for (const unit of state.reserves) {
      if (unit.health <= 0) continue;
      const ids = formationForSwap(all, active, outgoing.id, unit.id);
      const lineup = ids
        .map((id) => all.find((entry) => entry.id === id)!)
        .filter((entry) => entry.health > 0);
      const kinds = lineup.map((entry) => entry.species);
      const damage = needsDamage ? offenseValue(state, unit.species) : 0;
      const score =
        (damage > 0 ? 1_000_000 : 0) +
        (!controlled(unit, state) ? 100_000 : 0) +
        coverageScore(state, kinds) +
        damage * 100 +
        (unit.health / species(unit.species).health) * 100;
      if (!best || score > best.score || (score === best.score && unit.id.localeCompare(best.unit.id) < 0))
        best = { unit, score };
    }
    const incoming = best?.unit;
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
        const { score } = benefit;
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
