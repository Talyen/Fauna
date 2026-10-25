# Dulcera implementation evidence

The owner selected Gentle Passage and three artwork-led abilities on October 25, 2026. [The creature reference](../content/creatures/dulcera.md) owns the kit and resolution contract.

## Scope and checks

- One exact focused regression command: `npm test -- tests/unit/game/creatures/dulcera.test.ts`; 18 tests passed in 804 ms with one worker under the local deadline
- Covered all six passive tiers, outgoing/incoming/duplicate providers, knockout and Legendary replacements, inactive providers, position-only swaps, healing modifiers and caps, preview/rejected-command parity, save/resume, enemy abilities, Mana refund, group Block, complete Cleanse, encounter and recruitment
- Imported four unchanged Drive PNGs and prepared four lossless objects through `npm run assets:prepare`; 204 selections verified, 200 cache hits
- No saved fields were introduced; current-format saves use the expanded catalog and existing formation/Health data

## Rendered review

Pre-edit reference: `reports/review/dulcera-before-1feaee13-b439-4bd3-acd6-21bdaad7288b/`, Almanelle Collection inspection at 1280×720 with 125% text and 1920×1080 with default text. The minimum-size frame was inspected for the existing three-illustration layout and passive disclosure.

Current Dulcera review did not launch: the required shared host lane returned busy after its bounded 30-second wait. Its recorded owner was Trinket's `career-cohort-verification` release build, with a 900-second lease. The task left the foreign process and lock undisturbed. The prepared focused review script remains at `reports/dulcera-review.mjs`; it captures Collection, battle and five-star inspection, then exercises the three abilities, save/resume, rule tooltips, focus return and the controlled unavailable state.

[Dulcera's browser regressions](../../tests/e2e/dulcera.spec.ts) retain the keyboard play and Collection disclosure flows for CI. They were not run locally. Source artwork inspection and passing focused regressions do not establish current rendered completion; integration is blocked until the new rendered flow can be inspected.

## Verification boundaries

Focused browser evidence uses Chromium simulation and a Vite development preview. Full static/type checks, broader unit/DOM/browser suites, builds, balance sweeps and hosted CI remain pending. Native desktop, Windows packaging, physical controllers, Steam and Steam Deck were not exercised.

## Main synchronization and render retry

The resumed review incorporated main through `7ef51c3`, retaining Arabesca's shared repeats and Skybex's incoming protection. Catalogs and encounter packs keep current main's order and append Dulcera. The shared swap owner retains both creatures' grants, and the historical ability oracle continues excluding the separately tested new kits without regenerating older expectations.

The focused Dulcera suite then ran 19 cases: 18 passed, including the new combined protection/healing/repeat case. One fixture failed because `swapFromCard` now returns the incoming creature and its old expression-bodied Immer producer both mutated and returned a value. The producer was corrected to return nothing; further unit execution remains deferred under the focused local budget. No player behavior was changed by that fixture repair.

Two bounded render-admission attempts returned busy with both slots occupied by Trinket work; neither launched the preview. The task preserved both owners and their locks. Collection scenarios and browser coverage now navigate to Dulcera's catalog page before opening inspection. Asset publication was refreshed from 212 existing cached objects, with no new image encoding.
