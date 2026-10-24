import { boonRule } from "../rules/boons";
import { freeze } from "immer";
export const BOONS = [
  { id: "tattered-pages", name: "Tattered Pages", text: boonRule("tattered-pages").text },
  { id: "bone-charm", name: "Bone Charm", text: boonRule("bone-charm").text },
  { id: "ironwood-buckler", name: "Ironwood Buckler", text: boonRule("ironwood-buckler").text },
  { id: "icy-heart", name: "Icy Heart", text: boonRule("icy-heart").text },
  { id: "meteorite", name: "Meteorite", text: boonRule("meteorite").text },
  {
    id: "sin-eaters-lantern",
    name: "Sin-Eater's Lantern",
    text: boonRule("sin-eaters-lantern").text,
  },
  { id: "thunderstone", name: "Thunderstone", text: boonRule("thunderstone").text },
  { id: "groves-favor", name: "Grove's Favor", text: boonRule("groves-favor").text },
  { id: "brass-censer", name: "Brass Censer", text: boonRule("brass-censer").text },
  { id: "parasitic-bloom", name: "Parasitic Bloom", text: boonRule("parasitic-bloom").text },
  { id: "cutpurse-knife", name: "Cutpurse Knife", text: boonRule("cutpurse-knife").text },
  {
    id: "merchants-favor",
    name: "Merchant's Favor",
    text: boonRule("merchants-favor").text,
  },
  {
    id: "plague-doctors-mask",
    name: "Plague Doctor's Mask",
    text: boonRule("plague-doctors-mask").text,
  },
  {
    id: "sundering-charm",
    name: "Sundering Charm",
    text: boonRule("sundering-charm").text,
  },
  { id: "resonant-chimes", name: "Resonant Chimes", text: boonRule("resonant-chimes").text },
  { id: "smugglers-map", name: "Smuggler's Map", text: boonRule("smugglers-map").text },
  {
    id: "frozen-pocketwatch",
    name: "Frozen Pocketwatch",
    text: boonRule("frozen-pocketwatch").text,
  },
  {
    id: "lucky-clover",
    name: "Lucky Clover",
    text: boonRule("lucky-clover").text,
  },
] as const;
export type BoonId = (typeof BOONS)[number]["id"];

freeze(BOONS, true);
