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

export function packetPolicy(packet: DamagePacket) {
  switch (packet.origin) {
    case "ability":
      return {
        attack: true,
        direct: true,
        buildup: true,
        bypassBlock: false,
        deadSource: false,
        wrongFoot: packet.delivery !== "bounce",
        resonance: true,
        bounce: packet.delivery !== "bounce",
      };
    case "proc":
    case "resonance":
      return {
        attack: true,
        direct: false,
        buildup: true,
        bypassBlock: false,
        deadSource: false,
        wrongFoot: false,
        resonance: packet.origin !== "resonance",
        bounce: packet.delivery !== "bounce",
      };
    case "periodic":
      return {
        attack: false,
        direct: false,
        buildup: false,
        bypassBlock: true,
        deadSource: true,
        wrongFoot: false,
        resonance: false,
        bounce: false,
      };
    case "retaliation":
    case "statusRetaliation":
    case "derived":
      return {
        attack: false,
        direct: false,
        buildup: packet.origin === "statusRetaliation",
        bypassBlock: false,
        deadSource: packet.origin === "derived",
        wrongFoot: false,
        resonance: false,
        bounce: false,
      };
    default: {
      const unhandled: never = packet;
      throw new Error(`Unknown damage packet: ${unhandled}`);
    }
  }
}

export type AttackPacket = Extract<DamagePacket, { origin: "ability" | "proc" | "resonance" }>;
