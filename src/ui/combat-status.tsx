import type { CombatState } from "../game/types";
import { KeywordText } from "./keyword-text";
export function CombatStatus({ combat }: { combat?: CombatState }) {
  if (!combat) return null;
  const stats = ["armor", "forge", "thorns", "dodge", "burn", "poison", "bleed", "stun", "freeze"] as const;
  return (
    <div className="combat-status" aria-label="Combat effects">
      {stats
        .filter((id) => combat[id] > 0)
        .map((id) => (
          <span key={id}>
            <KeywordText text={`${id} ${combat[id]}${id === "dodge" ? "%" : ""}`} />
          </span>
        ))}
      {combat.controlled || combat.skipped ? (
        <span>
          {combat.controlled === "freeze"
            ? "Frozen"
            : combat.controlled === "stun"
              ? "Stunned"
              : "Turn skipped"}
        </span>
      ) : null}
      {combat.cooldown > 0 ? <span>Control immunity {combat.cooldown}</span> : null}
      {combat.grace > 0 ? <span>Death's Door {combat.grace}</span> : null}
    </div>
  );
}
