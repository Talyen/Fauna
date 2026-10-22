import { species } from "./species";
/** Stable legacy route; new expeditions use the saved packs in encounters.ts. */
export const ENCOUNTERS = (
  [
    {
      name: "The overgrown trail",
      enemies: [
        { damageType: "burn", name: "Emberback", species: "emberback" as const },
        { damageType: "light", name: "Pollenmoth", species: "pollenmoth" as const },
        { damageType: "nature", name: "Mossguard", species: "mossguard" as const },
      ],
    },
    {
      name: "Beyond the fernwood",
      enemies: [
        {
          damageType: "physical",
          name: "Prismram",
          species: "prismram" as const,
        },
        { damageType: "light", name: "Pollenmoth", species: "pollenmoth" as const },
        { damageType: "nature", name: "Mossguard", species: "mossguard" as const },
      ],
    },
    {
      name: "Heart of the wilds",
      enemies: [{ damageType: "light", name: "The Hollow Crown", species: "prismram" as const }],
    },
  ] as const
).map((encounter) => ({
  ...encounter,
  enemies: encounter.enemies.map((enemy) => ({ ...enemy, health: species(enemy.species).health })),
}));
