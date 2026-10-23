# Boon Merchant pilot

## Evidence scope

All observations below concern their recorded rollout snapshots. Checks were task-scoped: full static analysis, build, exhaustive viewport/input/state journeys, hosted CI, native desktop, Windows packaging, physical controllers, live Steam and Steam Deck remained unverified throughout this pilot. Reduced-motion frames do not qualify animation or listening/mix quality. No new artwork generation is claimed. Each stage below retains its source identity, focused checks, observed interactions and evidence paths; none establishes aesthetic approval.

## Direction and status

The task was to clarify a representative Boon purchase screen and establish a reusable visual workflow. Comparing the three effects, prices, journey duration and purchase limit was the player's decision.

On October 22, 2026, the user said “both look pretty bad, but A is better”, then clarified that B was worse in every way. **Both designs were rejected; preference for A was not approval.** A was restored. Later explicit changes below do not retroactively approve B or establish an approved whole-screen reference.

Functional/layout checks passed, but the aesthetic goal failed. Visible rules and alignment did not establish stronger art direction; the feedback does not justify retaining partial praise or inferring which individual changes caused rejection. Future attempts should explore a materially different whole-screen direction instead of incremental styling of B.

## Rejected B experiment

- Keep the existing Boon artwork, shared size profiles, palette and standard controls
- Replace the three filled gold purchase buttons with outlined Gold actions; reserve the filled action for Continue after purchase
- Expose each exact Boon effect below its name, so comparing three offers does not require three hovers; purchase controls also describe their rule to assistive technology
- Align artwork, names, rules and purchase actions with shared grid rows instead of arbitrary two-line name reserves
- Combine the separate wallet/limit rows into compact context: one purchase and journey duration on the left, wallet on the right
- Keep the Merchant heading stable after purchase; the purchased artwork and name convey the outcome without “Boon received” narration

B exposed more gameplay-rule text while removing some context/success treatment. That information tradeoff did not establish aesthetic improvement and the user preferred A. No gameplay prices, grants, RNG, saves or artwork files were changed.

## Historical rendered review of B

Baseline source: committed main `97465a9b224a366afdcb854db9deb7e64acc6501`. Candidate source hashes, image hashes and capture conditions are in the [evidence manifest](references/evidence.json). The frames were captured from the actual application through Continue → encounter → Merchant, using fresh disposable browser contexts and the same seed-7 saved offers: Lucky Clover, Grove's Favor and Brass Censer, with 20 Gold. Both sides use reduced motion, pointer resting state, identical artwork generation, viewport and text preference. The capture script does not alter gameplay source or reuse a player's profile.

| State            | Conditions                  | Evidence and observation                                                                                                                                                                 |
| ---------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shelf            | 1920×1080, 100% text        | [A](references/merchant-before-1920.png), [B](references/merchant-candidate-1920.png); bounded centered group, dominant images, directly comparable effects and aligned purchases        |
| Shelf            | 1280×720, 100% text         | [A](references/merchant-before-1280.png), [B](references/merchant-candidate-1280.png); original art ratios and shared 80% artwork profile retained                                       |
| Shelf            | 1280×720, 125% text         | [A](references/merchant-before-1280-large.png), [B](references/merchant-candidate-1280-large.png); full effects wrap without clipping or scrolling; price row and Leave remain reachable |
| Hover inspection | 1280×720, 125% text         | [B](references/merchant-inspection-large.png); tooltip remains outside the artwork with full rules and duration, without covering the purchase row                                       |
| Unavailable      | 1280×720, 125% text, 0 Gold | [B](references/merchant-unavailable-large.png); specific reasons remain visible, purchases stay focusable and reject Enter without changing saved state; Back leaves the visit           |
| Purchased        | 1280×720, 125% text         | [B](references/merchant-purchased-large.png); one Boon, exact rules, journey duration and Continue remain visible                                                                        |

The same focused browser pass exercised all three shelf/inspection/purchased sizes above, keyboard Enter to buy, focus transfer to Continue, exact Gold deduction, reload without a second deduction/grant, Continue leaving the visit, and Escape/Pause return. The capture script asserted existing layout and hit-area contracts; the images were also opened and visually inspected. No page exceptions were observed in the three normal-flow contexts.

## Historical skill exercise and checks

The critique treated hidden rules, equally prominent gold actions and reserved name spacing as defects, then treated its own changes as improvement. The rejected result retained exact authored rules and inspectability. [Settings and Battle](BENCHMARK.md) were inspected as transfer examples, without redesign or aesthetic approval; their implementation comparisons remain future benchmark work.

| Attempt     | Recorded checks and evidence                                                                                                                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B           | Three skills passed frontmatter validation; seven Merchant unit tests covered commands, exact effects, persistence, focus and unavailable rejection; formatting, documentation contracts and 59 Node smoke tests passed; diff review was required before protected integration |
| Restoration | Component, stylesheet and affected tests restored byte-for-byte to `97465a9`; B-specific assertions reverted; seven unit tests, 59 smoke tests, formatting, skill validation and documentation contracts passed                                                                |

## Restoration verification

Restored A was captured through the real flow at 1920×1080 default text and 1280×720 default/125% text. Browser checks covered purchase, reload, exact spending/grants, focus, leaving and unavailable rejection. The enlarged frame was inspected against A. Evidence remains in the task's ignored `reports/visual-quality/restored-a` artifacts. This establishes restoration only.

## Instruction audit and subsequent user direction

The instructions made the review circular: “must be visible” became permanent text, equal emphasis became a defect for equivalent choices, and the benchmark rewarded exposed rules and quieter buttons. The reference pack repeated those unsupported judgments about A.

Those assumptions were removed from the skills and benchmark. Needed information may remain in inspection; equivalent choices may share emphasis. Spacing, alignment, visible rules and button de-emphasis alone do not establish aesthetic improvement. The failed pilot is a negative example, not evidence that the skills improved quality.

The user's next direction was specific: names/rules in hover/focus details, no shelf names, Gold and Limit 1 on opposite sides of one line, secondary purchase controls and gold-colored Coins icons. They also identified pale text on gold caused by a feature foreground override. The prior test checked token definitions and missed the rendered cascade.

## Earlier requested composition and verification

The requested one-line wallet/limit arrangement was implemented before the header follow-up below. The shared skin took ownership of primary foregrounds; price controls stopped overriding them, and earnings/results reused the Gold icon class. A source regression rejects primary-foreground overrides, even with valid palette tokens. Browser checks inspect computed role colors and actual fill contrast at 4.5:1 or greater on Main Continue and Merchant purchases, including purchase hover.

Seventeen Merchant/design-system tests passed. Real-flow captures at 1920×1080 default text and 1280×720 default/125% text exercised tooltips, keyboard purchase, focus, exact spending, reload, leaving and unavailable rejection. Both 720p shelves and enlarged inspection were opened and inspected. [Current source/image evidence](references/current-evidence.json) and the [720p frame](references/merchant-current-1280.png) now reflect the later combined-main revision, not an immutable capture of this earlier layout.

## Header and price follow-up

The subsequent requested layout moved Gold into the header beside the menu while keeping the title centered. The shelf policy is centered above the Boons and reads “Limit 1 per customer - No Refunds!” in italics. The shared heading accepts a trailing readout, preserving its existing Back/Deck/menu actions. Inter's real italic face is loaded; synthetic font styles remain disabled. Names remain in hover/focus inspection and purchase controls remain secondary.

Each stock slot consumes one seeded price roll for an inclusive integer base price of 20–40 Gold. Merchant's Favor still subtracts 7 when preparing stock, yielding 13–33 Gold. Saved prices survive inspection, menus, Campfire and reload, and purchasing Favor does not retroactively discount the current shelf. Save validation uses the same price-range owner as preparation. The existing save shape and version are unchanged; no migrations or compatibility branches were added. Additional seeded draws intentionally change later seeded outcomes, so the three journey replay snapshots were refreshed after their lifecycle, rejection/RNG and save invariants passed.

The current 720p default/enlarged frames were opened and inspected. The seed-7 visual fixture is funded to 40 Gold so every offer is reachable through the real visit flow; this is test setup, not a gameplay grant. It rolls 26, 30 and 34 Gold. The focused browser pass covers default 1920×1080 and default/125% text at 1280×720, including tooltips, contrast, keyboard purchase, spending, reload, focus, leaving and unavailable rejection. The 91 focused game/save/UI/journey tests pass, including all 21 possible prices with and without Favor, deterministic preparation, affordability at the cheapest saved price and save-boundary rejection. [Current evidence](references/current-evidence.json) records source and image hashes.

Combined-main verification: the Rookhaven catalog/save-format update arrived during integration. Its changed random consumption invalidated the old seed-7 Merchant setup and journey replay traces. The Merchant fixture now fixes its preparation RNG to 10, independently of recruit-catalog size, and remains funded to 40 Gold. It produces prices of 29, 23 and 22 Gold. The UI/Deck fixture uses this same scenario. Current source/image hashes and frames above were refreshed against the combined game (save format 46).

The existing full-journey fixture seed 98 no longer won within the unchanged 400-command browser budget. A deterministic fixture search found seed 663 reaches victory in 384 commands with three deployed creatures and five collected creatures. The shared unit/browser seed is updated without increasing the budget, skipping battles or changing gameplay/AI. All 91 focused game/save/UI/journey tests pass on the combined game, including the refreshed seeded lifecycle traces and current-format round trips.
