# Almanelle implementation evidence — October 23, 2026

The user selected Fallen Leaves at 50–100%, Rooted Year with three self Block and three Thorns, and Autumn Insight with random discard recovery and three healing to an injured ally. The [creature reference](../content/creatures/almanelle.md) owns the current kit, boundaries and artwork provenance

## Source and conditions

Rendered review used gameplay/content commit `6a6693cc169835f502a376a77bba5cd7c8a8961b`. Subsequent documentation records the evidence without changing gameplay or presentation. Four unchanged Drive originals were inspected and prepared through the existing lossless pipeline

Quiet Vite/Chromium preview used fresh browser contexts, seed 42 and reduced motion. Collection, the five-star passive, battle and Autumn Insight targeting were captured at 1280×720 with 125% text and 1920×1080 with default text. All eight frames completed with no browser errors or layout violations. The existing Collection inspector was inspected at the same two conditions before adding the kit

Evidence remains in `/Users/ryanmcintire/Developer/Fauna/.worktrees/almanelle/reports/review/`:

| Evidence                              | Directory                                                   |
| ------------------------------------- | ----------------------------------------------------------- |
| Existing inspector baseline           | `almanelle-before-37609028-2b67-4356-8f63-0c06981428b1`     |
| Collection and base passive           | `almanelle-collection-44b6cb4b-e83f-4e03-895b-351d70cd5029` |
| Five-star passive                     | `almanelle-rank-five-573a25fd-5240-48cf-a4ac-436784382d22`  |
| Battle and hand                       | `almanelle-battle-12f6a100-f247-4d33-8831-5c62fd4a0e48`     |
| Autumn Insight targeting              | `almanelle-targeting-52804d43-e87a-481a-b916-7c49b1dcb236`  |
| Focused interaction frames and checks | `almanelle-interactions-final`                              |

Each complete capture directory retains its checkpoint, source identity, conditions and `evidence.json`. The interaction record identifies the same gameplay commit. Earlier incomplete attempts remain diagnostic material and are not completion evidence

## Observations and exercised flow

Whole-screen inspection found readable creature silhouettes and uncropped native compositions. The water arc, autumn leaves and flowering shelter remain distinct in the hand and inspector. Base and final passive copy, stars, action tooltips, targeting instructions and forecasts fit at the recorded conditions. Existing keyword colors distinguish Block, Thorns and Health against the dark surface

Focused mouse/keyboard review exercised all three ability tooltips and individual artwork views, Escape back to the ability row, focus return and Collection close. In battle it exercised Autumn Insight selection, an invalid enemy target, healing preview, keyboard cancellation without changing committed state/RNG, random recovery and chosen-ally healing. Mouse interaction remains hover-driven; explicit keyboard navigation activates focus restoration under the existing input contract

Committed Rooted Year visibly grants three Block and three Thorns. Spring Current removes Almanelle's Burn. Reload/Continue preserves the committed battle. An isolated turn-boundary fixture visibly converts twenty Block to ten Block and five Thorns at base rank, after periodic damage. A zero-Mana card remains unavailable and does not mutate state. The completed interaction run reported no browser errors

## Checks and limits

- All 19 focused Almanelle regressions passed under the bounded one-worker launcher, covering all six tiers, rounding, actual turn ordering, reserves, knockouts, caps, enemy use, targeted recovery/healing, repeats, upgrades, preview parity, save/resume and recruitment
- Changed-file formatting, syntax lint, source boundaries and documentation checks passed; the protected integration gate reruns these checks on the combined result
- Prepared-output validation passed for all 184 selections; four new source selections were prepared without regenerating the existing 180 cached selections
- Full compiler/static checks, broad unit/browser suites, builds, desktop, Windows packaging, physical controllers, Steam client and Steam Deck remain unrun and CI/platform-owned
- The user approved the mechanics. Rendered inspection establishes implementation review, not separate artistic acceptance or measured balance
