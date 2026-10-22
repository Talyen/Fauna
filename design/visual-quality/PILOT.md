# Boon Merchant pilot

## Direction and status

Task: make one representative artwork-and-choice screen clearer and more deliberate while establishing a reusable visual workflow. The player's decision is which single Boon to buy with the current wallet. All three effects, prices, duration and the purchase limit matter before buying.

**Status: both designs rejected; A preferred over B.** On 2026-10-22 the user said: “both look pretty bad, but A is better”. This is a relative preference, not visual approval. The Merchant was initially restored to A; B remains only as a rejected comparison. The later user-directed revision is recorded below. No image in this pilot is promoted to a user-approved design reference.

The pilot failed its aesthetic goal despite passing functional and layout checks. The agent treated visible rules and alignment as evidence of visual improvement without establishing a stronger artistic direction. The user subsequently clarified that B was worse in every way. Do not retain partial praise or infer which individual changes caused that assessment. A future attempt needs a materially different whole-screen direction rather than more incremental styling of B.

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

The same focused browser pass exercised all three shelf/inspection/purchased sizes above, keyboard Enter to buy, focus transfer to Continue, exact Gold deduction, reload without a second deduction/grant, Continue leaving the visit, and Escape/Pause return. The capture script asserted existing layout and hit-area contracts; the images were also opened and visually inspected. No page exceptions were observed in the three normal-flow contexts. This is Chromium browser evidence, not desktop or physical-controller evidence.

## Historical skill exercise and checks

The design pass prioritized the decision and whole-screen composition before button styling. The critique identified hidden comparison rules, three filled actions and reserved name spacing, then incorrectly treated changing them as a convincing direction. The user rejected that result. It retained exact authored wording and inspectability rather than introducing new explanations. [Settings and Battle](BENCHMARK.md) supply transfer examples and future repeated-case tasks; they were inspected, not redesigned or aesthetically approved.

All three skills pass the Skill Creator frontmatter validator. The focused Merchant unit suite passes seven tests, including command identity, exact visible effects, purchase persistence, focus and unavailable rejection. Those B-specific assertions and UI changes have been reverted with the production shelf to A. Task-scoped formatting and the 59-test Node smoke gate pass, as do documentation contracts. The complete diff is reviewed before protected integration.

Full static analysis, the exhaustive viewport/input/state journeys, build, hosted CI, desktop, Windows packaging, physical controller, Steam client and Steam Deck acceptance remain pending. Reduced-motion captures do not establish animation quality or listening/mix approval. No newly generated artwork is claimed. This pilot supplies a negative example, not evidence that the skills improved aesthetic quality. The skills now explicitly distinguish useful information changes from visual improvement and relative preference from approval.

## Restoration verification

After the user's feedback, the Merchant component, layout stylesheet and affected tests were restored byte-for-byte to baseline commit 97465a9. The restored UI was captured again through the real player flow at 1920×1080 with default text and 1280×720 with default/125% text. The focused browser capture passed purchase, save/reload, focus transfer, leaving and unavailable rejection checks; its 125% frame was opened and inspected against A. The seven Merchant unit tests, 59-test smoke gate, task-scoped formatting, updated skill validation and documentation contracts pass. Fresh screenshots and metadata are retained in the task's ignored reports/visual-quality/restored-a artifacts. This verifies restoration, not aesthetic acceptance. Broader CI and platform gates remain pending.

## Instruction audit and subsequent user direction

The design skill asked what “must be visible”, conflating needed information with permanent text. The critique listed equal emphasis as a possible interaction defect; I applied that to three equivalent purchase choices. The benchmark asked for easier comparison and restrained controls, then rewarded visible rules and quieter buttons. The reference pack also described A's equal gold actions and hover-only rules as defects without user evidence. These instructions and judgments made the review circular: B followed the proposed changes, so I described those changes as improvements.

Those assumptions are removed. The skills now preserve disclosure layers, distinguish equivalent choices from competing action roles, and reject claims that spacing, alignment, visible information or button de-emphasis inherently improve aesthetics. The benchmark no longer scores the actions used to build B. Passing checks remains functional evidence only.

The user then specified a new Merchant composition: no names below shelf artwork; names/rules remain in hover/focus details; Gold and Limit 1 share a line on opposite sides; purchase controls use the shared secondary style; Gold icons are gold-colored. This is explicit direction for this screen, not retroactive approval of B. The user also identified the pale-on-gold purchase text: a feature stylesheet overrode the primary foreground, while the existing contrast test only checked token definitions. Remove that override, enforce the primary foreground in the shared skin, and check computed control colors in browser evidence.

## Earlier requested composition and verification

The subsequent explicit choices are implemented in the [current 720p frame](references/merchant-current-1280.png): labels only in artwork inspection, Gold and Limit 1 on opposite sides of one row, secondary purchase Buttons, and shared gold-colored Lucide Coins for Gold. The shared skin owns primary text color; screen price controls no longer override their foreground. Gold readouts in battle earnings and journey results use the same semantic icon class.

The instruction audit above removes the assumptions that drove B, rather than retaining them with a warning. The source-policy regression rejects explicit primary-foreground overrides even with valid palette tokens. The browser helper checks actual computed foregrounds against their intended semantic role and actual fill contrast at 4.5:1 or greater. It runs on the main Continue CTA and Merchant purchase controls; the focused capture also checks purchase hover. This covers the cascade gap missed by the earlier token-only test.

The focused 17-test Merchant/design-system suites pass. The real-flow capture passes at 1920×1080 default text and 1280×720 default/125% text, including tooltips, keyboard purchase, focus, exact spending, reload, leaving and unavailable rejection. The default and enlarged 720p shelf and enlarged inspection images were opened and inspected. See [current source/image hashes and evidence](references/current-evidence.json). Full static/build/CI and native/controller/Steam verification remain pending; this is not a claim of aesthetic acceptance.

## Header and price follow-up

The latest requested layout moves Gold into the header beside the menu while keeping the title centered. The shelf policy is centered above the Boons and reads “Limit 1 per customer - No Refunds!” in italics. The shared heading now accepts a trailing readout, preserving its existing Back/Deck/menu actions. Inter's real italic face is loaded; synthetic font styles remain disabled. Names remain in hover/focus inspection and purchase controls remain secondary.

Each stock slot now consumes one seeded price roll for an inclusive integer base price of 20–40 Gold. Merchant's Favor still subtracts 7 when preparing stock, yielding 13–33 Gold. Saved prices survive inspection, menus, Campfire and reload, and purchasing Favor does not retroactively discount the current shelf. Save validation uses the same price-range owner as preparation. The existing save shape and version are unchanged; no migrations or compatibility branches were added. Additional seeded draws intentionally change later seeded outcomes, so the three journey replay snapshots were refreshed after their lifecycle, rejection/RNG and save invariants passed.

The current 720p default/enlarged frames were opened and inspected. The seed-7 visual fixture is funded to 40 Gold so every offer is reachable through the real visit flow; this is test setup, not a gameplay grant. It rolls 26, 30 and 34 Gold. The focused browser pass covers default 1920×1080 and default/125% text at 1280×720, including tooltips, contrast, keyboard purchase, spending, reload, focus, leaving and unavailable rejection. The 91 focused game/save/UI/journey tests pass, including all 21 possible prices with and without Favor, deterministic preparation, affordability at the cheapest saved price and save-boundary rejection. Full CI/build/native/controller/Steam checks remain pending. [Current evidence](references/current-evidence.json) records source and image hashes.
