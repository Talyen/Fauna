import { talent } from "../talent-builder";
export const BLOCK_TALENTS = [
  talent("block.second-wind", "Second Wind", 0),
  talent("block.grounding", "Grounding", 0),
  talent("block.reinforce", "Reinforce", 1),
  talent("block.sacred-shield", "Sacred Shield", 1),
  talent("block.impact-guard", "Impact Guard", 2),
  talent("block.weighted-guard", "Weighted Guard", 2),
  talent("block.sun-struck-shield", "Sun-Struck Shield", 3),
  talent("block.footwork", "Footwork", 3),
  talent("block.blood-ward", "Blood Ward", 4),
  talent("block.venom-ward", "Venom Ward", 4),
] as const;
