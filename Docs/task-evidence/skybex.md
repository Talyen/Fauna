# Skybex implementation evidence

Date: October 25, 2026

[Selected kit and artwork provenance](../content/creatures/skybex.md) · [Focused regressions](../../tests/unit/game/creatures/skybex.test.ts)

## Local verification

One exact local regression command ran: `npm test -- tests/unit/game/creatures/skybex.test.ts`. Fourteen tests passed; one assertion incorrectly expected no Block when a living Skybex led its own replacement. Corrected the expectation to one and added a separate case with a living inactive guide. The command completed within one second; no second unit command ran under the one-command local policy. The corrected assertion and added case await CI.

The passing cases cover all six passive ranks, incoming Block and Dodge, preview/event parity, save/resume, position swaps, no available partner, repeats through a departed actor, knockout replacement, duplicate guides, Legendary formation changes, enemy base-tier use, temporary-Dodge expiry, draw count, Nature group damage and keyword XP. Existing historical ability and passive oracles exclude Skybex, whose selected kit has direct regression coverage; their recorded expectations remain unchanged.

Subsequent source review retained all living guides present before or after a formation change, including other guides departing for a Legendary, and made auto-play omit a Cloudstep with no available partner. These refinements and the corrected assertions remain in the CI plan. The final lightweight gate covers formatting, syntax lint, source/modifier contracts and documentation; it does not run compilers or deferred suites.

Asset preparation and source validation passed for 208 selections: 204 cache hits and four new lossless images. There are 203 distinct active objects totaling 143.96 MiB within the unchanged 144 MiB limit. All four original PNGs and generated receipts are retained.

## Rendered review

The initial pre-edit capture and first preparation attempt requested the shared host lane and exited busy without launching work. Selected source artwork had already been inspected during design; the existing battle reference supplied the shared composition baseline. Later admitted preparation and focused browser review completed.

Inspected all eight fresh capture frames at 1280×720 / 125% text and 1920×1080 / default text, with reduced motion. All four capture records report completion, no layout failures and no page errors:

- `reports/review/skybex-battle-1a4ef073-c70a-4a71-9659-33d0effae099/`
- `reports/review/skybex-collection-39783972-a546-4797-99e1-6b80b4d2cf43/`
- `reports/review/skybex-rank-five-18e8fc86-d633-4592-8ea5-e9e915057d8a/`
- `reports/review/skybex-incoming-39a15add-893d-4583-bdc9-d535cf02afd2/`

The portrait and three actions preserve their native framing and clear horn silhouettes at gameplay scale. Collection inspection shows the selected illustrations together, readable Mountain Guide wording and the correct one/six Block endpoints with zero/five filled stars. Cloudstep's actual rule tooltip fits at both sizes. Incoming Mossguard visibly receives +1 Block and +20 Dodge, with three remaining Mana. The existing artwork-first hand and tooltip disclosure remain unchanged. Reviewed four additional rule/outcome frames under `reports/skybex-review/`.

The final focused interaction driver passed at both sizes: keyboard activation of Cloudstep, exact incoming/outgoing protection, one Mana payment and Dodge XP, and persistence after reload/Continue. Collection inspection cancellation restored focus without changing the saved revision. An unaffordable Cloudstep remained disabled and keyboard activation preserved the revision. `reports/skybex-review/interactions.json` records completion and no page errors. All task-owned previews and browser contexts closed.

Two earlier driver attempts used incorrect assumptions about hand-card inspection and focus after Escape. Their diagnostic records are retained as `driver-initial-evidence.json` and `driver-tooltip-attempt.json`; the corrected driver exercised the existing tooltip and Collection flows. No product changes were needed for those driver corrections. Artwork selection is user-approved; the captures establish observed rendering, not broader artistic acceptance or measured balance.

## Boundaries

No full suite, compiler, production build, balance sweep, native desktop, Windows package, physical controller, Steam client or Steam Deck verification ran. Hosted CI remains pending. Artwork selection is user-approved; in-game rendering and measured balance are separate outcomes.
