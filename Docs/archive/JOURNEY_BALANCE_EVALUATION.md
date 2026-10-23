# Runner and Memento evaluation

Historical measurement and implementation record; [current journey rules](../EXPEDITION_DESIGN.md) take precedence over earlier reward and recruitment flows described here

October 22, 2026. The initial evaluation found runner draw loops and excessive Court pressure in some controlled matchups. The approved policy 25 follow-up below fixes those loops, improves recruitment and replacement, and raises controlled career victories from thirteen to twenty-three with no incomplete current-content careers. Memento balance remains an open design question. Merchant stock and prices remain random within their existing range.

The initial evaluation changed no gameplay; the later approved implementation adds runner fixes and optional post-battle recruitment. The user requested the runner comparison, isolated Memento comparison and manual stalled-case investigation, explicitly skipping full CI. It follows the [balance pass](JOURNEY_BALANCE.md), and retains [structured results](../../design/journey-balance/runner-memento-evaluation.json) for all 426 cases.

## Controlled method

All arms use committed source `27a2c44c1391987a9ab8553e7c3478c6050ac6f7` except the named treatment files. The old runner substitutes its battle policy and playthrough actor from `4acd233`; the old authored Memento kit comes from `5e40530`. The historical kit differs only in Pearl consumption and Court values. Treasury Echo creates two Pearls and Drowned Revelation draws two cards without damage in every arm. All six tiers retain different values; no attacks-per-turn limit is introduced.

| Arm          | Runner                                    | Pearl    | Court tiers |
| ------------ | ----------------------------------------- | -------- | ----------- |
| Old runner   | Policy 23 and former journey decisions    | Consume  | 3–8         |
| Current      | Policy 24 and strategic journey decisions | Consume  | 3–8         |
| Old Memento  | Current                                   | Recycles | 1–6         |
| Consume only | Current                                   | Consume  | 1–6         |
| Court only   | Current                                   | Recycles | 3–8         |

The game-source fingerprint matches exactly between old and current runner arms. Each paired scenario has an identical serialized initial save. Fingerprints include gameplay, application and tooling sources, including the common read-only Boon classifier. They identify these experimental snapshots rather than a production build.

- **Careers:** all fourteen curated starters, seeds 0, 1 and 2, forty-two cases per arm. Each fixture explicitly inserts its requested starter into the initial offer; these are controlled starts, not naturally offered population samples. There are no progression grants. Each uses one journey, 5,000 actions, a 100-turn battle budget and application save/resume every seventeen actions.
- **Bosses:** forty-eight fixtures per content arm, with policy held fixed. Mixed is Mossguard/Emberback/Prismram; offense is Prismram/Emberback/Reedstag; defense is Mossguard/Pollenmoth/Cadenza; Legendary is Memento alone. Each team uses base or maximum passive rank, encounters 4 and 8, and seeds 21, 42 and 63. These are synthetic rank fixtures without talents, Boons or card upgrades. Production commands prepare and start each battle.
- **Ordinary Memento:** six fixtures per content arm, solo Memento at the first ordinary pack, both passive ranks and the same three seeds. All twenty-four finished in victory.

Workers ran sequentially with a 768 MiB Node heap and a sixty-second per-case watchdog. All 426 cases completed their evaluation without worker failures or rejected commands. Budget exhaustion remains **incomplete**, never defeat. Eight representative journals replayed with exact checkpoint equality, including both runners, a draw loop, an attrition stall and all four boss content arms. Resume remained enabled during replay.

## Runner comparison

Content and starting saves are identical in this comparison.

| Runner  | Victories | Defeats | Incomplete |
| ------- | --------: | ------: | ---------: |
| Old     |         3 |      33 |          6 |
| Current |        13 |      26 |          3 |

All three previous victories remained victories. Ten defeats became victories, twenty remained defeats and three became incomplete. The six previous incomplete cases became defeats. This supports the strategic runner, while distinguishing improved decisions from earlier losses.

For the three cases won by both runners, the current runner used an average of 15.3 fewer total turns. This is a small conditional sample. Across all completed cases, current runs averaged 66.2 turns versus 47.3 previously, partly because they reached later encounters; that average is not evidence that the new runner makes equivalent fights slower. Reported turns include completed battles and the observed turn of any final incomplete battle. Budget exhaustion is observed at turn 101; it does not represent a completed 101-turn fight.

| Merchant observation                                                   |   Old | Current |
| ---------------------------------------------------------------------- | ----: | ------: |
| Prepared shelves                                                       |    35 |      44 |
| Purchases                                                              |    22 |      31 |
| Gold spent                                                             |   634 |     887 |
| Mean purchase price                                                    | 28.82 |   28.61 |
| Purchases with no supported trigger according to the current heuristic |     9 |       0 |

More progress exposes more shelves, so purchase totals do not isolate Merchant behavior. The shared classifier estimates roster compatibility; it is not an independent measure of true Boon value. The observations support more relevant purchases without changing item generation, guarantees or price ranges.

## Separate Consume from Court damage

Each row uses the current runner and exactly the same forty-two initial career saves.

| Memento treatment           | Victories | Defeats | Incomplete |
| --------------------------- | --------: | ------: | ---------: |
| Recycling, Court 1–6        |        21 |       1 |         20 |
| Consume, Court 1–6          |        27 |       1 |         14 |
| Recycling, Court 3–8        |        15 |      11 |         16 |
| Consume, Court 3–8, current |        13 |      26 |          3 |

Consume with the old damage converts ten incomplete cases into wins, but also turns four previous wins into incomplete cases. It is a useful direction, not a universal improvement. Raising Court with Consume held fixed turns fifteen previous wins and ten incomplete cases into defeats. It also converts three incomplete cases into wins. The interaction matters: this is not evidence that reducing stalemates alone establishes balance.

Boss fixtures reinforce the pressure concern:

| Team and passive rank | Recycling, 1–6 | Consume, 1–6 | Recycling, 3–8          | Consume, 3–8      |
| --------------------- | -------------- | ------------ | ----------------------- | ----------------- |
| Mixed, base           | 6 wins         | 6 wins       | 1 win, 5 defeats        | 6 defeats         |
| Mixed, maximum        | 6 wins         | 6 wins       | 6 wins                  | 5 wins, 1 defeat  |
| Offense, base         | 6 wins         | 6 wins       | 6 wins                  | 5 wins, 1 defeat  |
| Offense, maximum      | 6 wins         | 6 wins       | 6 wins                  | 6 wins            |
| Defense, base         | 6 incomplete   | 6 incomplete | 4 defeats, 2 incomplete | 6 defeats         |
| Defense, maximum      | 6 incomplete   | 6 incomplete | 6 incomplete            | 6 defeats         |
| Memento, base         | 6 incomplete   | 6 incomplete | 2 wins, 4 defeats       | 3 wins, 3 defeats |
| Memento, maximum      | 6 wins         | 6 wins       | 6 wins                  | 6 wins            |

Totals are 30 wins/18 incomplete for either 1–6 treatment; 27 wins/13 defeats/8 incomplete for recycling at 3–8; and 25 wins/23 defeats for the current treatment. Bosses use their own rank-zero Court, so maximum-rank rows strengthen the player rather than raising boss Court damage. No human difficulty target or win-rate target was established, and this small fixture set cannot supply one.

## Manual investigation of the three current incomplete careers

All manual inputs used the rendered browser at 1280×720 with Auto-play off, on an isolated preview origin. Checkpoints and captures accompany the local evaluation artifacts. None of these bounded attempts established a victory or proved a fight unwinnable.

**Emberback, seed 2:** the automated run reached encounter 3, turn 101, with 93 enemy roster Health and ninety-one turns without a new Health low. I replayed that battle manually from its start, using both opening Stun attacks, targeted Ember Charge, Burn, draw and recovery. Enemy Health reached 44 by turn 8, substantially lower than the automated terminal state. Emberback had already fallen by turn 7. By turn 10, Stillara and Mossguard remained while enemy Health recovered to 51 behind nineteen combined Block. Rooted Stomp could not reliably sustain pressure through recovery and Block. The attempt stops there as incomplete; it supports better attacker preservation and deployment evaluation, not an encounter nerf amount.

**Reedstag, seed 0:** the automated run exhausted 5,000 actions at the final boss on turn 12. Its last hundred commands were the same Resonant Well, with the same hand and three Mana; Cadenza had no direct damage payoff. I cast Well twice manually and reproduced the unchanged hand and Mana. End turn advanced combat. Cadenza fell on turn 16, letting a living Captoad replace it. Spore Puff and Mushroom Guard advanced play through turn 18; Memento still had 58 Health. This is a confirmed non-progress action cycle, not a long-fight timeout.

**Tournelle, seed 0:** the second 5,000-action exhaustion repeated the same Well for its final hundred commands at final-boss turn 11. I manually cast Well and reproduced the unchanged hand and Mana, then ended the turn. Combat advanced to turn 12 and existing Burn reduced Memento from 54 to 52 Health. This confirms the same defect in another career, without assuming that escaping it guarantees victory.

## Recommendations from the initial evaluation

The policy 25 follow-up below implements and remeasures these runner recommendations.

1. **Prevent repeated tactical states in automated card selection.** Remember visible tactical states within a turn and skip choices that close an unchanged cycle; choose another useful action or End turn. Include hand, pile counts, Mana, Health, Block and statuses, while excluding hidden card order and future RNG. A card that actually changes combat through Memento's passive must remain playable repeatedly. Add regressions using both recorded Cadenza checkpoints and a productive draw/passive control. Keep incomplete diagnostics as a backstop.
2. **Evaluate the deployed formation after recruitment and release.** Current scoring protects roster-wide capabilities, yet a surviving damage dealer in reserve does not help a solo support deployed after losing a Legendary. The Reedstag trace releases Memento for Prismram, leaving one deployed creature and four living reserves. Score legal resulting deployments and protect reachable damage, including this transition from a Legendary's solo formation; the observation does not yet justify a gameplay formation-rule change. Re-run the same fixed cases after the policy change.
3. **Keep Consume and current Merchant generation.** Do not add a guaranteed Boon or fixed bargain slot. The evidence supports compatibility-aware buying while retaining random offerings and prices.
4. **Hold further Memento tuning until those runner fixes are measured.** The current 3-damage start remains an approved design choice, but its pressure is a concrete open concern. Repeat these four content arms after the runner fix, then review mixed-team losses and defensive stalls manually. This evaluation supports no precise replacement damage value, boss Health amount or attack cap. Drowned Revelation remains a draw card without damage.

## Evidence and verification boundaries

The structured evidence retains every case's source identity, initial-save hash, outcome, action and turn count, terminal diagnostics, paired transition counts, boss groups, manual observations and replay results. Full journals, source snapshots, fixture saves, investigation scripts and screenshots are retained in the ignored local evaluation report directory and the integration archive. The local report contains `evaluate.mjs`, `factorial.mjs`, `analyze.py` and `replay.mjs`; they reconstruct the treatment files from the pinned commits and retain the comparison manifests.

The repository's standard paired-balance significance helper requires matching policy versions and complete cases. This evaluation deliberately reports descriptive matched outcomes across policy versions and preserves incomplete cases; it does not claim that helper's statistical acceptance or exclude inconvenient runs.

These observations establish controlled runner behavior and focused browser interaction only. Full CI was skipped as requested. Full static, full unit/DOM suites, production builds, exhaustive browser journeys, desktop, Windows packaging, physical controllers, Steam client and Steam Deck remain unrun for this evaluation. The required lightweight path check and documentation contracts are separate from those gates.

## Implementation and repeat: policy 25

The approved runner changes are implemented in `961f506`: bounded tactical cycle detection shared by Auto-play and automated drivers, recruitment scored against keeping the roster using the game's actual formation rules, and knockout replacement that restores missing deployed damage. The [runner follow-up](JOURNEY_BALANCE.md#runner-cycle-and-roster-fixes) records the behavior. Making the approved keep-roster choice reachable also makes post-battle recruitment optional for players; the existing Victory footer now offers Skip. No Memento card, passive, Mana cost, Merchant stock rule or price range changed.

The completed repeat retains 426 cases with no rejected commands or worker failures. It uses the same forty-two fixed starter saves, four teams, passive ranks, encounters and seeds. All arms share the new legal recruitment/formation code; the before arm retains policy 24 and reproduces its previous 13 wins, 26 defeats and 3 incomplete cases exactly. Initial saves match across paired arms. Ninety-one final gameplay, application and tooling files match the evaluated snapshot byte for byte; the only other difference removes an unused type-only import, with all other source text identical. The read-only measurement classifier is common and additional. Auto-play also binds its enabled state and decision owner to the current application session, so switching sessions starts disabled.

| Runner            | Victories | Defeats | Incomplete |
| ----------------- | --------: | ------: | ---------: |
| Before, policy 24 |        13 |      26 |          3 |
| After, policy 25  |        23 |      19 |          0 |

All thirteen earlier victories remain victories. Nine defeats and one incomplete case become victories; seventeen defeats remain defeats, and two incomplete cases become defeats. For the thirteen common victories, the new runner uses 18.5 fewer total turns on average. This is a conditional comparison, not an expected human journey duration. The Reedstag draw-loop career now wins in 437 actions; Tournelle and Emberback now end in defeat in 189 and 217 actions. There are no current-content incomplete careers left in this small cohort to investigate manually. That does not establish termination for every seed or an optimal policy.

The four content arms with the new runner produce:

| Memento treatment           | Victories | Defeats | Incomplete |
| --------------------------- | --------: | ------: | ---------: |
| Recycling, Court 1–6        |        24 |       6 |         12 |
| Consume, Court 1–6          |        34 |       5 |          3 |
| Recycling, Court 3–8        |        23 |      13 |          6 |
| Consume, Court 3–8, current |        23 |      19 |          0 |

The higher Court damage still trades fewer incomplete careers for more defeats with the improved runner. The approved 3-damage start remains in place; these descriptive fixtures do not establish a replacement number or justify an attack cap. All remaining incomplete experimental careers exhausted the turn budget, rather than repeating an action until the action budget. The [repeat evidence](../../design/journey-balance/runner-followup.json) retains the complete matched cohort and source fingerprints.

The boss outcome totals remain 30 wins/18 incomplete for either 1–6 treatment, 27 wins/13 defeats/8 incomplete for recycling at 3–8, and 25 wins/23 defeats for the approved treatment. All twenty-four ordinary Memento fixtures win. The unchanged boss outcome counts after the runner fixes keep the pressure concern open; low-damage defensive stalemates also remain in experimental content arms.

Merchants expose fifty-seven shelves and forty-three purchases with the new runner, versus forty-four shelves and thirty-one purchases before. Neither arm buys a Boon classified as lacking a supported trigger. Mean paid prices are 27.81 and 28.61 Gold respectively. Different progress exposes different stock, so this is not a Merchant price treatment or an independent ranking of Boon power.

The earlier two recorded Cadenza checkpoints are permanent regressions. Both escape through accepted production commands with save/resume between actions. A productive Memento fixture retains repeated damaging plays without an attacks-per-turn cap. Five representative career journals and four boss journals replay with exact checkpoint equality. Three careers regenerate identical decisions and checkpoints with periodic resume enabled or disabled. The production-command counterpart of the existing browser journey reaches victory in 359 actions, inside its unchanged budget. This last check executes no browser assertions.

Rendered review inspected matching before/after recruitment frames at 1280×720 with 125% text and 1920×1080 at default text. The added Skip uses the existing registered Button and reserved reward footer; artwork positions, selected typography and control sizes remain unchanged. Its measured hit height is 44px and foreground/fill contrast is 15.67:1. No clipping or scrolling was observed in these frames. At a full roster, Cancel restores focus to the chosen recruit; Tab reaches Skip and Enter commits it. Declining preserves roster, lineup, cards, Collection ranks and Gold, and reload/Continue resumes the next encounter. Live Auto-play advances the retained Cadenza checkpoint from turn 12 to turn 13. Captures and saved states remain in the local report and integration archive. This is functional/rendered evidence, not a new aesthetic approval.

Focused local regressions cover the battle actor, battle policy, recruitment and collection, starter growth, application save/resume, Auto-play, reward UI, controlled battle replay, CLI replay and performance fixtures. Boss recruitment skips retain intermediate Boon choices and final victory without duplicate gains. Full CI remains skipped at the user's request; no full static, full unit, production build, exhaustive browser, desktop, packaged Windows, physical-controller, Steam-client or Steam Deck result is claimed.

### Integration history

Initial protected local integration attempts stopped before advancing main: the required `tests/unit/game/engine.test.ts` invocation exceeded the then-current sixty-second per-suite deadline. Those unfinished invocations were not passing evidence. Formatting, changed-source lint/contracts and all four selected compiler environments passed. Focused runner/UI suites, the controlled comparisons and retained replay checks passed independently. The pinned accessibility dependency missing from the shared installation was initially supplied in a task-owned dependency overlay; the shared installation was preserved.

During the subsequent reward-presentation work on 2026-10-22, the updated verification workflow ran all 1,793 engine tests successfully in 124 seconds. The combined gate then exposed an older Pollenmoth test that attempted to play while a knockout replacement was mandatory. Its backup and knockout exclusions now use separate legal fixtures without changing gameplay or weakening the replacement rule. Dependencies were refreshed through `npm run deps`. Full CI remains skipped as requested; protected integration still requires the complete selected gate to pass.
