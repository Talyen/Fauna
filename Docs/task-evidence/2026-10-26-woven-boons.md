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

Rendered review is pending. The task-owned driver is
`reports/woven-boons-review.mjs`; it covers baseline comparisons, all portraits
and rules at 1280 by 720 with 125% text and 1920 by 1080 with default text, keyboard
paging and focus return, group Food against the production dispatcher, ordinary
targeting cancellation, reward selection and reload. Its host admission returned
busy with both shared slots occupied; no preview or browser process started.
The branch and checkout are retained. Integration requires inspected rendered
evidence under the [UI review procedure](../UI.md#required-review).
