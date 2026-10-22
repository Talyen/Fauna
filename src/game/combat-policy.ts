/** Packet provenance determines reactions; ancestry only narrows an attack's delivery. */
interface AttackValues {
  leech?: boolean;
  cardLeech?: boolean;
}
export type DamagePacket =
  | (AttackValues & {
      origin: "ability";
      delivery?: "bounce";
      blindMiss?: boolean;
      criticalBonus?: number;
    })
  | (AttackValues & { origin: "proc" | "resonance"; delivery?: "bounce" })
  | { origin: "periodic" | "retaliation" | "statusRetaliation" | "derived" };

const inactive = {
  attack: false,
  direct: false,
  buildup: false,
  bypassBlock: false,
  deadSource: false,
  wrongFoot: false,
  resonance: false,
  bounce: false,
};
const attacking = { ...inactive, attack: true, buildup: true };
export function packetPolicy(packet: DamagePacket) {
  switch (packet.origin) {
    case "ability":
      return {
        ...attacking,
        direct: true,
        wrongFoot: packet.delivery !== "bounce",
        resonance: true,
        bounce: packet.delivery !== "bounce",
      };
    case "proc":
    case "resonance":
      return {
        ...attacking,
        resonance: packet.origin !== "resonance",
        bounce: packet.delivery !== "bounce",
      };
    case "periodic":
      return { ...inactive, bypassBlock: true, deadSource: true };
    case "retaliation":
    case "statusRetaliation":
    case "derived":
      return {
        ...inactive,
        buildup: packet.origin === "statusRetaliation",
        deadSource: packet.origin === "derived",
      };
    default: {
      const unhandled: never = packet;
      throw new Error(`Unknown damage packet: ${unhandled}`);
    }
  }
}

export type AttackPacket = Extract<DamagePacket, { origin: "ability" | "proc" | "resonance" }>;
