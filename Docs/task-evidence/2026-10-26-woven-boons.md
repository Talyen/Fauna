# Ten woven artifact Boons

Implements the approved Hoard Lockplate, Rootvault Pole, Star Hoop, Pattern Reel,
Prayer Sailboat, Pumpkin Tureen, Field Lunch Basket, Winnowing Sieve, Blooming Still
and Yarrow Salve Tin designs. Exact copy and values live in the
[Boon rules](../../src/game/rules/boons.ts); the
[execution contracts](../content/boons.md#woven-artifact-boons) describe interactions.

The default damage order remains Block, Armor, then Health. Hoard Lockplate changes
that order only for allies and only where Armor normally applies. Rootvault Pole
permits ordinary Dodge against all three Thorns types while preserving the
no-retaliation-chain rule. Pattern Reel propagates exact removed categories;
Winnowing Sieve carries unused removal without charging for Pearl Sieve's free
Block removal. Star Hoop supports both charged Reflect and innate reflection.

Pumpkin Tureen uses automatic group Food targeting, with matching descriptions,
previews and Auto-play queries. Food still consumes once, repeated Food draws only
once with Field Lunch Basket, and Mana Berries remain a shared resource. Actual
healing and Poison removal trigger Yarrow and Blooming Still respectively.
No new controls, saved counters, migrations or dependencies are introduced.

## Artwork

All ten selected Google Drive PNG originals are retained unchanged in
`public/art/boons/`. The manifest records each original filename and Drive link.
The existing uncropped lossless card recipe prepares 720 by 960 portraits.
Preparation verified 302 selections, reusing 292 and encoding ten. New prepared
media adds 7.11 MiB, bringing active media to 297 unique objects and 215.00 MiB.
The total allowance moves from 208 to 216 MiB; resolution, quality and the
3 MiB per-image ceiling remain unchanged.

The user's October 26 approval covers the selected artifacts and final effects.
This is distinct from agent inspection of their in-game rendering.

## Verification and remaining evidence

`npm test -- tests/unit/game/woven-boons.test.ts` passed all 34 cases in 13.86
seconds, with one worker and the normal 30-second deadline. Coverage includes
default and modified mitigation, typed Thorns and control, reflection charges,
matching and surplus Purge, typed wards, controlled swaps, accepted and rejected
Food commands, preview immutability, current-format resume, Minions, backup
healing, repeats, full and partial Poison Cleanse, deferred Bleed Leech and bounded
healing/Mana/Cleanse reactions. The initial four failures were fixture assumptions:
an enemy Armor-break reaction and assertions for a nonexistent draw event.

The changed-file lightweight gate passed formatting, syntax lint, modifier
ownership and documentation checks. Full compilation, broader tests, balance,
hosted CI, native desktop, Windows packaging, physical controllers, Steam client
and Steam Deck remain unrun.

## Completed rendered review

The completed task-owned Vite browser review is retained under
`reports/woven-boons-rendered/`, driven by `reports/woven-boons-review.mjs` and
`reports/woven-boons-denial-review.mjs`. Its render-input identity is
`6fa8dbbbf71e5bdb4757089314b6dedac7a52f942be782b87aa73668aa4187ad`.
The primary record contains 28 whole-screen frames and eight interaction records;
the additional record captures unavailable Food and computed keyword colors.
No page errors or layout violations occurred. All owned browser and preview
processes closed before integration.

Conditions were 1280 by 720 with 125% text and 1920 by 1080 with default text,
using reduced motion. The unchanged battle baseline is pixel-identical at both
sizes. Inspected all ten portraits and rules for framing, reading order, wrapping,
contrast and consistent visual weight. Keyboard paging, return to the Pause
opener and then battle, read-only navigation, group Food effects and draws,
ordinary Food targeting cancellation, keyboard reward selection and reload
matched their production contracts. Health and Block feedback appears on every
recipient, and attempted Food at zero Mana remains unavailable without committing
state. No player-facing defect required a production change in this review.

The shared keyword palette intentionally retains Alchemy's darker Poison and
Bleed colors, as required by the UI contract. Their measured dialog contrast is
3.81:1 and 3.96:1 respectively; the other inspected keyword colors exceed 4.5:1.
This records the existing palette decision rather than claiming universal 4.5:1
contrast. The illustrations and layout were reviewed by the agent; the user's
approval remains scoped to the selected artifacts and effects.

Earlier attempts are retained separately. The primary driver was corrected to
expect Boons inspection to return to Pause before battle and to identify the
reward fixture as a Boon screen. The additional driver was aligned with the
existing documented exceptions for canonical darker keyword colors. These were
review-driver assumptions, not changes to gameplay or visual styling.

Current main's catalog helper and inferred combat-operation types were preserved
when merging into the task branch. All 34 focused regressions passed again on
that combined result in 4.13 seconds. The protected local completion gate owns
final integration; full CI and the unrun platform boundaries above remain
separate evidence. The completion tool preserves ignored reports before retiring
this task checkout.
