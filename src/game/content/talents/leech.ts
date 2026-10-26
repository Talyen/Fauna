import { talent } from "../talent-builder";
export const LEECH_TALENTS = [
  talent("leech.deep-siphon", "Deep Siphon", 0),
  talent("leech.desperate-siphon", "Desperate Siphon", 0),
  talent("leech.blood-debt", "Blood Debt", 1),
  talent("leech.affliction-siphon", "Affliction Siphon", 1),
  talent("leech.cull-the-weak", "Cull the Weak", 2),
  talent("leech.sanguine-overflow", "Sanguine Overflow", 2),
  talent("leech.bloodletting", "Bloodletting", 3),
  talent("leech.mana-siphon", "Mana Siphon", 3),
  talent("leech.armor-siphon", "Armor Siphon", 4),
  talent("leech.virulent-leech", "Virulent Leech", 4),
] as const;
