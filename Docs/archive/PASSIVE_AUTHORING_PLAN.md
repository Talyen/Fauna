# Simplify passive tier authoring

Withdrawn after review: future tiers are expected to change mechanics as well as amounts, so explicit complete tier objects remain the standard. No runtime changes were made. The original assessment below is retained for context. Assessed October 23, 2026 against committed local main `3ee3e5978574a9378e98cbca65c0772433c015eb`.

## Finding

We express most passive progressions as six separately authored copies of the same rule. The useful information is the six balance values and the rule connecting a value to its description and effect. Repeating the surrounding objects makes that information harder to see and leaves words and mechanics independently editable at every rank.

Source inspection found that **27 of the 28 creature kits have the same single-effect structure at all six tiers**, changing only `amount`. That is 162 manually paired descriptions and effects. This is a confirmed maintenance cost, not a reproduced gameplay defect or measured performance problem.

Examples:

| Kit                                                        | Repeated rule                   | Explicit tier amounts   |
| ---------------------------------------------------------- | ------------------------------- | ----------------------- |
| [Mossguard](../../src/game/content/creatures/mossguard.ts) | Retain more Block               | 10, 20, 30, 40, 50, 60  |
| [Memento](../../src/game/content/creatures/memento.ts)     | An Echo attacks after each card | 3, 4, 5, 6, 7, 8        |
| [Rookhaven](../../src/game/content/creatures/rookhaven.ts) | Drawing a card may copy it      | 20, 35, 50, 70, 85, 100 |
| [Almanelle](../../src/game/content/creatures/almanelle.ts) | Decaying Block becomes Thorns   | 50, 60, 70, 80, 90, 100 |

The amounts must remain explicit: Rookhaven and several other kits do not follow a fixed increment. Some final-tier descriptions deliberately omit “100%”; their exact wording must survive.

[Pollenmoth](../../src/game/content/creatures/pollenmoth.ts) is the exception. Its tiers change effect counts, bounce amounts, probabilities and healing behavior. Its explicit tier objects communicate real differences and should remain.

## Proposed design

Add one small content-only helper beside [card-builders.ts](../../src/game/content/card-builders.ts). It takes exactly six numeric amounts and a function producing one complete [PassiveTier](../../src/game/content/types.ts). It returns the existing six-entry tuple, constructed once at module initialization.

Mossguard's proposed declaration:

```ts
passiveTiers: passiveTiers([10, 20, 30, 40, 50, 60], (amount) => ({
  description: `Retain ${amount}% more Block between turns`,
  effects: [{ kind: "blockRetention", amount }],
})),
```

The helper's input tuple and return type enforce six entries without an unchecked array-to-tuple assertion. Invoke the factory separately for each amount so tiers do not share mutable effect arrays. Existing catalog freezing remains the publication boundary.

Keep the description factory local to each creature. Preserve special 100% wording with an explicit conditional there. Keep Pollenmoth's literal tuple and permit future kits to do the same when tiers change mechanics.

The runtime still receives six complete replacement passives. [creaturePassive](../../src/game/progression.ts), combat, inspection, save validation and catalog order need no new representation. Add no runtime rank calculation, inheritance, template language, generated source files, dependency or generalized effect builder.

## Implementation sequence

1. **Capture the existing contract.** Before editing kits, record each species ID and all six descriptions and ordered effect arrays from the committed catalog. Use an independent before/after comparison; comparing a helper's output only to a fixture built by that helper would miss accidental balance or wording changes. Keep the temporary comparison evidence with the task rather than creating another maintained content catalog.
2. **Prove the helper with three consumers.** Convert Mossguard, Rookhaven and Almanelle first. They cover regular increments, irregular increments and special final-tier wording. Preserve every numeric value, string, property presence and effect order. Keep the current types and catalog validation.
3. **Convert the remaining matching kits.** Apply the same pattern to the other 24 single-effect progressions. Leave Pollenmoth explicit. Read each diff against the captured values; do not combine this with balance, copy, card, artwork or catalog-order changes.
4. **Verify and document the final contract.** Update the passive authoring section of [Content](../CONTENT.md#creature-passive-tiers) with the concise pattern and explicit-tier exception. Review the helper and all converted definitions together, then use the protected integration procedure in [Contributing](../../CONTRIBUTING.md#worktrees-and-integration).

Use one task branch with reviewable commits. No save-format change or migration is expected because the expanded content and saved state remain identical.

## Verification and exit criteria

- Every species' expanded passive descriptions and effect arrays equal the captured baseline exactly, including optional-property presence and effect order
- Each species still provides six distinct complete tiers; player ranks zero through five and enemy base-tier selection remain unchanged
- Shared catalog definitions and nested effects remain immutable; constructing one tier cannot change another
- The diff contains the small helper, 27 converted passive declarations and focused documentation/coverage changes; no combat or progression rewrite

During implementation, run the exact [creature-passives suite](../../tests/unit/game/creature-passives.test.ts) as the single focused local regression under the current one-worker, 30-second limit. If a helper isolation regression is missing, add it to that suite. Keep existing malformed-tier and duplicate-effect checks.

Hosted CI owns compilation, the [content ownership suite](../../tests/unit/game/content-ownership.test.ts), species-specific behavior tests and broader runtime/browser checks. The exact catalog comparison is the primary evidence of unchanged displayed rules and mechanics. If it reveals any wording or output change, restore parity; a deliberate visual change would additionally require the [rendered review procedure](../UI.md#required-review). Follow [Contributing](../../CONTRIBUTING.md#verification) for current execution limits and report deferred gates explicitly.

## Why this is worth doing

A balance edit becomes a six-number list. A shared wording change becomes one description expression. Reviewers can see the entire progression without scanning six repeated objects, while unusual kits retain direct authoring. The improvement is fewer independent places to keep consistent; no speed or bug-reduction claim depends on it.

This assessment used source inspection only. No tests, compilation, simulation or rendered inspection were needed to establish the authoring duplication; implementation and its verification remain proposed.
