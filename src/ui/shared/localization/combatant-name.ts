import { species } from "../../../game/content";
import { unitName, type Combatant } from "../../../game/combat/state";
import type { createMessageReader } from "./messages";

/** Localize known identities while preserving authored boss and other distinct names. */
export function localizedCombatantName(unit: Combatant, i18n: ReturnType<typeof createMessageReader>) {
  if ("minion" in unit && unit.minion) return i18n.message("creature.echo", "Echo");
  const name = unitName(unit);
  const canonicalName = species(unit.species).name;
  return name === canonicalName ? i18n.content(`content.species.${unit.species}.name`, canonicalName) : name;
}
