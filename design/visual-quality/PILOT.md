# Boon Merchant pilot

## Direction and status

Task: make one representative artwork-and-choice screen clearer and more deliberate while establishing a reusable visual workflow. The player's decision is which single Boon to buy with the current wallet. All three effects, prices, duration and the purchase limit matter before buying.

**Status: rendered agent review complete; user preference pending.** B is an implemented candidate, not a newly approved house style. Compare [A/B](comparison.html) before reading the rationale if judging taste. Record the user's selected image, date and scope in the [reference pack](README.md) after they choose. There is no preference vote yet.

## Changes

- Keep the existing Boon artwork, shared size profiles, palette and standard controls
- Replace the three filled gold purchase buttons with outlined Gold actions; reserve the filled action for Continue after purchase
- Expose each exact Boon effect below its name, so comparing three offers does not require three hovers; purchase controls also describe their rule to assistive technology
- Align artwork, names, rules and purchase actions with shared grid rows instead of arbitrary two-line name reserves
- Combine the separate wallet/limit rows into compact context: one purchase and journey duration on the left, wallet on the right
- Keep the Merchant heading stable after purchase; the purchased artwork and name convey the outcome without “Boon received” narration

The candidate deliberately shows more gameplay-rule text, while removing redundant context/success treatment. A lower total word count would be a misleading target here. No gameplay prices, grants, RNG, saves or artwork files were changed.

## Rendered review

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

## Skill exercise and checks

The design pass prioritized the decision and whole-screen composition before button styling. The critique identified hidden comparison rules, three competing filled actions and arbitrary name spacing; the candidate addresses those findings. It retained exact authored wording and inspectability rather than introducing new explanations. [Settings and Battle](BENCHMARK.md) supply transfer examples and future repeated-case tasks; they were inspected, not redesigned or aesthetically approved.

All three skills pass the Skill Creator frontmatter validator. The focused Merchant unit suite passes seven tests, including command identity, exact visible effects, purchase persistence, focus and unavailable rejection. The existing CI Merchant journey now checks the rule descriptions on purchase controls and the revised headings/context. Task-scoped formatting and the 59-test Node smoke gate pass, as do documentation contracts. The complete diff is reviewed before protected integration.

Full static analysis, the exhaustive viewport/input/state journeys, build, hosted CI, desktop, Windows packaging, physical controller, Steam client and Steam Deck acceptance remain pending. Reduced-motion captures do not establish animation quality or listening/mix approval. No newly generated artwork is claimed. This pilot establishes reviewable evidence; sustained artistic improvement still depends on actual preference decisions and repeated benchmark cases.
