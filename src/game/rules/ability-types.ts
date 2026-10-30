import type { DamageType } from "../keywords";

export type AbilityKind =
  | "createBees"
  | "armorAlly"
  | "moonlitWaltz"
  | "reflectAlly"
  | "stealEffect"
  | "borrowBackup"
  | "swapChosen"
  | "swapDodge"
  | "swapThorns"
  | "raincall"
  | "springbound"
  | "repeatNextCard"
  | "gildedWard"
  | "royalRepose"
  | "meadowDecree"
  | "procession"
  | "teamNegate"
  | "bridgeRewind"
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
  | "teamCleanse"
  | "dreamDouble"
  | "sparkDecoy"
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
  | { kind: "drawKeyword"; keyword: "light" | "nature" | "water" | "burn"; amount: number }
  | { kind: "nullifyFreeze"; amount: number }
  | { kind: "thaw"; amount: number }
  | { kind: "damage"; damageType: DamageType; amount: number; leech?: boolean }
  | { kind: "status"; status: "armor" | "thorns" | "dodge" | "block"; amount: number }
  | { kind: "cleanse"; amount: number; target?: "recipient" | "allAllies" }
  | { kind: "reflect"; amount: number; status?: "burn" }
  | { kind: "heal"; amount: number; target?: "recipient" }
  | { kind: "draw"; amount: number }
  | { kind: "mana"; amount: number }
  | { kind: "purge"; amount: number }
  | { kind: "blind"; amount: number }
  | { kind: "meltArmor"; amount: number };

export type SupplementalKind = SupplementalEffect["kind"];

// This is also the runtime authoring contract; unlisted abilities have no target option.
const PRIMARY_TARGETS = {
  attack: ["allEnemies", "randomEnemy"],
  guard: ["self", "allAllies"],
  dodge: ["self", "allAllies"],
  heal: ["allAllies", "mostInjured", "self", "injured"],
  recover: ["ally"],
} as const satisfies Partial<Record<AbilityKind, readonly string[]>>;

export function isPrimaryTarget(kind: AbilityKind, target: string): boolean {
  const targets: Partial<Record<AbilityKind, readonly string[]>> = PRIMARY_TARGETS;
  return targets[kind]?.includes(target) ?? false;
}

interface AbilityParameters {
  teamClearBlind: { draw?: true };
  swap: { backupOnly?: true };
  mana: { restore?: true };
  attack: {
    damageType: DamageType;
    alternateDamageType?: DamageType;
    doubleWithArmor?: boolean;
    doubleAgainstHealthier?: true;
    criticalWhenLastCard?: true;
    purgeThorns?: true;
  };
  recover: { allyOnly?: true };
}
export type AbilityDefinition = {
  [K in AbilityKind]: { effect: K } & (K extends keyof AbilityParameters ? AbilityParameters[K] : object) & {
      target?: K extends keyof typeof PRIMARY_TARGETS ? (typeof PRIMARY_TARGETS)[K][number] : never;
    };
}[AbilityKind];
