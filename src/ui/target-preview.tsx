import { combatStatuses } from "./combat-status";
import { KEYWORD_DEFINITIONS } from "../game/keywords";
import { KeywordText } from "./keyword-text";
import { Shield, Heart, Skull } from "lucide-react";
import type { CommandResult, GameState } from "../game/types";
import { species } from "../game/content";
import { Progress } from "./progress";
import { DamageValue } from "./combat-values";
export function BattleReadout({
  health,
  maxHealth,
  block = 0,
  previous,
  previousBlock,
  knockout = false,
  children,
}: {
  health: number;
  maxHealth: number;
  block?: number;
  previous?: number;
  previousBlock?: number;
  knockout?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="battle-readout">
      <div className="health-forecast">
        <Progress value={health} maximum={maxHealth} previous={previous} label="Health" tone="health" />
        {knockout ? <Skull className="knockout-preview" aria-label="Knockout" /> : null}
      </div>
      <div className="combat-stats">
        {block > 0 || (previousBlock ?? 0) > 0 ? (
          <span
            data-combat-tone="block"
            aria-label={
              previousBlock !== undefined && previousBlock !== block
                ? `Block ${previousBlock} to ${block}`
                : `Block ${block}`
            }
          >
            <Shield aria-hidden="true" />
            {previousBlock !== undefined && previousBlock !== block ? `${previousBlock} → ${block}` : block}
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
  const events = result.events.filter((e) => e.targetId === targetId);
  const previousStatuses = combatStatuses(old.combat);
  const nextStatuses = combatStatuses(next.combat);
  const changes = [...new Set([...previousStatuses, ...nextStatuses].map((status) => status.id))].flatMap(
    (id) => {
      const previous = previousStatuses.find((status) => status.id === id);
      const current = nextStatuses.find((status) => status.id === id);
      if (previous?.text === current?.text) return [];
      const keyword = Object.hasOwn(KEYWORD_DEFINITIONS, id)
        ? KEYWORD_DEFINITIONS[id as keyof typeof KEYWORD_DEFINITIONS].label
        : undefined;
      return [
        keyword
          ? `${keyword} ${previous?.count ?? 0} → ${current?.count ?? 0}`
          : (current?.text ?? `Remove ${previous!.text}`),
      ];
    },
  );
  const absorbed = -events
    .filter((event) => event.kind === "block" && (event.amount ?? 0) < 0)
    .reduce((sum, event) => sum + (event.amount ?? 0), 0);
  const max = "maxHealth" in old ? old.maxHealth : species(old.species).health;
  return (
    <div
      className="target-preview"
      role="status"
      aria-label={`Target preview for ${"name" in old ? old.name : species(old.species).name}: Health ${old.health} to ${next.health}, Block ${old.block} to ${next.block}${absorbed ? `, ${absorbed} damage absorbed` : ""}${changes.length ? `, ${changes.join(", ")}` : ""}${next.health === 0 ? ", Knockout" : ""}`}
    >
      <BattleReadout
        health={next.health}
        maxHealth={max}
        previous={old.health}
        block={"block" in next ? next.block : 0}
        previousBlock={"block" in old ? old.block : 0}
        knockout={old.health > 0 && next.health === 0}
      >
        {events
          .filter((e) => (e.kind === "damage" || e.kind === "heal") && (e.amount ?? 0) > 0)
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
        {absorbed > 0 ? (
          <span data-combat-tone="block">
            <Shield aria-hidden="true" />
            {absorbed} absorbed
          </span>
        ) : null}
        {changes.map((change) => (
          <span key={change}>
            <KeywordText text={change} />
          </span>
        ))}
        {events
          .filter((event) => event.kind === "status" && event.status === "dodge" && event.outcome === "dodge")
          .map((event, index) => (
            <span key={`dodge-${index}`}>Dodge</span>
          ))}
      </BattleReadout>
    </div>
  );
}
