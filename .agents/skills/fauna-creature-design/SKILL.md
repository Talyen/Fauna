---
name: fauna-creature-design
description: Design and implement Fauna creature kits from creature and ability artwork, with distinct passive options, ability alternatives, balance reasoning and boss or Legendary design
---

# Fauna creature design

Use this workflow for new creatures and substantial kit redesigns. For a narrow bug fix or numerical tuning request, keep the work scoped to that request. The maintained design workflow is [Creature design](../../../Docs/CREATURE_DESIGN.md); read it alongside the [content contracts](../../../Docs/CONTENT.md) before proposing mechanics. Read its [boss section](../../../Docs/CREATURE_DESIGN.md#boss-and-legendary-creatures) for a Boss or Legendary.

## Start with the pictures

Inspect the actual creature portrait and every supplied ability illustration before assigning mechanics. Use the connected Google Drive workflow when sources are in Drive, or inspect preserved local originals; filenames, metadata and prompts alone are insufficient visual evidence. Record source references and distinguish what is visible from your interpretation. If an essential image cannot be accessed, identify the gap and keep dependent designs provisional.

Extract themes, mood, visual style, silhouette, materials, motion and relationships. Turn those observations into two or three possible strategic identities. Each ability's main effect must match its depicted action: shields protect, attacks threaten, restoration restores. Do not invent an unrelated effect merely to fill a missing kit role.

## Compare before proposing

Read the current catalog in [creature kits](../../../src/game/content/creatures.ts) and its individual definitions, plus relevant [keywords](../../../src/game/keywords.ts), talents and Boons. Compare mechanics rather than names: triggers, targets, timing, outcomes, resources, limits and the decisions they create. Use the closest current kits as evidence; do not rely on a remembered roster or a permanent copied catalog.

Propose about three meaningfully different passive options and two or three mechanical options **for each ability illustration**, unless the user requests another amount. Each passive must differ from every current creature passive; explain the new strategic decision and the nearest overlap. A renamed or renumbered existing passive does not qualify. Prefer species identity beyond a bonus to one named card.

For each ability option, give concise rules, target/timing, artwork connection, approximate budget, closest existing effects and tradeoff. Flag exact ability overlap and try another art-consistent option; justified simple overlap is preferable to arbitrary complexity. Recommend one coherent kit and describe its play sequence and weakness. Offer mechanically different passive/ability combinations where useful, rather than silently committing to the first passive.

## Make the options concrete

- Keep every authored ability at exactly 1 Mana. Aim most base abilities around six points: 6 damage, Block or healing to one target, or 2 to each of three enemies/allies. This is an initial tuning heuristic, not a universal exchange rate.
- Price utility, persistence, damage types, target flexibility, passive triggers and resource loops explicitly using the [budget guidance](../../../Docs/CREATURE_DESIGN.md#ability-budgets). Show assumptions and deviations; do not grant a full six points plus free utility.
- Confirm payoffs are reachable under actual caps and reset timing before pricing them; a next-turn Mana grant can be ineffective when the turn already refills Mana to its maximum.
- Give all passive candidates a plausible six-tier progression; fully specify the selected passive's six distinct complete tiers before implementation. Check actual outcomes after caps and rounding.
- Separate established rules from proposed new mechanics. Identify implementation needs without letting current effect types dictate the entire creative space.
- If the request is to present choices, present the design packet before implementing a kit. Honor an existing choice or explicit delegation to choose and implement; do not request approval again. This skill grants no permission to publish, share or alter Drive sources.

## Implement and validate the selected kit

Follow the [implementation and validation steps](../../../Docs/CREATURE_DESIGN.md#implementation-and-validation), keeping gameplay, descriptions, previews, enemy behavior, progression, assets and any saved state consistent. For new hooks, define event ordering, recursion limits, ownership and lifetime before adding runtime state. Validate the changed behavior with focused regressions and the repository's permitted checks.

Use [art direction](../fauna-art-direction/SKILL.md) when producing or revising assets and [UI critique](../fauna-ui-critique/SKILL.md) for rendered presentation review; use [UI design](../fauna-ui-design/SKILL.md) when changing layout. Inspect the creature and abilities together in their real ArtCards and affected interaction before visual integration. Keep design choice, implementation, rendered evidence, balance evidence and observed CI/platform results distinct.

Preserve the final decisions and artwork provenance in the creature reference linked from the [creature index](../../../Docs/content/creatures/README.md). Report unresolved choices and validation limits without treating a point estimate as playtest acceptance.
