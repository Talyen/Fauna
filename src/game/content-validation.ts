import { CARDS, SPECIES, FIRST_RUN_STARTERS, ENCOUNTERS, BOONS, TALENTS, TALENT_EFFECTS } from "./content";
import { cardText } from "./card-rules";
import { BOSSES, COMBAT_PACKS, JOURNEY_LENGTH } from "./encounters";
import { DAMAGE_TYPES, EFFECT_KEYWORDS, PROGRESSION_KEYWORDS, definitionKeywords } from "./keywords";

export const contentCatalog = {
  cards: CARDS,
  species: SPECIES,
  bosses: BOSSES,
  combatPacks: COMBAT_PACKS,
  boons: BOONS,
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
  for (const [field, entries] of Object.entries(catalog).filter(([key]) => key !== "combatPacks")) {
    const ids = new Set<string>();
    for (const entry of entries as readonly { id: string }[]) {
      if (!/^[a-z][a-zA-Z0-9.-]*$/.test(entry.id) || ids.has(entry.id))
        error(entry.id, field, "Invalid or duplicate ID.");
      ids.add(entry.id);
    }
  }
  const species = new Set(catalog.species.map((entry) => entry.id));
  if (FIRST_RUN_STARTERS.length < 3 || new Set(FIRST_RUN_STARTERS).size !== FIRST_RUN_STARTERS.length)
    error("first-run", "starter", "First-run starter pool needs at least three distinct species.");
  for (const id of FIRST_RUN_STARTERS) if (!species.has(id)) error(id, "starter", "Unknown starter.");
  for (const entry of catalog.species) {
    if (!Number.isSafeInteger(entry.health) || entry.health < 1 || entry.health > 1_000_000)
      error(entry.id, "health", "Unsupported Health.");
    if (!entry.name.trim() || !entry.trait.trim())
      error(entry.id, "description", "Name and trait description required.");
    if (entry.passiveTiers.length !== 6 || Array.from(entry.passiveTiers).some((tier) => !tier))
      error(entry.id, "passiveTiers", "All six passive tiers must be defined.");
    const passiveEffects = new Set<string>();
    for (const tier of entry.passiveTiers) {
      if (!tier) continue;
      // Rules copy and object/effect order cannot disguise unchanged gameplay.
      const effectKey = JSON.stringify(
        tier.effects
          .map((effect) =>
            Object.entries(
              effect.kind === "bounce" ? { ...effect, chance: effect.chance ?? 1 } : effect,
            ).sort(([a], [b]) => a.localeCompare(b)),
          )
          .map((effect) => JSON.stringify(effect))
          .sort(),
      );
      if (passiveEffects.has(effectKey))
        error(entry.id, "passiveTiers", "Each passive tier must have different effects.");
      passiveEffects.add(effectKey);
      if (tier.description.includes("."))
        error(entry.id, "passiveTiers", "Effect descriptions must omit periods");
      if (
        !tier.description.trim() ||
        !tier.effects.length ||
        tier.effects.some(
          (effect) => !Number.isSafeInteger(effect.amount) || effect.amount < 1 || effect.amount > 1_000_000,
        )
      )
        error(entry.id, "passiveTiers", "Authored passive tiers need rules and supported effect amounts.");
    }
    for (const tier of entry.passiveTiers)
      for (const effect of tier?.effects ?? []) {
        if (effect.kind === "wellRead" && effect.amount > 100)
          error(entry.id, "passiveTiers", "Copy chance cannot exceed 100 percent");
        if (
          effect.kind === "bounce" &&
          (effect.amount > 2 ||
            !["light", "heal"].includes(effect.effect) ||
            (effect.chance !== undefined &&
              (!Number.isFinite(effect.chance) || effect.chance <= 0 || effect.chance > 1)))
        )
          error(entry.id, "passiveTiers", "Invalid bounce count, effect or chance.");
      }
    if (catalog.cards.filter((card) => card.species === entry.id).length !== 3)
      error(entry.id, "cards", "Species must contribute exactly three cards.");
  }
  for (const card of catalog.cards) {
    if (Object.hasOwn(EFFECT_KEYWORDS, card.effect) && cardText(card).includes("."))
      error(card.id, "description", "Effect descriptions must omit periods");
    if (!species.has(card.species)) error(card.id, "species", "Unknown owner.");
    if (card.cost !== 1) error(card.id, "cost", "Every ability must cost exactly 1 Mana.");
    if (!Number.isSafeInteger(card.value) || card.value < 1 || card.value > 1_000_000)
      error(card.id, "value", "Unsupported effect amount.");
    if (
      card.effect === "attack" &&
      card.alternateDamageType !== undefined &&
      !DAMAGE_TYPES.includes(card.alternateDamageType)
    )
      error(card.id, "alternateDamageType", "Unknown alternate damage type.");
    for (const tag of [card.leech])
      if (tag !== undefined && typeof tag !== "boolean") error(card.id, "tags", "Invalid card tag.");
    if (
      card.repeatChance !== undefined &&
      (!Number.isSafeInteger(card.repeatChance) || card.repeatChance < 1 || card.repeatChance > 100)
    )
      error(card.id, "repeatChance", "Repeat chance must be a whole percentage from 1 to 100.");
    for (const effect of card.effects ?? []) {
      if (!Number.isSafeInteger(effect.amount) || effect.amount < 1 || effect.amount > 100)
        error(card.id, "effects", "Unsupported supplemental amount.");
      if (
        ![
          "damage",
          "status",
          "draw",
          "mana",
          "cleanse",
          "purge",
          "reflect",
          "heal",
          "blind",
          "meltArmor",
          "nullifyFreeze",
        ].includes(effect.kind)
      )
        error(card.id, "effects", "Unknown supplemental effect.");
      if (effect.kind === "damage" && !DAMAGE_TYPES.includes(effect.damageType))
        error(card.id, "effects", "Unknown supplemental damage type.");
      if (effect.kind === "status" && !["armor", "thorns", "dodge"].includes(effect.status))
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
  if (!catalog.combatPacks.length) error("combat", "packs", "No combat packs.");
  for (const pack of [...catalog.combatPacks, ...catalog.bosses.map((boss) => boss.pack)])
    if (pack.length < 1 || pack.length > 3 || pack.some((id) => !species.has(id)))
      error("encounters", "packs", "Invalid encounter pack.");
  for (const pack of catalog.combatPacks)
    if (pack.some((id) => catalog.species.find((entry) => entry.id === id)?.legendary))
      error("combat", "packs", "Legendaries only appear in Boss encounters");
  for (const boss of catalog.bosses)
    if (boss.pack.length !== 1 || !catalog.species.find((entry) => entry.id === boss.pack[0])?.legendary)
      error(boss.id, "packs", "Boss encounters require one Legendary");
  const encounters = new Set<number>();
  for (const boss of catalog.bosses) {
    if (
      !Number.isInteger(boss.encounter) ||
      boss.encounter < 0 ||
      boss.encounter >= JOURNEY_LENGTH ||
      encounters.has(boss.encounter)
    )
      error(boss.id, "encounter", "Invalid or repeated boss encounter.");
    encounters.add(boss.encounter);
    if (!boss.name.trim()) error(boss.id, "stats", "Invalid boss name or stats.");
  }
  for (const encounter of ENCOUNTERS)
    for (const enemy of encounter.enemies) {
      if (!species.has(enemy.species) || !Number.isSafeInteger(enemy.health) || enemy.health < 1)
        error(encounter.name, "enemies", "Invalid legacy enemy.");
    }
  for (const talent of catalog.talents) {
    if (talent.text.includes(".")) error(talent.id, "description", "Effect descriptions must omit periods");
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
  for (const boon of catalog.boons)
    if (!boon.name.trim() || !boon.text.trim() || boon.text.includes("."))
      error(boon.id, "description", "Boon needs a name and effect description.");
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
