import { Shield, Crosshair, Heart } from "lucide-react";
import type { CommandResult, GameState } from "../game/types";
import { species } from "../game/content";
import { Progress } from "./progress";
import { DamageValue } from "./combat-values";
export function BattleReadout({
  health,
  maxHealth,
  block = 0,
  marks = 0,
  previous,
  children,
}: {
  health: number;
  maxHealth: number;
  block?: number;
  marks?: number;
  previous?: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="battle-readout">
      <Progress value={health} maximum={maxHealth} previous={previous} label="Health" tone="health" />
      <div className="combat-stats">
        {block > 0 ? (
          <span data-combat-tone="block">
            <Shield aria-hidden="true" />
            {block}
          </span>
        ) : null}
        {marks > 0 ? (
          <span>
            <Crosshair aria-hidden="true" />
            {marks}
          </span>
        ) : null}
        {children}
      </div>
    </div>
  );
}
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
  const old =
    before.team.find((c) => c.id === targetId) ?? before.battle?.enemies.find((e) => e.id === targetId);
  const next =
    result.state.team.find((c) => c.id === targetId) ??
    result.state.battle?.enemies.find((e) => e.id === targetId);
  if (!old || !next) return null;
  const events = result.events.filter((e) => e.targetId === targetId && e.amount !== undefined);
  const max = "maxHealth" in old ? old.maxHealth : species(old.species).health;
  return (
    <div
      className="target-preview"
      role="status"
      aria-label={`Target preview: Health ${old.health} to ${next.health}${next.health === 0 ? ", Knockout" : ""}`}
    >
      <BattleReadout
        health={next.health}
        maxHealth={max}
        previous={old.health}
        block={"block" in next ? next.block : 0}
        marks={"marks" in next ? next.marks : 0}
      >
        {events
          .filter((e) => e.kind === "damage" || e.kind === "heal")
          .map((e, i) => (
            <span key={i}>
              {e.kind === "damage" ? (
                <DamageValue type={e.damageType ?? "physical"} amount={e.amount ?? 0} signed />
              ) : (
                <span data-combat-tone="health">
                  <Heart aria-hidden="true" />+{e.amount}
                </span>
              )}
            </span>
          ))}
      </BattleReadout>
    </div>
  );
}
