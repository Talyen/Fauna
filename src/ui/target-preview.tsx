import { Heart, Shield, Crosshair, Skull } from "lucide-react";
import type { CommandResult, GameState } from "../game/types";
export function TargetPreview({
  before,
  result,
  targetId,
}: {
  before: GameState;
  result: CommandResult | null;
  targetId: string;
}) {
  if (!result?.accepted) return null;
  const previous =
    before.team.find((c) => c.id === targetId) ?? before.battle?.enemies.find((c) => c.id === targetId);
  const next =
    result.state.team.find((c) => c.id === targetId) ??
    result.state.battle?.enemies.find((c) => c.id === targetId);
  if (!previous || !next || !result.events.some((e) => e.targetId === targetId && e.amount !== undefined))
    return null;
  const entries = [
    { label: "Health", Icon: Heart, tone: "health", old: previous.health, next: next.health },
    {
      label: "Block",
      Icon: Shield,
      tone: "block",
      old: "block" in previous ? previous.block : 0,
      next: "block" in next ? next.block : 0,
    },
    {
      label: "Marks",
      Icon: Crosshair,
      tone: undefined,
      old: "marks" in previous ? previous.marks : 0,
      next: "marks" in next ? next.marks : 0,
    },
  ].filter((e) => e.label === "Health" || (e.old !== e.next && !(e.label === "Marks" && next.health === 0)));
  return (
    <div className="target-preview" role="status" aria-label="Target preview">
      {entries.length
        ? entries.map((e) => (
            <span key={e.label} data-combat-tone={e.tone} aria-label={`${e.label} ${e.old} to ${e.next}`}>
              <e.Icon aria-hidden="true" />
              {e.old}
              {e.old === e.next ? "" : ` → ${e.next}`}
            </span>
          ))
        : "No change"}
      {entries.every((e) => e.old === e.next) ? <span>No change</span> : null}
      {previous.health > 0 && next.health === 0 ? (
        <span>
          <Skull aria-hidden="true" />
          Knockout
        </span>
      ) : null}
    </div>
  );
}
