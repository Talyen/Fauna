# Alpenglen implementation evidence

Date: October 25, 2026. Task branch: `task/alpenglen`; retained checkout: `.worktrees/alpenglen`.

[Alpenglen's reference](../content/creatures/alpenglen.md) owns the selected kit, provenance, six tiers, trigger timing, enemy behavior and balance limitations. [Keywords](../KEYWORDS.md#periodic-damage) owns the user-requested global rule: Block absorbs Burn, Poison and Bleed ticks normally. Tick ordering, decay, attribution, protection, control and reaction eligibility retain their existing owners.

## Observed verification

- The exact `tests/unit/game/creatures/alpenglen.test.ts` suite passed its initial 21 regressions in one worker within the 30-second local budget. A subsequent regression for blocked Bleed Leech is authored for CI; the final combined browser flow separately verified that case
- Coverage includes all six passive tiers; another ally's last card; once-only repeat healing; last-card Critical Hits with visible versus buffered cards; draws; rejected commands; fallen, controlled, duplicate and backup sources; Health caps; Food; Camp Hammock; save/resume and preview parity; attack reflection across ticks and saves; enemy base-tier healing and ordinary no-hand behavior; periodic absorption on both sides; all three statuses; sequential ticks and Moss Oven Mitt efficiency
- Four unchanged PNG originals were imported and prepared through the shared lossless recipe; asset preparation verified 238 selections, reusing 234 and encoding four
- Active unique media grew from 164.84 MiB across 229 objects to 168.27 MiB across 233 objects; Alpenglen adds 3.44 MiB. The previous catalog already exceeded the 160 MiB allowance. The total allowance is updated to 176 MiB with measured headroom; the 3 MiB per-image limit, lossless quality and complete compositions remain unchanged

## Rendered review

The pre-edit shared battlefield was captured and inspected at 1280×720 with 125% text and 1920×1080 with default text, using quiet Vite Chromium, reduced motion and isolated contexts. Evidence: `reports/review/alpenglen-before-17024672-1183-44d6-b31a-cbd58c2bd332`. This establishes the existing shared rendering profile; Alpenglen did not exist before the change.

Both final layout captures completed with no browser or layout errors at the same two viewport/text conditions:

- `reports/review/alpenglen-collection-fbfbf174-079c-44a2-9d71-3b97077b20d5`: selected abilities and the base passive in Collection
- `reports/review/alpenglen-battle-7134905e-768b-4462-9b83-d8ed8162b2a7`: portrait and hand in the battlefield

The original and prepared art retain complete compositions, readable silhouettes and consistent golden light. The rules and passive fit at enlarged text without a layout change. The Last Light Charge rule uses the existing Critical Hit keyword color through its explicit phrase alias.

`reports/review/alpenglen-interactions.mjs` and `reports/review/alpenglen-interactions/evidence.json` retain the successful focused browser procedure at 1280×720 and 125% text. Browser clicks played Reversal, Ember and a final Charge; committed storage confirmed reflection, 16 damage, one two-Health heal, repeat consumption and current-format resume. Cancelling targeting preserved the save. A separate turn-boundary state spent five Block against Burn, Poison and Bleed, lost four Health, decayed the statuses normally and retained attack reflection. Five-star Collection inspection showed seven Health; all three ability inspections opened with Enter and returned focus with Escape. Whole-screen action, result and periodic-feedback captures were inspected.

## Combined main review

Current main's ten new Boons and development save format 61 were merged without changing their effects or fixtures. Shared combat edits retain their chain packets and Block-decay Armor rule. Combined asset preparation verified 248 selections with 248 cache hits and no re-encoding. The final inventory is 243 unique objects and 175.47 MiB, within main's existing 176 MiB allowance; the output summary now reports that actual allowance.

`reports/review/alpenglen-interactions-final/evidence.json` records the repeated successful full focused flow on combined code, including a fully absorbed six-damage Bleed tick restoring three Health through deferred Leech, and a zero-Mana Ember refusing activation without changing the save. Keyboard inspection and focus return were repeated with the Critical Hit phrase correctly colored. An earlier combined interaction attempt stopped because Playwright's enabled-state wait treats `aria-disabled` as unavailable; the final unavailable-card check uses an actual pointer click and confirms the visible Not enough Mana result. This was an automation correction, with no product change or longer timeout.

`reports/review/alpenglen-final-28c850be-0690-4c1c-8a22-eec756d8f42f` completed fresh five-star Collection captures at both required viewport/text conditions with no layout or browser errors. Both frames were inspected. The final diff review and lightweight checks passed; protected integration reruns the required local gate on its combined result.

## Evidence boundaries

Source selection and the mechanics were chosen by the user in this chat. Agent rendered inspection establishes only its recorded conditions, without claiming broader artistic approval. Full compilation, broad unit/integration and browser suites, hosted CI, measured balance, native desktop, Windows packaging, physical controllers, Steam client and Steam Deck remain separate gates. No push or publication is authorized.
