# Orifable and Food verification

Implementation and artwork review performed October 23, 2026, in the retained `creature-passive-tier-guidance` task worktree. [The creature reference](../content/creatures/orifable.md) owns the implemented rules; [art prompts](../content/creatures/orifable-art-prompts.md) preserve generation provenance.

## Checks observed

- The exact Orifable unit suite passed all 24 tests in one lightweight local run, including six passive tiers, opening/subsequent delivery, seeded duplicates, Food effects, neutral ownership, ordinary/Legendary swaps, copying, capacity, Consume, rejection, preview and current-format save round trips
- Asset preparation verified 191 selections, reusing 184 cached selections and preparing seven additions; the task output-only check also passed all 191 selections
- The changed-file gate passed formatting, syntax lint, source contracts and documentation checks; owning compilers, broad suites and full builds remain CI-owned
- New browser regressions are committed for CI; a separate focused Chromium preview exercised the live controls below without running the browser suite

## Rendered conditions and interactions

Inspected Collection/creature inspection, the six-card Food hand and Apple targeting at 1280×720 with 125% text and 1920×1080 with default text, with reduced motion. All captured layout checks and browser error lists were empty. The final Food-hand capture followed the review correction preserving existing owned-card recovery event attribution. It introduced no visual change.

Observed source/prepared comparisons and the rendered ArtCards retain the apple, berry cluster and loaf silhouettes, distinct red/blue/golden-brown palettes, full compositions and readable targeting copy. Orifable's three illustrations remain coherent with its courier identity. These observations establish source and rendered inspection, not user artistic approval or measured balance.

The live interaction pass confirmed keyboard selection and cancellation with focus return and no save change; Apple healing and Consume; reload/Continue retaining the other two Foods; immediate Mana Berries and its expected net Mana gain; Trail Bread's chosen-ally Block and Consume; and Care Package visibly creating two random neutral Foods. There were no uncaught browser errors. The preview contexts and servers were closed by their owning commands.

Evidence paths are relative to the retained task worktree under ignored reports:

- Baseline battle composition: `reports/review/orifable-before-7350f7fb-c978-4c96-9f83-8c755eef9fc4/`
- Final-tier Collection inspection: `reports/review/orifable-after-c54087d1-a2ab-4f47-8b9c-24ffc0c2b89b/`
- Initial Food-hand review: `reports/review/orifable-after-491f953a-34d8-48dd-9731-ae1d3076bfb6/`
- Apple targeting: `reports/review/orifable-after-fe9edbf3-08e1-45ed-a660-c7134e2360a0/`
- Final Food-hand review: `reports/review/orifable-final-03258be3-91ca-4b31-9e31-589e55cbeeba/`
- Recorded live interactions and created-Food screenshot: `reports/orifable-food/interactions.json` and `reports/orifable-food/created-in-battle-1280.png`
- Original/prepared Food comparison: `reports/orifable-food/prepared-comparison.png`

The baseline predates this creature and provides existing battle composition context; it is not a pixel-parity comparison with the new lineup. Capture directories retain checkpoint hashes, render-input identities, conditions and completion status.

## Boundaries

Full hosted CI, owning TypeScript compilers, broad balance simulations, native desktop, Windows packaging, physical controllers, Steam client and Steam Deck were not run for this change. Local browser results do not qualify those platforms. The existing ordinary-enemy no-hand model remains as documented in the creature reference; this change adds no enemy Food inventory.
