---
name: fauna-creature-design
description: Design or revise Fauna abilities, passives and complete creature kits with elegant artwork-led mechanics, six passive tiers and coherent balance
---

# Fauna creature design

Use for individual abilities and passives, new creatures and substantial kit redesigns. [Creature design](../../../Docs/CREATURE_DESIGN.md) owns the detailed design criteria, budgets and implementation boundaries; read the Boss section only when relevant. For a focused ability or passive request, apply the relevant criteria without expanding it into a whole-kit redesign.

Follow [elegant abilities and passives](../../../Docs/CREATURE_DESIGN.md#elegant-abilities-and-passives): create a thematic relationship the player understands at a glance. Avoid phase bookkeeping, card taxonomy, routine trigger caps and chains of exceptions, including phrases such as "non-attack ability", "first time each turn" and "until your next turn". Simplify the mechanic itself rather than disguising those restrictions with shorter copy or hiding them in notes. Balance through values and natural interactions before adding conditions. Keep necessary player decisions explicit and engine details in implementation notes.

Inspect the portrait and relevant ability images, retaining source links/IDs or local paths. When essential imagery is inaccessible, keep dependent proposals provisional rather than treating filenames or prompts as visual evidence. For a complete-kit request, recommend one coherent kit faithful to the depicted actions; a focused ability request stays focused. Keep every authored ability at exactly 1 Mana. Check caps, timing, upgrades and reachable payoffs.

Read the current [creature catalog](../../../src/game/content/creatures.ts) and its referenced kits before claiming uniqueness; check execution when descriptions leave trigger or recipient semantics unclear. Passives must be mechanically unique among current creature passives; a different name, amount or damage type alone does not establish uniqueness. Compare against current creatures, talents and Boons; explain the distinct decision, nearest overlaps, example sequence and weakness.

Aim beyond a familiar “when X, gain Y” reward with a new trigger or payout. Explore a distinctive relationship that changes how the player uses or shares existing resources, chooses targets, sequences cards or assembles a team; the artwork should make that relationship intuitive. A reactive rule can still be right if its complete interaction creates a genuinely different decision, not merely another bonus. For each proposal, explain what the player does differently and test it against the nearest existing mechanics. Favor a clear rule over novelty that requires hidden exceptions, bookkeeping or a new keyword.

Every proposed passive, including brainstorming alternatives, must include exactly six total tiers: the base tier at zero stars and five upgrades through five stars. Each tier replaces the complete previous passive and must meaningfully improve its gameplay effect; wording changes alone do not count. Prefer a simple core rule that scales naturally, and check caps and rounding so every upgrade has a reachable benefit. A shared complete rule with six explicit values is sufficient when only the value changes.

Offer alternatives when requested or when a consequential unresolved choice materially changes the kit. A request to implement authorizes choosing routine details and proceeding; a request for design advice calls for a proposal. Ask only about consequential ambiguity that cannot be resolved from the request and project contracts.

Implement through the [ability mechanic](../../../Docs/CONTENT.md#adding-ability-mechanics), [modifier](../../../Docs/CONTENT.md#adding-gameplay-modifiers) and [passive tier](../../../Docs/CONTENT.md#creature-passive-tiers) owners, including their execution, preview, description and save consumers. A catalog entry alone does not establish execution support. Preserve deterministic behavior, focused regressions and provenance in the creature reference. Use the [UI task procedure](../../../Docs/UI.md#required-review) for rendered in-game review, and the [art direction skill](../fauna-art-direction/SKILL.md) when producing assets. Distinguish implementation, artistic acceptance and measured balance.
