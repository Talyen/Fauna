---
name: fauna-creature-design
description: Design and implement Fauna creature kits from artwork, with distinct passive choices, ability alternatives, balance reasoning and Boss or Legendary design
---

# Fauna creature design

Use for new creatures and substantial kit redesigns. Follow [Creature design](../../../Docs/CREATURE_DESIGN.md) and the [content contracts](../../../Docs/CONTENT.md); read the [Boss section](../../../Docs/CREATURE_DESIGN.md#boss-and-legendary-creatures) when relevant.

1. **Inspect the images.** Look at the creature portrait and every ability illustration, using connected Drive tools or local originals. Record sources, separate observations from interpretations, and keep designs provisional if essential art is inaccessible. Extract themes, mood, style and possible strategic identities; each ability's main effect must match its depicted action.
2. **Find a distinct identity.** Compare against all current [creature kits](../../../src/game/content/creatures.ts), plus relevant keywords, talents and Boons. Judge triggers, targets, timing, outcomes and player decisions. A renamed or renumbered passive is insufficient.
3. **Offer choices.** Normally propose three distinct passives and two or three mechanics for **each ability image**. Include artwork rationale, concise rules, nearest overlaps and tradeoffs; sketch six passive tiers and estimate ability budgets. Recommend a coherent kit with an example sequence and weakness. Default to presenting options and waiting for the user's choice; proceed when selection or delegation is already explicit.
4. **Budget the kit.** Every authored ability costs exactly 1 Mana. Most base abilities aim near six points; explain meaningful deviations. Account for utility, persistence, target count, caps, upgrades and passive amplification. Confirm payoffs are reachable and resource loops bounded.
5. **Implement the choice.** Specify all six distinct complete passive tiers, trigger ordering, stacking and reset rules. Keep execution, previews, descriptions, enemy use, saves and assets consistent. Follow [implementation and validation](../../../Docs/CREATURE_DESIGN.md#implementation-and-validation), including focused regressions and rendered review.

Use [art direction](../fauna-art-direction/SKILL.md) for asset work, [UI design](../fauna-ui-design/SKILL.md) for layout changes and [UI critique](../fauna-ui-critique/SKILL.md) for rendered review. Preserve decisions and provenance in the [creature reference](../../../Docs/content/creatures/README.md). Distinguish implementation and observed verification from artistic acceptance and measured balance.
