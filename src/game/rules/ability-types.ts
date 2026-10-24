import type { DamageType } from "../keywords";

export type AbilityKind =
  | "procession"
  | "createFood"
  | "createPearls"
  | "pearl"
  | "attack"
  | "guard"
  | "heal"
  | "redistributeBlock"
  | "redraw"
  | "reflectAttack"
  | "resurrect"
  | "teamProtection"
  | "waterThorns"
  | "teamCleanse"
  | "dreamDouble"
  | "nightmareHarvest"
  | "teamPurge"
  | "teamThaw"
  | "teamClearBlind"
  | "swapLowest"
  | "recover"
  | "mana"
  | "teamBlind"
  | "swap"
  | "draw"
  | "nullify"
  | "dodge";

export type SupplementalEffect =
  | { kind: "drawKeyword"; keyword: "light" | "nature" | "water"; amount: number }
  | { kind: "nullifyFreeze"; amount: number }
  | { kind: "damage"; damageType: DamageType; amount: number; leech?: boolean }
  | { kind: "status"; status: "armor" | "thorns" | "dodge"; amount: number }
  | { kind: "cleanse"; amount: number; target?: "recipient" | "allAllies" }
  | { kind: "reflect"; amount: number; status?: "burn" }
  | { kind: "heal"; amount: number; target?: "recipient" }
  | { kind: "draw"; amount: number }
  | { kind: "mana" | "purge" | "blind" | "meltArmor"; amount: number };

export type SupplementalKind = SupplementalEffect["kind"];

interface AbilityParameters {
  attack: {
    damageType: DamageType;
    alternateDamageType?: DamageType;
    doubleWithArmor?: boolean;
    doubleAgainstHealthier?: true;
    purgeThorns?: true;
    target?: "allEnemies" | "randomEnemy";
  };
  guard: { target?: "self" | "allAllies" };
  dodge: { target?: "self" | "allAllies" };
  heal: { target?: "allAllies" | "mostInjured" | "self" };
  recover: { target?: "ally" };
}
export type AbilityDefinition = {
  [K in AbilityKind]: { effect: K } & (K extends keyof AbilityParameters
    ? AbilityParameters[K]
    : { target?: never });
}[AbilityKind];
