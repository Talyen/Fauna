import { talent } from "../talent-builder";
export const BLOCK_TALENTS = [
  talent(
    "block.second-wind",
    "Second Wind",
    0,
    (rule) => `Restore ${rule.amount} Health when your Block is depleted`,
  ),
  talent("block.grounding", "Grounding", 0, "Block prevents Stun buildup"),
  talent("block.reinforce", "Reinforce", 1, (rule) => `Block absorbs ${rule.percent}% more Physical damage`),
  talent(
    "block.sacred-shield",
    "Sacred Shield",
    1,
    (rule) => `Light damage is increased by ${rule.percent}% of your Block`,
  ),
  talent(
    "block.impact-guard",
    "Impact Guard",
    2,
    (rule) => `Stun damage is increased by ${rule.percent}% of your Block`,
  ),
  talent(
    "block.weighted-guard",
    "Weighted Guard",
    2,
    (rule) => `Physical damage is increased by ${rule.percent}% of your Block`,
  ),
  talent(
    "block.sun-struck-shield",
    "Sun-Struck Shield",
    3,
    (rule) => `When attacks deplete your Block, reflect ${rule.percent}% of Block lost as Light damage`,
  ),
  talent("block.footwork", "Footwork", 3, (rule) => `Gain ${rule.amount} Block when you Dodge`),
  talent("block.blood-ward", "Blood Ward", 4, "Take half Bleed damage while you have Block"),
  talent("block.venom-ward", "Venom Ward", 4, "Take half Poison damage while you have Block"),
] as const;
