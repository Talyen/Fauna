# Pyrella implementation and rendered review

Date: 2026-10-25. Task branch: `task/pyrella`; retained checkout: `.worktrees/pyrella`.

## Selected behavior

The user selected Passing Flame, Festival Burst, Ember Harvest and Spark Decoy from the inspected Drive artwork. [Pyrella's reference](../content/creatures/pyrella.md) owns provenance, exact rule scope, tier values, integer splitting, upgrades and balance limitations. The portrait and three original ability PNGs are preserved; the shared lossless recipe prepares their complete compositions.

Passing Flame triggers for the credited, living, deployed Pyrella. It divides the rounded transfer pool equally among the defeated creature's surviving deployed allies, including Minions; whole-stack remainders follow battlefield order. The six total percentages are 20, 35, 50, 65, 80 and 100. The final tier omits the percentage as requested. Fire Thorns is separate from Nature and Water Thorns and retaliates with Burn damage and buildup, including through Negate.

## Checks observed

- The exact `tests/unit/game/creatures/pyrella.test.ts` suite passed all 18 regressions with one worker under the 30-second local budget, including after combining current main's Dulcera, Parhelion, Boon and shared enemy-policy changes
- Coverage includes all tiers, conservation/remainders, credited and periodic defeats, inactive/dead sources, enemy base-tier use, Death's Door, Nullify, stack caps, preview parity, Mana refund before automatic end turn, Burn draw and no-draw behavior, rejected commands, Fire Thorns through Block and Negate, non-recursive retaliation, sharing, Purge, swap/resume and invalid current-format saves and shared enemy valuation of Fire Thorns
- Initial asset preparation encoded four new selections and reused the existing cache; the combined Dulcera generation verified 216 selections, then the combined Boon generation verified 226 selections with no re-encoding; the final combined generation verified 230 selections, all cache hits
- The initial changed-file gate passed formatting, syntax lint, source contracts and documentation checks; protected integration reruns the required gate on the combined result
- Existing recorded behavior snapshots and hashes were preserved; dormant Fire Thorns is omitted only when zero by the baseline serializers, while Pyrella has direct behavior coverage

Current main independently added a saved Encore progress field using development format 59. The combined task requires both that field and Fire Thorns under format 60. The two recorded application fixtures retain their gameplay state and now include both fields and the current envelope; obsolete formats are rejected without migrations.

## Rendered evidence inspected

All standard captures used a quiet Vite Chromium preview, reduced motion, isolated contexts, 1280×720 at 125% text and 1920×1080 at default text. Captures completed without browser or layout errors. Evidence is retained under ignored `reports/review/` in the task checkout:

- `pyrella-before-9386fb2e-4f72-4044-8ce3-3052efee54f7`: pre-edit shared battlefield and ArtCard composition
- `pyrella-collection-119283d3-00ff-4b45-b75e-b41f46982102`: the three selected ability illustrations and base passive in Collection inspection
- `pyrella-battle-1fc47a23-bfd3-4fe5-9c06-b125dedb03b2`: portrait and hand composition
- `pyrella-decoy-7f72b877-4baf-4299-acd6-abcb30d89376`: committed Fire Thorns and Negate icons
- `pyrella-rank-five-b81b596b-084d-47ba-8b27-76080c70de33`: five-star display and percentage-free passive wording
- `pyrella-combined-rank-five-749e9246-9acf-406d-a1cb-9aad20867d13`: repeat of both required viewport conditions after incorporating Dulcera and worktree storage changes

The source and prepared images retain their silhouettes, warm light and complete compositions. Portrait and action framing use the existing shared profiles without layout changes. Ability art remains distinct in the hand and inspection; rules and current passive fit at enlarged text. The initial baseline uses an existing creature lineup because Pyrella did not exist before this task; it establishes the shared rendering profile rather than a same-creature before/after comparison.

- `pyrella-final-rank-five-a56bace0-c4b7-4d06-966f-2f93bcca3814`: both required viewport conditions after the Boon merge and development format 60

## Interactions exercised

`reports/review/pyrella-interactions.mjs` and `reports/review/pyrella-interactions/evidence.json` retain the focused interaction procedure and successful readback. At 1280×720 and 125% text, browser clicks played Ember Harvest, Spark Decoy and Festival Burst through the actual hand. Committed storage confirmed the refund, same-turn continuation, Fire Thorns, Negate and opposing Burn. Reload and Continue retained both protections.

A separate fresh context defeated an enemy already carrying 20 Burn through Festival Burst and confirmed spread to both survivors. Five-star Collection inspection showed the exact final-tier wording. Enter opened Spark Decoy inspection; Escape returned focus to the ability thumbnail and then to the Collection opener. Whole-screen captures include `decoy-status.png`, `festival-burst.png`, `passing-flame.png` and `spark-decoy-inspection.png`; each was inspected for artwork, readable rules and visible outcomes.

## Evidence boundaries

The user's 2026-10-25 choice establishes the selected source artwork and mechanics. Agent rendered inspection establishes the conditions above, without claiming broader artistic approval. Pure focused regressions, browser interactions, static gates and asset validation are separate evidence. Complete compilation, broad unit/integration suites, hosted CI, measured balance, native desktop, Windows packaging, physical controllers, Steam client and Steam Deck were not run by this task. No push or publication is authorized or performed.

The final shared enemy-policy merge registers Fire Thorns as a beneficial stack and has a direct value/RNG-preservation regression. The focused browser interaction procedure was repeated successfully on the combined gameplay code. The latest Collection capture retains its recorded pre-Parhelion source identity; Parhelion adds catalog content without changing Pyrella artwork geometry or rules.
