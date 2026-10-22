import { freeze } from "immer";
export const BOONS = [
  { id: "tattered-pages", name: "Tattered Pages", text: "Draw 1 additional card at battle start" },
  { id: "bone-charm", name: "Bone Charm", text: "Restore 3 Health when you defeat an enemy" },
  { id: "ironwood-buckler", name: "Ironwood Buckler", text: "Gain 1 Thorns whenever you gain Block" },
  { id: "icy-heart", name: "Icy Heart", text: "Freezing an enemy deals 6 Physical damage" },
  { id: "meteorite", name: "Meteorite", text: "Double your first Burn hit each battle" },
  {
    id: "sin-eaters-lantern",
    name: "Sin-Eater's Lantern",
    text: "Restore 6 Health per harmful effect you Cleanse",
  },
  { id: "thunderstone", name: "Thunderstone", text: "Deal 6 Nature damage when you Stun an enemy" },
  { id: "groves-favor", name: "Grove's Favor", text: "Gain 1 Thorns when you restore Health in battle" },
  { id: "brass-censer", name: "Brass Censer", text: "Light hits have a 20% chance to also Burn or Leech" },
  { id: "parasitic-bloom", name: "Parasitic Bloom", text: "Poison damage has a 10% chance to Leech" },
  { id: "cutpurse-knife", name: "Cutpurse Knife", text: "Gain 1 Gold when you deal Bleed damage" },
  {
    id: "merchants-favor",
    name: "Merchant's Favor",
    text: "Your first purchase at each Merchant costs 7 less Gold",
  },
  {
    id: "plague-doctors-mask",
    name: "Plague Doctor's Mask",
    text: "Before turn-start damage, each ally Cleanses up to 2 Poison and deals half the amount removed as Poison damage to the first living enemy",
  },
  {
    id: "sundering-charm",
    name: "Sundering Charm",
    text: "Your Physical and Stun hits remove 2 enemy Armor before damage",
  },
  { id: "resonant-chimes", name: "Resonant Chimes", text: "After your third card each turn, gain 1 Mana" },
  { id: "smugglers-map", name: "Smuggler's Map", text: "Gain 2 additional Gold for each battle won" },
  {
    id: "frozen-pocketwatch",
    name: "Frozen Pocketwatch",
    text: "Enemies stay Frozen for 1 additional turn",
  },
  {
    id: "lucky-clover",
    name: "Lucky Clover",
    text: "Nature hits have a 10% chance to grant Gold equal to enemy Health lost",
  },
] as const;
export type BoonId = (typeof BOONS)[number]["id"];

freeze(BOONS, true);
