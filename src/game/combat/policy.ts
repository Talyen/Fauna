/** Packet provenance determines reactions; ancestry only narrows an attack's delivery. */
export interface SharedNegate {
  bearer: import("./state").Combatant;
  recipientId: string;
  spent: boolean;
}
interface AttackValues {
  sharedNegate?: SharedNegate;
  leech?: boolean;
  cardLeech?: boolean;
  attackAbility?: boolean;
  primaryAttack?: boolean;
}
export type DamagePacket =
  | (AttackValues & {
      origin: "ability";
      delivery?: "bounce" | "reflection";
      blindMiss?: boolean;
      cannotDodge?: boolean;
      sharedDodge?: boolean;
      interceptionChecked?: true;
      criticalBonus?: number;
    })
  | (AttackValues & { origin: "proc" | "resonance"; delivery?: "bounce" })
  | {
      origin: "periodic" | "retaliation" | "statusRetaliation" | "derived" | "overkill" | "chain" | "boon";
      thorns?: true;
    };

const inactive = {
  attack: false,
  direct: false,
  buildup: false,
  deadSource: false,
  wrongFoot: false,
  resonance: false,
  bounce: false,
  leechRewards: true,
};
const attacking = { ...inactive, attack: true, buildup: true };
const ability = Object.freeze({ ...attacking, direct: true, wrongFoot: true, resonance: true, bounce: true });
const abilityBounce = Object.freeze({ ...ability, wrongFoot: false, bounce: false });
const abilityReflection = Object.freeze({ ...abilityBounce, resonance: false });
const proc = Object.freeze({ ...attacking, resonance: true, bounce: true });
const procBounce = Object.freeze({ ...proc, bounce: false });
const resonance = Object.freeze({ ...proc, resonance: false });
const resonanceBounce = Object.freeze({ ...resonance, bounce: false });
const periodic = Object.freeze({ ...inactive, deadSource: true });
const passive = Object.freeze({ ...inactive });
const buildup = Object.freeze({ ...inactive, buildup: true });
const derived = Object.freeze({ ...inactive, deadSource: true });
const overkill = Object.freeze({ ...derived, leechRewards: false });

/** Damage reactions share immutable policies for each packet origin and delivery. */
export function packetPolicy(packet: DamagePacket) {
  switch (packet.origin) {
    case "ability":
      return packet.delivery === "reflection"
        ? abilityReflection
        : packet.delivery === "bounce"
          ? abilityBounce
          : ability;
    case "proc":
      return packet.delivery === "bounce" ? procBounce : proc;
    case "resonance":
      return packet.delivery === "bounce" ? resonanceBounce : resonance;
    case "periodic":
      return periodic;
    case "retaliation":
      return passive;
    case "statusRetaliation":
    case "boon":
      return buildup;
    case "derived":
    case "chain":
      return derived;
    case "overkill":
      return overkill;
    default: {
      const unhandled: never = packet;
      throw new Error(`Unknown damage packet: ${unhandled}`);
    }
  }
}
export type AttackPacket = Extract<DamagePacket, { origin: "ability" | "proc" | "resonance" }>;
