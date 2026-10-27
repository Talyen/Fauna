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
}
export type DamagePacket =
  | (AttackValues & {
      origin: "ability";
      delivery?: "bounce" | "reflection";
      blindMiss?: boolean;
      cannotDodge?: boolean;
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
export function packetPolicy(packet: DamagePacket) {
  switch (packet.origin) {
    case "ability":
      return {
        ...attacking,
        direct: true,
        wrongFoot: !packet.delivery,
        resonance: packet.delivery !== "reflection",
        bounce: !packet.delivery,
      };
    case "proc":
    case "resonance":
      return {
        ...attacking,
        resonance: packet.origin !== "resonance",
        bounce: packet.delivery !== "bounce",
      };
    case "periodic":
      return { ...inactive, deadSource: true };
    case "retaliation":
    case "statusRetaliation":
    case "boon":
    case "derived":
    case "overkill":
    case "chain":
      return {
        ...inactive,
        buildup: packet.origin === "statusRetaliation" || packet.origin === "boon",
        leechRewards: packet.origin !== "overkill",
        deadSource: packet.origin === "derived" || packet.origin === "overkill" || packet.origin === "chain",
      };
    default: {
      const unhandled: never = packet;
      throw new Error(`Unknown damage packet: ${unhandled}`);
    }
  }
}

export type AttackPacket = Extract<DamagePacket, { origin: "ability" | "proc" | "resonance" }>;
