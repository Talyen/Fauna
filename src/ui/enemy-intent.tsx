import { Shield } from "lucide-react";
import { enemyDamageType, species } from "../game/content";
import type { CommandResult, Enemy, GameState } from "../game/types";
import { DamageValue } from "./combat-values";
export function EnemyIntent({
  enemy,
  state,
  forecast,
}: {
  enemy: Enemy;
  state: GameState;
  forecast: CommandResult | null;
}) {
  const events = forecast?.accepted ? forecast.events : [];
  const damage = events.find((e) => e.kind === "damage" && e.actorId === enemy.id);
  const blocked = events.find((e) => e.kind === "block" && e.actorId === enemy.id);
  const target = state.team.find((c) => c.id === (damage?.targetId ?? enemy.targetId))!;
  return (
    <>
      <DamageValue type={enemyDamageType(state.encounter, enemy.id)} amount={enemy.damage} /> →{" "}
      {species(target.species).name}
      {blocked ? (
        <span
          className="intent-block"
          data-combat-tone="block"
          aria-label={`${Math.abs(blocked.amount!)} blocked, ${damage?.amount ?? 0} health lost`}
        >
          <Shield aria-hidden="true" />
          {Math.abs(blocked.amount!)}
        </span>
      ) : null}
    </>
  );
}
