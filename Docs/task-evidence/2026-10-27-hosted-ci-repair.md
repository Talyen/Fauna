# Hosted verification repair evidence

The October 27 hosted run for `7e64f159` exposed stale journey and combat
oracles after the Boon catalog expansion and localization-event metadata. The
original [journey recording](../../tests/unit/game/fixtures/journey-baseline-pre-expansion.tsv)
remains unchanged; the [current recording](../../tests/unit/game/fixtures/journey-baseline.tsv)
keeps exact commands, acceptance, phases and state/event hashes. It is not a
claim of player balance or full gameplay equivalence.

For seeds 3, 10 and 98, the original journey regression passed against a source
snapshot of its recorded owner `de23336c`. After excluding only the later
`useAbility` localization metadata and inactive Oasis Seed state for comparison,
the first substantive state divergence was Merchant stock and RNG for seeds 3
and 10, and the Boon reward and RNG for seed 98. Those changes follow the
expanded authored Boon pool; later commands and outcomes also differ. The old
and current state captures and two identical current recordings are retained in
the task evidence archive. The current regression still checks rejected command
identity/RNG, each save round trip, preview output, completed victory and exact
trace. The combat oracle instead retains its original hashes and normalizes the
new inactive field and additive localization metadata; all 18 focused cases
passed locally.

The all-Boon Aerostat Auto-play ranking changed because Crown Waffle Iron makes
Trail Bread heal after Block. Excluding only that Boon restored the prior
ranking and score. The new all-Boon expectation retains the changed order and
score. The full hosted run, browser and Windows results must be reported
separately for the exact revision.
