import { freeze } from "immer";
import { species } from "./species";
/** Stable legacy route; new expeditions use the saved packs in encounters.ts. */
export const ENCOUNTERS = (
  [
    {
      name: "The overgrown trail",
      enemies: [
        { name: "Emberback", species: "emberback" as const },
        { name: "Pollenmoth", species: "pollenmoth" as const },
        { name: "Mossguard", species: "mossguard" as const },
      ],
    },
    {
      name: "Beyond the fernwood",
      enemies: [
        {
          name: "Prismram",
          species: "prismram" as const,
        },
        { name: "Pollenmoth", species: "pollenmoth" as const },
        { name: "Mossguard", species: "mossguard" as const },
      ],
    },
    {
      name: "Heart of the wilds",
      enemies: [{ name: "The Hollow Crown", species: "prismram" as const }],
    },
  ] as const
).map((encounter) => ({
  ...encounter,
  enemies: encounter.enemies.map((enemy) => ({ ...enemy, health: species(enemy.species).health })),
}));

freeze(ENCOUNTERS, true);
