import type { CombatState } from "../../../game/types";
import { KEYWORD_DEFINITIONS } from "../../../game/keywords";

const stats = ["armor", "thorns", "dodge", "burn", "poison", "bleed", "stun", "freeze"] as const;
export const statusOrder: readonly string[] = [
  ...stats,
  "controlled",
  "cooldown",
  "ribbonSpool",
  "grace",
  "rhythm",
  "nextPhysical",
  "partingCut",
  "riposte",
  "freeNature",
  "freeLight",
  "freeCard",
  "oasisLeech",
  "acrobatReady",
  "moonseedReady",
  "toothpickReady",
  "reflect",
  "reflectBurn",
  "nullify",
  "nullifyFreeze",
  "negate",
  "attackReflection",
  "blind",
];
export type Status = {
  id: string;
  text: string;
  count: number;
  temporaryDodge?: number;
  sharedDodge?: number;
};
export function combatStatuses(combat?: CombatState, sharedDodge = 0, sharedImmunity = 0): Status[] {
  if (!combat) return [];
  const dodge = Number(((combat.dodge ?? 0) + (combat.temporaryDodge ?? 0) + sharedDodge).toFixed(2));
  const entries: Status[] = combat
    ? stats
        .filter((id) => (id === "dodge" ? dodge : combat[id]) > 0)
        .map((id) => ({
          id,
          count: id === "dodge" ? dodge : combat[id],
          ...(id === "dodge" ? { temporaryDodge: combat.temporaryDodge, sharedDodge } : {}),
          text: `${KEYWORD_DEFINITIONS[id].label} ${id === "dodge" ? dodge : combat[id]}${id === "dodge" ? "% bonus" : ""}; ${KEYWORD_DEFINITIONS[id].description}${id === "dodge" && combat.temporaryDodge ? `; ${combat.temporaryDodge}% expires at your next turn` : ""}${id === "dodge" && sharedDodge ? `; ${Number(sharedDodge.toFixed(2))}% from Shifting Sands` : ""}`,
        }))
    : [];
  if (combat?.controlled || combat?.skipped)
    entries.push({
      id: "controlled",
      count: combat.controlTurns || 1,
      text: combat.controlled
        ? `${combat.controlled === "freeze" ? "Frozen" : "Stunned"}: ${combat.controlTurns || 1} turn${combat.controlTurns > 1 ? "s" : ""}`
        : "Turn skipped",
    });
  if (combat.cooldown && combat.cooldown >= sharedImmunity)
    entries.push({ id: "cooldown", count: combat.cooldown, text: `Control immunity ${combat.cooldown}` });
  else if (sharedImmunity)
    entries.push({
      id: "ribbonSpool",
      count: sharedImmunity,
      text: "Ribbon Spool: immune to Stun and Freeze",
    });
  if (combat?.grace) entries.push({ id: "grace", count: combat.grace, text: `Death's Door ${combat.grace}` });
  if (combat) {
    const pending = [
      ["rhythm", combat.rhythm, `Finding Rhythm: +${combat.rhythm}% Dodge chance`],
      [
        "nextPhysical",
        combat.nextPhysical,
        `Open Flank: next attack deals ${combat.nextPhysical} additional Physical damage`,
      ],
      [
        "partingCut",
        Number(combat.partingCut),
        "Parting Cut: next Physical hit deals half its damage as additional Bleed damage",
      ],
      ["riposte", Number(combat.riposte), "Riposte: next Physical attack is a guaranteed Critical Hit"],
      ["freeNature", Number(combat.freeNature), "Windstep: next Nature card is free"],
      ["freeLight", Number(combat.freeLight), "Divine Favor: next Light card is free"],
      ["freeCard", Number(combat.freeCard), "Free Follow-up: next card is free"],
      ["oasisLeech", Number(combat.oasisLeech), "Oasis Seed: next attack has Leech"],
      ["acrobatReady", Number(combat.acrobatReady), "Acrobat Top: next attack cannot be Dodged"],
      [
        "moonseedReady",
        Number(combat.moonseedReady),
        "Moonseed: next Thorns retaliation deals double damage",
      ],
      ["toothpickReady", Number(combat.toothpickReady), "Dragon’s Toothpick: next attack also Purges"],
      ["blind", Number(combat.blind), `Blind: ${KEYWORD_DEFINITIONS.blind.description}`],
      [
        "nullifyFreeze",
        Number(combat.nullifyFreeze),
        "Nullify the next Freeze damage; Lasts until consumed or Purged; Does not stack",
      ],
      [
        "attackReflection",
        Number(combat.attackReflection),
        `Attack Reflection: ${KEYWORD_DEFINITIONS.attackReflection.description}`,
      ],
      ["negate", Number(combat.negate), `Negate: ${KEYWORD_DEFINITIONS.negate.description}`],
      ["nullify", Number(combat.nullify), `Nullify: ${KEYWORD_DEFINITIONS.nullify.description}`],
      [
        "reflectBurn",
        Number(combat.reflectBurn),
        "Reflect the next Burn; Direct damage still lands; Lasts until consumed or Purged; Does not stack",
      ],
      ["reflect", Number(combat.reflect), `Reflect: ${KEYWORD_DEFINITIONS.reflect.description}`],
    ] as const;
    for (const [id, count, text] of pending) if (count) entries.push({ id, count, text });
  }
  return entries;
}
