# Journey balance: first pass

October 22, 2026. This pass improves the first solo draft and establishes a reproducible balance baseline. It does **not** qualify the complete journey as balanced. The [roadmap](ROADMAP.md#next-finish-and-validate-the-current-experience) keeps that work open; [journey rules](EXPEDITION_DESIGN.md) remain the canonical gameplay contract.

## Goals and method

Working goals for this pass: early fights should teach the starter without requiring a rare teammate or Boon; recruitment should open useful combinations; bosses should test those combinations; recovery and purchases should change meaningful decisions. Treat an opening averaging over ten turns and the existing 120-turn career warning as investigation triggers, not accepted human difficulty or duration targets. No target human win rate or journey duration in minutes was established.

Baseline source commit: `1a19fe1c5a7084b5b5e0f810b13d02d44ad30522`. Retained [structured evidence](../design/journey-balance/evidence.json) records gameplay/application fingerprints, scenarios, outcomes and fixture grants. Full command journals, checkpoints, investigation scripts and rendered captures live under the task's ignored reports and are preserved by worktree integration archiving.

- **Openings:** every eligible starter against each of the 23 distinct species that can lead an ordinary pack, using seeds 0, 1 and 2. These fixtures explicitly select the starter and pack, use production commands and Auto-play, and stop after 40 turns or 1,000 actions. This weights enemy species equally; production packs have different weights. No talents, Boons or earned ranks are granted.
- **Careers:** three naturally offered starts per species, selecting the first qualifying seeds from 10 upward. Production application commands, serialized saves, periodic resume, a 100-turn battle budget and 5,000-action career budget are retained. The baseline covers 19 starters in 57 cases; the curated pool covers 14 in 42 cases. These use different starting checkpoints and are not a paired treatment estimate.
- **Progression:** four explicit teams, seeds 21, 42 and 63, and encounters 1, 4 and 8. Each source version has 360 battle fixtures separating all six passive ranks, first-row talents, all talents and combined progression. Equal large XP budgets are explicit fixture grants, not earned progression. Loadouts are applied before battle start so opening effects resolve normally.
- **Boons:** each of the 18 Boons and a no-Boon control across three seeds, using the mixed team's first boss battle. This is 57 battle fixtures per source version, not coverage of every Boon interaction or team.

The offensive team is Emberback/Prismram/Dunefox; defensive is Mossguard/Reedstag/Coralcurl; mixed is Captoad/Pollenmoth/Ringpalm; Legendary is Memento alone. Controlled battle fixtures validate current saves at entry and exit. Career runs additionally exercise application save ordering and periodic resume.

## Changes kept

### Curate the first solo draft

Having an attack did not establish an appropriate solo opening. The five removed first-draft options showed the following baseline results across 69 controlled matchups each:

| Creature   | Mean observed turns, capped at 40 | Victories | Defeats | Incomplete |
| ---------- | --------------------------------: | --------: | ------: | ---------: |
| Rookhaven  |                              16.3 |        52 |      14 |          3 |
| Mossguard  |                              27.8 |        39 |       5 |         25 |
| Pollenmoth |                              17.5 |        58 |       4 |          7 |
| Dawncall   |                              14.0 |        65 |       3 |          1 |
| Shadebrim  |                               9.9 |        62 |       7 |          0 |

These kits retain their authored effects, all recruitment paths and later collected drafts. They contribute to teams without needing solo damage increases that would also strengthen enemies and full formations. Shadebrim's observed losses and dependence on slow damage, rather than a rounded ten-turn threshold alone, support its exclusion.

The curated fourteen-species pool produced **965 victories, one defeat and no incomplete fights in 966 opening fixtures**. Mean observed turns by starter range from 2.1 to 7.1. The single defeat was Sternshell against Captoad at seed 2. This is bounded automated evidence, not a promise that every opening seed terminates quickly or a human success-rate estimate.

The starter pool changes seeded offers. Development save format advances from 48 to 49 rather than migrating obsolete drafts. Recruitment, later drafts, save round trips and previous-format rejection have focused coverage.

### Record the actual starter

The old five-preference benchmark produced 50 scenarios but only 15 distinct seed/actual-starter opening combinations. A missing preferred creature causes a fallback pick; it cannot be attributed to the requested creature. Policy RNG consumption can also change subsequent choices, so repeated opening combinations are not necessarily identical careers.

Career reports now record both `starter` and `actualStarter`. Ranked species findings exclude fallback or unrecorded drafts and emit a coverage watch item. The default five preferences now use eligible starters. Comparing more preferences over the same offered seeds does not establish full-catalog coverage.

## The full journey still needs work

| Career cohort                              | Cases | Victories | Defeats | Incomplete |
| ------------------------------------------ | ----: | --------: | ------: | ---------: |
| Original five-preference benchmark         |    50 |        25 |       1 |         24 |
| Baseline, naturally offered catalog starts |    57 |        15 |       1 |         41 |
| Curated, naturally offered catalog starts  |    42 |        11 |       2 |         29 |

Incomplete cases are never defeats. The baseline catalog cohort includes 36 turn-budget and five action-budget exhaustions. Completed baseline careers averaged 176.3 turns, but that excludes 41 incomplete careers and cannot describe the full cohort's expected length. Arbitrary recruitment and replacement choices by the automated policy also limit conclusions about optimal teams.

The strongest remaining finding is defensive attrition, particularly at bosses. In the original controlled boss fixtures:

| Team      | Zero-star, no-talent boss fixtures       | All talents and five-star fixtures |
| --------- | ---------------------------------------- | ---------------------------------- |
| Offensive | Six victories in 17–28 turns             | Six victories in 2–4 turns         |
| Defensive | One victory in 80 turns; five incomplete | Six victories in 11–32 turns       |
| Mixed     | Six victories in 41–74 turns             | Six victories in 3–8 turns         |
| Memento   | Six incomplete                           | Six victories in 1–3 turns         |

Rank-only and talent-only fixtures are recorded separately. For example, five-star Memento without talents completed all six original boss fixtures in 2–3 turns, while zero-star Memento with all talents took 8–11 turns. The result supports investigating the passive curve and mirror matchup; it does not establish a nerf amount. The curated-source fixtures reproduce the broad pattern, with different RNG histories after the changed opening pool.

### Recovery, Merchants and Boons

The 57 baseline careers included 145 rests restoring 2,980 Health and reviving 54 knocked-out creatures. Recovery has a concrete role; that does not establish that its frequency or amount is optimal.

There were 70 prepared Merchant shelves, including 17 with no affordable slot, and 53 purchases averaging 28.2 Gold. The automated policy buys the first affordable item, so those purchases do not measure strategic value. In rendered play, a first-boss shelf offered Merchant's Favor, Brass Censer and Frozen Pocketwatch to a team without Light or Freeze damage: affordability alone did not make a useful combat purchase.

Single-Boon fixtures show why a universal price or power adjustment is premature. Some Boons have no relevant trigger for the mixed team. Resonant Chimes, for example, changed original boss turn counts from 41/48/48 to 31/43/43, while defense and extra draws could change later RNG and fight length in either direction. Three seeds and one team are insufficient for a global ranking.

## Experiments rejected

- Reducing Pearl's value from 2 to 1 was stopped after 15 cases: two victories, two defeats and eleven incomplete. This partial, canceled sweep was not a completed comparison and provided no reason to keep the change.
- Reducing Treasury Echo from two Pearls to one completed the same 57 catalog scenarios: thirteen victories, three defeats and 41 incomplete. Some controlled fights shortened, but the stalled-career count did not improve. The change was reverted.

Memento's abilities and passive tiers remain unchanged by this pass. The next balance implementation should address boss/defense stalemates with a reachable damage payoff or clearer pressure, then compare the same controlled teams before considering general encounter or progression nerfs. A more strategic recruitment/replacement policy and hands-on team choices should accompany that work.

## Verification and boundaries

Focused regression suites cover starter eligibility, actual recruitment into later drafts, current saves, encounter contracts, complete journey settlement, replay/resume, reachable checkpoints and reporting attribution. Two simulation fixtures use a newly observed completing seed after seeded offers changed; budgets and assertions are retained. The all-collected recruitment fixture now uses the complete catalog rather than treating first-run eligibility as the collection.

Rendered browser review at 1280×720 covered a manual Cindernewt opening, recruitment, three-enemy shared-deck play, Campfire revival and Merchant inspection before the pool change. Afterward it covered the curated draft, inspection, opening victory and recruitment of Shadebrim, one of the creatures removed from the first solo offers. Auto-play-assisted battles are identified as such; this is focused interaction evidence, not a complete manual journey or artistic acceptance.

The live-edit preview logged a React error-boundary recovery during experimentation; the final resumed draft, victory and recruitment flow completed afterward. No production reproduction was established.

The bounded local gate and documentation contracts are required before integration. Full static, full unit/DOM, exhaustive browser journeys, builds, packaged Windows, physical controllers, live Steam and Steam Deck remain separate gates; this report does not mark any of them passed.

## Memento follow-up

The approved follow-up gives Pearls Consume: played Pearls leave the battle after resolving, while unplayed Pearls discard and recycle normally. Treasury Echo still creates two Pearls, each granting two Block or two Mana at random. Drowned Revelation remains Draw 2 with no damage. The Court Remembers now deals 3–8 Water damage across its six tiers, with no attacks-per-turn cap. This supersedes the earlier Memento tuning described above; the retained benchmark evidence predates these changes and does not establish their balance.

## Runner follow-up

Policy version 24 replaces arbitrary heuristic journey recruitment and release with a comparison of each offered creature and legal release. Preserve the roster’s only Armor bypass or Purge where possible, then favor living damage coverage, recovery, the deployed lineup and compatibility with owned Boons. Boon rewards use roster compatibility; Merchant purchases compare useful affordable stock by utility per Gold and may leave without buying. Merchant stock and prices remain seeded random values within the existing range, with no guaranteed item or minimum-price slot. The random control retains random recruit/release/reward choices and its first-affordable purchase rule. Both policies prioritize an available Campfire before optional recruits and purchases.

The shared combat policy favors a potential finish against the remaining roster enemies over routine healing or Minion kills. Fully blocked primary attacks lose their baseline attack priority, while Block depletion, Sundering Charm’s Armor erosion and authored follow-up effects retain value. Purge gains priority against visible Block or Armor. Alternate damage types use their average visible benefit and require every branch to be lethal before receiving finishing priority. No future card order, enemy intent, chance outcome or gameplay RNG enters decisions. These scores are estimates, not an exhaustive production combat forecast or an optimal strategy.

Journey journals now use format 4, identify their policy version and retain a reason with each attempted and completed command. Checkpoint experiments retain the same decision reasons. Exhausted action and turn budgets remain incomplete evidence. Both runners report current and lowest combined enemy roster Health, turn, and turns without a new Health low; ten such turns flag a possible stall. Minion Health is excluded. This counter never ends a battle early and does not prove a fight unwinnable.

Focused validation includes exact replay across save/resume and the CLI. The shared full-journey browser fixture uses seed 18 and still requires growing to three deployed creatures, then accepts a Legendary’s ordinary solo ending; its previous seed also failed on unchanged main. The CLI’s successful-replay fixture uses seed 15; seed 4 now reaches the turn budget at encounter 2, with 90 turns without a new enemy Health low. That case remains incomplete rather than a defeat. No new paired sweep or human win-rate conclusion is established by these changes; the earlier benchmark evidence used an older policy.
