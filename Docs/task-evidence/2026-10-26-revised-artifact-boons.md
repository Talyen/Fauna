# Ten approved artifact Boons

Implemented the October 26 approved designs for Comb Uncapping Fork, Fern Fencing
Foil, Resonance Kalimba, Miracle Megaphone, Blossom Cake Stand, Accordioned Bridge,
Last Candle, Hearth Coal, Crescent Sextant and Reef Casket. The final revisions
retain one enemy Burn stack through decay and preserve allied Nullify while Block
remains. Their exact player rules live in the
[Boon rules](../../src/game/rules/boons.ts), with execution details in the
[current Boon contracts](../content/boons.md#revised-artifact-boons).

All ten enter the existing unowned Merchant and Boss reward pools, owned-Boon
inspection, keyword highlighting and committed combat feedback. They introduce
no activation controls, saved fields or counters; current-format ownership,
previews and resume use the existing owners.

Auto-end turn now waits at zero Mana while a legal free play remains. This keeps
Blossom Cake Stand's Food available and also preserves existing free-card grants.
The manual End turn action remains available. Shared card admission permits swap
cards through Stun and Freeze, including borrowed cards, while control still
expires normally and continues to suppress Dodge.

## Artwork

The ten inspected Drive PNG originals are preserved unchanged under
`public/art/boons/`. The [manifest](../../assets/manifest.json) retains each
selected filename, Drive link and rights note; preparation receipts retain source
and output hashes. The existing uncropped, lossless card recipe prepares the
portraits at 720 by 960 pixels.

Preparation verified 292 selections, reused 282 cached selections and encoded ten
additions. The additions total 6.88 MiB; active media totals 287 unique objects and
207.89 MiB. The existing 208 MiB total and 3 MiB per-artwork limits remain intact.

## Verification

`npm test -- tests/unit/game/revised-artifact-boons.test.ts` passed all 37 cases
with one worker inside the 30-second focused limit. These cover all three Thorns
pools, Briar Racquet, ordinary enemy retaliation, Blind misses and Purge rewards,
control buildup without extra damage, immunity and Nullify, selective and group
Cleanse, partial Poison removal, free Food and ordinary consumption, controlled
and borrowed swaps, automatic turn admission, Burn floors and attribution,
current-Health control thresholds and returned control, allied Minions,
Coronation Cloche, rejected commands, immutable previews and current-format resume.

The first test attempt exposed invalid test enemy maxima, stable card-ID mistakes
and omitted fixture card zones; those fixtures were corrected. Final review also
preserved returned control's existing base strength when Sextant is absent.
No focused run timed out, widened its selector or raised its budget.

Current main's modifier-authoring refactor was incorporated before the final
focused run. The task uses its string implementation references, passive queries
and Talent chance owner. The lightweight gate passed formatting, syntax lint,
modifier/source ownership contracts and documentation checks. Main's subsequent
browser-test consolidation was incorporated without changing production behavior.

The completed focused browser record is retained in
`reports/revised-boons-rendered/`, driven by
`reports/revised-boons-review.mjs`. Render-input identity:
`f739a4e7d48e841769c213b15904d7f01d5d92680fe510ad9fe81e1c18f34c29`.
It contains 22 whole-screen frames and ten interaction records, with no layout
failures or page errors. Conditions are 1280 by 720 with 125% text and 1920 by
1080 with default text, both with reduced motion. The unchanged baseline is
pixel-identical at both sizes.

Reviewed every portrait and rule in owned-Boon inspection, keyword colors,
framing, contrast, pagination, keyboard focus and reward layout. Keyboard paging
and Escape preserve the gameplay revision and return to connected focus.
Controlled-card denial and a keyboard swap match the production dispatcher,
retaining Freeze on the departing backup. Free Food targeting, Escape
cancellation, focus return, consumption and two accepted plays match the
dispatcher and survive reload. Keyboard selection of Reef Casket from the reward
screen also survives reload.

Earlier capture attempts remain under `reports/revised-boons-rendered-attempt1/`
through `reports/revised-boons-rendered-attempt4/`. They diagnose driver handling
of an unavailable control, startup timing, a reward fixture opened as a battle,
and preview environment mutation in the fingerprint calculation. The completed
capture freezes its initial environment and base for both identity checks. These
attempts are retained separately from the accepted evidence. The user's October
26 approval covers the designs and selected artifacts; the in-game composition
review described here was performed by the agent.

Evidence boundaries: task-owned Vite browser inspection with keyboard and mouse.
Full compilation, broad unit/browser suites, hosted CI, balance sweeps, native
desktop, Windows packaging, physical controllers, Steam client and Steam Deck
have not been run for this task. No push or publication is authorized.
