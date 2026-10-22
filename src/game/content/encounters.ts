import { species } from "./species";
/** Stable legacy route; new expeditions use the saved packs in encounters.ts. */
export const ENCOUNTERS = (
  [
    {
      name: "The overgrown trail",
      enemies: [
        { damageType: "burn", name: "Emberback", species: "emberback" as const, damage: 4 },
        { damageType: "light", name: "Pollenmoth", species: "pollenmoth" as const, damage: 4 },
        { damageType: "nature", name: "Mossguard", species: "mossguard" as const, damage: 4 },
      ],
    },
    {
      name: "Beyond the fernwood",
      enemies: [
        {
          damageType: "physical",
          name: "Prismram",
          species: "prismram" as const,
          damage: 5,
        },
        { damageType: "light", name: "Pollenmoth", species: "pollenmoth" as const, damage: 5 },
        { damageType: "nature", name: "Mossguard", species: "mossguard" as const, damage: 4 },
      ],
    },
    {
      name: "Heart of the wilds",
      enemies: [{ damageType: "light", name: "The Hollow Crown", species: "prismram" as const, damage: 10 }],
    },
  ] as const
).map((encounter) => ({
  ...encounter,
  enemies: encounter.enemies.map((enemy) => ({ ...enemy, health: species(enemy.species).health })),
}));
