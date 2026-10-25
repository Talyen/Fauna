# Dulcera implementation evidence

The owner selected Gentle Passage and three artwork-led abilities on October 25, 2026. [The creature reference](../content/creatures/dulcera.md) owns the kit and resolution contract.

## Scope and checks

- One exact focused regression command: `npm test -- tests/unit/game/creatures/dulcera.test.ts`; 18 tests passed in 804 ms with one worker under the local deadline
- Covered all six passive tiers, outgoing/incoming/duplicate providers, knockout and Legendary replacements, inactive providers, position-only swaps, healing modifiers and caps, preview/rejected-command parity, save/resume, enemy abilities, Mana refund, group Block, complete Cleanse, encounter and recruitment
- Imported four unchanged Drive PNGs and prepared four lossless objects through `npm run assets:prepare`; 204 selections verified, 200 cache hits
- No saved fields were introduced; current-format saves use the expanded catalog and existing formation/Health data

## Rendered review

Pre-edit reference: `reports/review/dulcera-before-1feaee13-b439-4bd3-acd6-21bdaad7288b/`, Almanelle Collection inspection at 1280×720 with 125% text and 1920×1080 with default text. The minimum-size frame was inspected for the existing three-illustration layout and passive disclosure.

The initial Dulcera review did not launch: the required shared host lane returned busy after its bounded 30-second wait. Its recorded owner was Trinket's `career-cohort-verification` release build, with a 900-second lease. The task left the foreign process and lock undisturbed. The prepared focused review script remains at `reports/dulcera-review.mjs`; it captures Collection, battle and five-star inspection, then exercises the three abilities, save/resume, rule tooltips, focus return and the controlled unavailable state.

[Dulcera's browser regressions](../../tests/e2e/dulcera.spec.ts) retain the keyboard play and Collection disclosure flows for CI. They were not run locally. The completed focused rendered review below supplies the local visual prerequisite separately from those CI regressions.

## Verification boundaries

Focused browser evidence uses Chromium simulation and a Vite development preview. Full static/type checks, broader unit/DOM/browser suites, builds, balance sweeps and hosted CI remain pending. Native desktop, Windows packaging, physical controllers, Steam and Steam Deck were not exercised.

## Main synchronization and render retry

The resumed review incorporated main through `7ef51c3`, retaining Arabesca's shared repeats and Skybex's incoming protection. Catalogs and encounter packs keep current main's order and append Dulcera. The shared swap owner retains both creatures' grants, and the historical ability oracle continues excluding the separately tested new kits without regenerating older expectations.

The focused Dulcera suite then ran 19 cases: 18 passed, including the new combined protection/healing/repeat case. One fixture failed because `swapFromCard` now returns the incoming creature and its old expression-bodied Immer producer both mutated and returned a value. The producer was corrected to return nothing. The single failed case was rerun with `npm test -- tests/unit/game/creatures/dulcera.test.ts -t "does not grant passage"`: 1 passed, 18 skipped, completing all 19 distinct cases across the two bounded invocations. No player behavior was changed by that fixture repair.

Three bounded render-admission attempts during the resumed review returned busy with both slots occupied by Trinket work; no preview was launched. The task preserved both owners and their locks. Collection scenarios and browser coverage now navigate to Dulcera's catalog page before opening inspection. Asset publication was refreshed from 212 existing cached objects, with no new image encoding.

## Completed rendered review

The focused browser review ran against combined source `fde608ec`, with main's Arabesca and Skybex changes included. All five captured frames completed without layout failures or browser errors:

| State                 | Evidence directory                                                   | Conditions                                           |
| --------------------- | -------------------------------------------------------------------- | ---------------------------------------------------- |
| Collection inspection | `reports/review/dulcera-after-de5390a1-8e0f-4f63-9490-a0fd878f6888/` | 1280×720 with 125% text; 1920×1080 with default text |
| Battle                | `reports/review/dulcera-after-e3e56093-f080-4a5a-b9cb-b7283912f867/` | 1280×720 with 125% text; 1920×1080 with default text |
| Five-star inspection  | `reports/review/dulcera-after-6ba77182-5d0f-4c44-ade3-6736df5987c6/` | 1280×720 with 125% text                              |

Whole-frame inspection confirmed that the portrait reads at battle size, the three ability illustrations preserve their compositions, the passive and all five stars fit, and the concise rules remain readable. Ability tooltips were inspected separately. No product layout or artwork correction was needed.

`reports/dulcera-interactions-reviewed/evidence.json` records a complete interaction pass with no browser errors. Keyboard plays verified Chapel Light's 3 Health and Mana refund, Meadow Shelter's 2 Block per deployed ally, and Hushed Waters' exchanged Coralcurl arriving at 13 Health with its harmful effects removed. The departing Dulcera retained Burn in backup. The exchanged lineup, Health, Block, Cleanse and Mana survived reload and Continue. Collection tooltips disclosed all three exact rules; Escape returned focus to Dulcera. A Frozen Dulcera's ability stayed unavailable and displayed the canonical rejection reason. Screenshots for these states are retained beside the report.

The first interaction attempt reached the loading splash after reload before its ad hoc five-second Continue assertion expired. That incomplete attempt remains in `reports/dulcera-interactions/`. The review script was corrected to use the shared startup-ready helper; the completed pass exercised the same committed save. This was a review-harness correction, not a game recovery change.

Computed tooltip foreground/background colors were measured in both hover and keyboard focus. Health, Mana, Block and Cleanse retained their shared colors against `rgb(17, 15, 14)`, with contrast ratios 6.91:1, 8.92:1, 11.47:1 and 12.92:1 respectively. Measurements are retained in `reports/dulcera-interactions-reviewed/colors.json`.

The local rendered prerequisite is complete. Subsequent edits record evidence only; full CI, balance and unrun platform qualifications remain separate gates.
