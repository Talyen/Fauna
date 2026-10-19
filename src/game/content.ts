export type SpeciesId = "mossback" | "emberfox" | "stormfin" | "silkmoth" | "briartooth" | "moonhart";
export type Effect = "attack" | "mark" | "guard" | "heal" | "teamGuard";
export interface Species {
  id: SpeciesId;
  name: string;
  title: string;
  health: number;
  color: string;
  trait: string;
  description: string;
}
export interface CardDefinition {
  id: string;
  species: SpeciesId;
  name: string;
  effect: Effect;
  value: number;
  cost: number;
}
export const SPECIES: readonly Species[] = [
  {
    id: "mossback",
    name: "Mossback",
    title: "The gentle guardian",
    health: 32,
    color: "#9ead70",
    trait: "Rooted",
    description: "Guard cards grant 2 extra block.",
  },
  {
    id: "emberfox",
    name: "Emberfox",
    title: "A spark in the undergrowth",
    health: 24,
    color: "#ed9c65",
    trait: "Kindling",
    description: "First attack each turn deals 2 extra damage.",
  },
  {
    id: "stormfin",
    name: "Stormfin",
    title: "The gathering storm",
    health: 26,
    color: "#8cbecb",
    trait: "Charged",
    description: "Mark cards apply 1 extra mark.",
  },
  {
    id: "silkmoth",
    name: "Silkmoth",
    title: "A little light in the dark",
    health: 23,
    color: "#d1b5d3",
    trait: "Tender",
    description: "Healing cards restore 2 extra health.",
  },
  {
    id: "briartooth",
    name: "Briartooth",
    title: "Wild at heart",
    health: 30,
    color: "#c7b76b",
    trait: "Thorns",
    description: "When hit, deal 2 damage back to the attacker.",
  },
  {
    id: "moonhart",
    name: "Moonhart",
    title: "Keeper of the quiet paths",
    health: 28,
    color: "#b7c6e0",
    trait: "Moonlit",
    description: "Start each battle with 4 block.",
  },
];
const card = (species: SpeciesId, name: string, effect: Effect, value: number, cost = 1): CardDefinition => ({
  id: `${species}-${effect}`,
  species,
  name,
  effect,
  value,
  cost,
});
export const CARDS: readonly CardDefinition[] = [
  card("mossback", "Bramble Bash", "attack", 6),
  card("mossback", "Shelter", "guard", 7),
  card("mossback", "Forest Mantle", "teamGuard", 3),
  card("emberfox", "Cinder Strike", "attack", 8),
  card("emberfox", "Warm Embers", "heal", 5),
  card("emberfox", "Soot Signal", "mark", 2),
  card("stormfin", "Arc Bite", "attack", 7),
  card("stormfin", "Storm Sign", "mark", 2),
  card("stormfin", "Static Veil", "guard", 6),
  card("silkmoth", "Glimmer", "attack", 5),
  card("silkmoth", "Mending Light", "heal", 8),
  card("silkmoth", "Silken Ward", "guard", 7),
  card("briartooth", "Thornlash", "attack", 8),
  card("briartooth", "Briar Coat", "guard", 7),
  card("briartooth", "Hunter’s Sign", "mark", 2),
  card("moonhart", "Moonbeam", "attack", 8),
  card("moonhart", "Silver Light", "heal", 7),
  card("moonhart", "Night Shelter", "teamGuard", 4),
];
export const INITIAL_SPECIES = SPECIES.slice(0, 5).map((s) => s.id);
export function species(id: SpeciesId): Species {
  const result = SPECIES.find((s) => s.id === id);
  if (!result) throw new Error(`Unknown species: ${id}`);
  return result;
}
export function definition(id: string): CardDefinition {
  const result = CARDS.find((c) => c.id === id);
  if (!result) throw new Error(`Unknown card: ${id}`);
  return result;
}
export function cardText(card: CardDefinition, level = 0): string {
  const value = card.value + level * 2;
  switch (card.effect) {
    case "attack":
      return `Deal ${value} damage. Consume marks for +3 damage each.`;
    case "mark":
      return `Apply ${value} marks. The next attack consumes them.`;
    case "guard":
      return `Give an ally ${value} block this turn.`;
    case "heal":
      return `Restore ${value} health to a living ally.`;
    case "teamGuard":
      return `Give every living ally ${value} block this turn.`;
  }
}
export const ENCOUNTERS = [
  {
    name: "The overgrown trail",
    enemies: [
      { name: "Bramble Imp", species: "briartooth" as const, health: 18, damage: 4 },
      { name: "Cinder Wisp", species: "emberfox" as const, health: 16, damage: 4 },
    ],
  },
  {
    name: "Beyond the fernwood",
    enemies: [
      { name: "Thicket Stalker", species: "stormfin" as const, health: 24, damage: 5 },
      { name: "Dusk Moth", species: "silkmoth" as const, health: 22, damage: 5 },
      { name: "Moss Imp", species: "mossback" as const, health: 18, damage: 4 },
    ],
  },
  {
    name: "Heart of the wilds",
    enemies: [{ name: "The Hollow Crown", species: "moonhart" as const, health: 68, damage: 10 }],
  },
] as const;
