import { definition } from "./content";
import type { Card, Creature } from "./types";
/** Intrinsic effect value; target-specific marks and healing caps resolve in the command. */
export function actionValue(card: Card, actor: Pick<Creature, "species" | "attacked">): number {
  const def = definition(card.definitionId);
  const bonus =
    def.effect === "attack" && actor.species === "emberfox" && !actor.attacked
      ? 2
      : def.effect === "mark" && actor.species === "stormfin"
        ? 1
        : def.effect === "heal" && actor.species === "silkmoth"
          ? 2
          : (def.effect === "guard" || def.effect === "teamGuard") && actor.species === "mossback"
            ? 2
            : 0;
  return def.value + card.level * 2 + bonus;
}
