# Stack maintenance observations

## CI scheduling

The completed [verification run 40419975709](https://github.com/Talyen/Fauna/actions/runs/40419975709) used commit `7870331150ec7cb8f037ffa9c58aeb259694830a`. Its coverage-checked unit report contains 6,545 exhaustive lineup cases across sixteen shards. The recorded test durations ranged from 296.6 seconds for shard 11 to 680.0 seconds for shard 7. These are per-shard test durations, not total workflow times; runner differences and changing content may affect them.

The run took about 17 minutes 27 seconds from creation through provenance completion. Lineup jobs were on the critical path, but their observed start times also differed. The existing eight-versus-four browser comparison remains useful for its measured commit; it does not measure lineup scheduling on this run.

For a future scheduling experiment, retain all case identities, seeds, intermediate save checks and the final coverage gate. Derive estimates from a complete successful report, assign cases using stable identities and deterministic tie breaks, and give unknown cases a fallback weight. Compare repeated runs on the same commit and runner configuration, recording both test-step and workflow elapsed times, runner consumption and failures. A projected balance is not a demonstrated speedup. Keep the current partition until such a comparison passes.

### Cross-run projection

The completed [run 40265149396](https://github.com/Talyen/Fauna/actions/runs/40265149396) used commit `db6a09c19f8909c79de97cfff131d891f7d5807a`. Its 6,545 lineup identities matched the later run. An offline experiment sorted cases by the other run's individual durations, then assigned each to the shard with the smallest estimated total, with stable identity and shard-order tie breaks. Unknown identities would receive the median observed duration. The experiment retains the complete case set; it does not execute the proposed schedule.

| Training report | Evaluation report | Slowest original shard, sum of case times | Slowest projected shard, sum of case times |
| --------------- | ----------------- | ----------------------------------------: | -----------------------------------------: |
| 40265149396     | 40419975709       |                                   679.1 s |                                    521.0 s |
| 40419975709     | 40265149396       |                                   608.3 s |                                    478.5 s |

The projected shards contain 409 or 410 cases each. These sums omit setup and queueing and assume that each case would take the same time under a different assignment. The two reports use different commits and runners, and evaluating the reverse direction is retrospective, not a prospective validation. The results support testing a deterministic duration-based partition; they do not prove a CI speedup or justify changing the default yet. Raw reports, the projection script and its output are preserved in the completed task's ignored-evidence archive under `reports/lineup-scheduling/`.

## React Compiler

The completed [performance run 40356685517](https://github.com/Talyen/Fauna/actions/runs/40356685517) used commit `db6a09c19f8909c79de97cfff131d891f7d5807a`. Three baseline and three compiler captures ran on the same hosted Linux runner, with all baseline captures before all compiler captures. Across the six scenarios and three comparisons, the compiler's p95 frame-gap difference ranged from -0.1 to +0.1 ms. Individual longer-gap rates varied in both directions. These short samples do not establish a meaningful improvement or visual parity, and the fixed order can confound the comparison.

Keep the compiler disabled by default. Any adoption decision needs repeated, preferably counterbalanced captures with matching checkpoints and builds, plus rendered interaction review and relevant native-platform measurements. This run is browser evidence, not packaged Windows, physical-controller, Steam or Deck evidence.

## CI repair after integration

[Run 40432242246](https://github.com/Talyen/Fauna/actions/runs/40432242246) found a type-aware lint warning in the Steam language regression and a production build failure at the active-media ceiling. The test now gives its adapter an explicit structural type. Comparing committed prepared-media receipts against `cfa5b176` identifies ten additional active Boon objects totaling 7.27 MiB; the full selection is 316 unique objects / 228.58 MiB. The media allowance increases from 223 to 231 MiB to accommodate that reviewed content while retaining the 3 MiB per-image ceiling and the original lossless outputs. The inventory is not a production build or packaged-size measurement.
