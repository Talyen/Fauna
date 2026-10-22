# Boon Merchant pilot

## Direction and status

Task: make one representative artwork-and-choice screen clearer and more deliberate while establishing a reusable visual workflow. The player's decision is which single Boon to buy with the current wallet. All three effects, prices, duration and the purchase limit matter before buying.

**Status: both designs rejected; A preferred over B.** On 2026-10-22 the user said: “both look pretty bad, but A is better”. This is a relative preference, not visual approval. The production Merchant is restored to A; B remains only as a rejected comparison. No image in this pilot is promoted to a user-approved design reference.

The pilot failed its aesthetic goal despite passing functional and layout checks. The agent treated visible rules and alignment as evidence of visual improvement without establishing a stronger artistic direction. B's additional persistent prose and wider spread are hypotheses for why it failed, not reasons supplied by the user. A future attempt needs a materially different whole-screen direction rather than more incremental styling of B.

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
