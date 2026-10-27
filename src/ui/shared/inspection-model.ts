import type { Card } from "../../game/types";
import type { SpeciesId } from "../../game/content";
export type Inspection = { card: Card } | { species: SpeciesId; creatureId?: string; speciesKit?: boolean };
