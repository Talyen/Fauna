import { controlled } from "../game/combat";
import { definition, species } from "../game/content";
import type { Command, GameState } from "../game/types";

export const BATTLE_POLICY_VERSION = 1;
/** Only visible information enters scoring; no forecasts or gameplay RNG are sampled. */
export function battleChoices(state: GameState, autoEndTurn = true): Command[] {
  if (state.phase !== "battle" || !state.battle) return [];
  const order = <T extends { id: string }>(items: T[]) => [...items].sort((a, b) => a.id.localeCompare(b.id));
  const outgoing = order(state.team).find((c) => c.health === 0 || controlled(c));
  const incoming = order(state.reserves).find((c) => c.health > 0 && !controlled(c));
  // A replacement is actionable; it cannot itself be selected as the next recovery swap.
  if (outgoing && incoming) return [{ type: "swap", activeId: outgoing.id, reserve: incoming.id }];
  const options: { command: Command; score: number; key: string }[] = [];
  const add = (cardId: string, score: number, targetId?: string) => {
    if (score > 0)
      options.push({
        command: { type: "play", cardId, targetId, autoEndTurn },
        score,
        key: `${cardId}:${targetId ?? ""}`,
      });
  };
  for (const id of state.battle.hand) {
    const card = state.cards.find((c) => c.id === id)!;
    const actor = state.team.find((c) => c.id === card.ownerId);
    const def = definition(card.definitionId);
    if (!actor || actor.health === 0 || controlled(actor) || def.cost > state.battle.mana) continue;
    const value = def.value + card.level * 2;
    if (def.effect === "attack") {
      for (const enemy of state.battle.enemies.filter((e) => e.health > 0)) {
        const effective = Math.max(0, value - enemy.block - enemy.combat.armor);
        add(id, (effective >= enemy.health ? 2000 : 1000) + Math.min(value, enemy.health), enemy.id);
      }
    } else if (def.effect === "heal") {
      for (const ally of state.team.filter((c) => c.health > 0)) {
        const missing = species(ally.species).health - ally.health;
        if (missing > 0) add(id, 3000 + Math.min(value, missing), ally.id);
      }
    } else if (def.effect === "teamGuard") {
      const useful = state.team
        .filter((c) => c.health > 0)
        .reduce((n, c) => n + Math.max(0, value - c.block), 0);
      add(id, useful > 0 ? 100 + useful : 0);
    } else {
      for (const ally of state.team.filter((c) => c.health > 0)) {
        const useful = Math.max(0, value - ally.block);
        add(id, useful > 0 ? 100 + useful : 0, ally.id);
      }
    }
  }
  return options.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key)).map((o) => o.command);
}
export function chooseBattleCommand(state: GameState, autoEndTurn = true): Command {
  return battleChoices(state, autoEndTurn)[0] ?? { type: "endTurn" };
}
