import { talent } from "../talent-builder";
export const MANA_TALENTS = [
  talent(
    "mana.wellspring",
    "Wellspring",
    0,
    (rule) => `End your turn with unspent Mana to gain ${rule.amount} extra Mana next turn`,
  ),
  talent(
    "mana.dark-recovery",
    "Dark Recovery",
    0,
    (rule) => `End your turn with no Mana to gain ${rule.amount} extra Mana next turn`,
  ),
  talent("mana.mana-bulwark", "Mana Bulwark", 1, "Start each combat with Block equal to your maximum Mana"),
  talent(
    "mana.leyline-attunement",
    "Leyline Attunement",
    1,
    (rule) => `Gain ${rule.amount} maximum Mana each battle`,
  ),
  talent(
    "mana.manaburn",
    "Manaburn",
    2,
    (rule) => `Burn damage is increased by ${rule.percent}% of your Mana`,
  ),
  talent(
    "mana.arcane-frost",
    "Arcane Frost",
    2,
    (rule) => `Freeze damage is increased by ${rule.percent}% of your Mana`,
  ),
  talent("mana.mana-shell", "Mana Shell", 3, "Start each combat with Armor equal to your maximum Mana"),
  talent(
    "mana.arcane-mending",
    "Arcane Mending",
    3,
    (rule) => `Each living deployed creature restores ${rule.amount} Health per Mana gained`,
  ),
] as const;
