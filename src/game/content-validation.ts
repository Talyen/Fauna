import { CARDS, SPECIES, INITIAL_SPECIES, ENCOUNTERS } from "./content";
import { LOCATIONS, BIOMES } from "./destinations";
import { RELICS, TALENTS, TALENT_EFFECTS } from "./progression";
import { DAMAGE_TYPES, EFFECT_KEYWORDS, PROGRESSION_KEYWORDS, definitionKeywords } from "./keywords";

export const contentCatalog = {
  cards: CARDS,
  species: SPECIES,
  locations: LOCATIONS,
  biomes: BIOMES,
  relics: RELICS,
  talents: TALENTS,
};
export interface ContentIssue {
  severity: "error" | "warning";
  id: string;
  field: string;
  message: string;
}
export function validateCatalog(catalog: typeof contentCatalog = contentCatalog): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const error = (id: string, field: string, message: string) =>
    issues.push({ severity: "error", id, field, message });
  for (const [field, entries] of Object.entries(catalog).filter(([key]) => key !== "biomes")) {
    const ids = new Set<string>();
    for (const entry of entries as readonly { id: string }[]) {
      if (!/^[a-z][a-zA-Z0-9.-]*$/.test(entry.id) || ids.has(entry.id))
        error(entry.id, field, "Invalid or duplicate ID.");
      ids.add(entry.id);
    }
  }
  const species = new Set(catalog.species.map((entry) => entry.id));
  for (const id of INITIAL_SPECIES) if (!species.has(id)) error(id, "starter", "Unknown starter.");
  for (const entry of catalog.species) {
    if (!Number.isSafeInteger(entry.health) || entry.health < 1 || entry.health > 1_000_000)
      error(entry.id, "health", "Unsupported Health.");
    if (!entry.name.trim() || !entry.description.trim())
      error(entry.id, "description", "Name and trait description required.");
    if (catalog.cards.filter((card) => card.species === entry.id).length !== 3)
      error(entry.id, "cards", "Species must contribute exactly three cards.");
  }
  for (const card of catalog.cards) {
    if (!species.has(card.species)) error(card.id, "species", "Unknown owner.");
    if (!Number.isSafeInteger(card.cost) || card.cost < 0 || card.cost > 3)
      error(card.id, "cost", "Unsupported Mana cost.");
    if (!Number.isSafeInteger(card.value) || card.value < 1 || card.value > 1_000_000)
      error(card.id, "value", "Unsupported effect amount.");
    for (const tag of [card.leech])
      if (tag !== undefined && typeof tag !== "boolean") error(card.id, "tags", "Invalid card tag.");
    for (const effect of card.effects ?? []) {
      if (!Number.isSafeInteger(effect.amount) || effect.amount < 1 || effect.amount > 100)
        error(card.id, "effects", "Unsupported supplemental amount.");
      if (!["damage", "status", "draw", "mana", "cleanse", "purge"].includes(effect.kind))
        error(card.id, "effects", "Unknown supplemental effect.");
      if (effect.kind === "damage" && !DAMAGE_TYPES.includes(effect.damageType))
        error(card.id, "effects", "Unknown supplemental damage type.");
      if (effect.kind === "status" && !["armor", "forge", "thorns", "dodge"].includes(effect.status))
        error(card.id, "effects", "Unknown granted status.");
    }
    if (!Object.hasOwn(EFFECT_KEYWORDS, card.effect)) error(card.id, "effect", "Unknown effect.");
    else if (card.effect === "attack" && !DAMAGE_TYPES.includes(card.damageType))
      error(card.id, "damageType", "Unknown damage type.");
    else {
      if (!definitionKeywords(card).every((keyword) => PROGRESSION_KEYWORDS.includes(keyword)))
        error(card.id, "keywords", "Invalid progression classification.");
    }
  }
  for (const place of catalog.locations) {
    if (!place.packs.length) error(place.id, "packs", "Location has no packs.");
    for (const pack of place.packs)
      if (pack.length < 1 || pack.length > 3 || pack.some((id) => !species.has(id)))
        error(place.id, "packs", "Invalid encounter pack.");
  }
  catalog.biomes.forEach((biome) => {
    const ids: readonly string[] = [...biome.locations, biome.boss];
    if (new Set(ids).size !== ids.length || biome.locations.length < 4)
      error(biome.name, "locations", "Biome needs four distinct ordinary locations and a boss.");
    for (const id of ids)
      if (!catalog.locations.some((place) => place.id === id)) error(id, "biome", "Unknown biome location.");
  });
  for (const encounter of ENCOUNTERS)
    for (const enemy of encounter.enemies) {
      if (
        !species.has(enemy.species) ||
        !Number.isSafeInteger(enemy.health) ||
        enemy.health < 1 ||
        !Number.isSafeInteger(enemy.damage) ||
        enemy.damage < 0
      )
        error(encounter.name, "enemies", "Invalid legacy enemy.");
    }
  for (const talent of catalog.talents) {
    if (!PROGRESSION_KEYWORDS.includes(talent.keyword) || !TALENT_EFFECTS.includes(talent.effect))
      error(talent.id, "effect", "Unknown keyword or talent effect.");
    if (
      !Number.isSafeInteger(talent.row) ||
      talent.row < 0 ||
      (talent.row > 0 &&
        !catalog.talents.some((other) => other.keyword === talent.keyword && other.row === talent.row - 1))
    )
      error(talent.id, "row", "Talent rows must be contiguous.");
    if (talent.id !== `${talent.keyword}.${talent.effect}` || !talent.text.trim())
      error(talent.id, "description", "Talent identity or description is inconsistent.");
  }
  for (const relic of catalog.relics)
    if (!relic.name.trim() || !relic.text.trim())
      error(relic.id, "description", "Relic needs a name and effect description.");
  for (const keyword of PROGRESSION_KEYWORDS)
    if (
      !catalog.cards.some(
        (card) =>
          Object.hasOwn(EFFECT_KEYWORDS, card.effect) &&
          (card.effect !== "attack" || DAMAGE_TYPES.includes(card.damageType)) &&
          definitionKeywords(card).includes(keyword),
      )
    )
      issues.push({
        severity: "warning",
        id: keyword,
        field: "availability",
        message: "No authored player card earns this keyword yet.",
      });
  return issues;
}
export function validateContent() {
  const errors = validateCatalog().filter((issue) => issue.severity === "error");
  if (errors.length)
    throw new Error(errors.map((issue) => `${issue.id}.${issue.field}: ${issue.message}`).join("\n"));
}
