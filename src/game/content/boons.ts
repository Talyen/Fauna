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
  { id: "rainkeeper", name: "Rainkeeper", text: boonRule("rainkeeper").text },
  { id: "dream-yo-yo", name: "Dream Yo-Yo", text: boonRule("dream-yo-yo").text },
  {
    id: "basalt-glass-bookmark",
    name: "Basalt Glass Bookmark",
    text: boonRule("basalt-glass-bookmark").text,
  },
  { id: "wonder-domino", name: "Wonder Domino", text: boonRule("wonder-domino").text },
  { id: "furnace-prism", name: "Furnace Prism", text: boonRule("furnace-prism").text },
  { id: "last-threshold", name: "Last Threshold", text: boonRule("last-threshold").text },
  { id: "camp-hammock", name: "Camp Hammock", text: boonRule("camp-hammock").text },
  { id: "honeycomb-frame", name: "Honeycomb Frame", text: boonRule("honeycomb-frame").text },
  { id: "undertow-castanets", name: "Undertow Castanets", text: boonRule("undertow-castanets").text },
  { id: "orbit-armillary", name: "Orbit Armillary", text: boonRule("orbit-armillary").text },
] as const;
export type BoonId = (typeof BOONS)[number]["id"];

freeze(BOONS, true);
