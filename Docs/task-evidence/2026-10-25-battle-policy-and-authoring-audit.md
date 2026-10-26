# Twenty battle and content boundary fixes

The audit fixes five Auto-play scoring errors and fifteen ownership, persistence and
content-authoring boundary issues. The content findings concern malformed authored
rules; the current catalog passes validation. They are not twenty observed failures
in ordinary player journeys.

## Findings

| #   | Finding and resulting behavior                                                                                                                                | Owner                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1   | Fractional Physical bonuses were scored before rounding, missing ordinary lethal hits; round before critical multiplication                                   | [ordinary attack facts](../../src/game/ability-facts.ts)    |
| 2   | Crater Punch piercing was credited to Light and other non-Physical criticals; limit it to Physical damage                                                     | [ordinary attack facts](../../src/game/ability-facts.ts)    |
| 3   | A Freeze-damage ward was scored as consuming Block; count no Block payment for the warded packet                                                              | [ordinary attack facts](../../src/game/ability-facts.ts)    |
| 4   | A redundant support effect could hide useful accepted-play healing; preserve Last Warmth and other shared healing benefits                                    | [battle benefits](../../src/application/battle-benefits.ts) |
| 5   | Mana-neutral Ember Harvest could be ignored despite its useful Burn draw; retain supplemental draw benefits when the primary effect scores zero               | [battle benefits](../../src/application/battle-benefits.ts) |
| 6   | A different checkpoint with the same revision could receive a cached illegal command; invalidate that cached decision                                         | [battle actor](../../src/application/battle-actor.ts)       |
| 7   | Callers could mutate a returned decision and corrupt later cached results; freeze cached decisions and commands                                               | [battle actor](../../src/application/battle-actor.ts)       |
| 8   | Shared command phase arrays could be mutated to change admission for every session; freeze the phase catalog                                                  | [command phases](../../src/game/command-phases.ts)          |
| 9   | Callers could mutate the default audit catalog's membership and alter subsequent validation; freeze that catalog                                              | [content validation](../../src/game/content-validation.ts)  |
| 10  | Save decoding counted characters while native persistence counted UTF-8 bytes; enforce the native byte budget before parsing                                  | [save decoding](../../src/game/save.ts)                     |
| 11  | Unknown supplemental effects crashed description generation before audit findings were returned; report description failures alongside structured rule errors | [content validation](../../src/game/content-validation.ts)  |
| 12  | Blank ability names passed the audit and could produce unnamed cards; require a nonblank name                                                                 | [content validation](../../src/game/content-validation.ts)  |
| 13  | Unsupported primary target modes passed validation and fell through targeting rules; reject them                                                              | [content validation](../../src/game/content-validation.ts)  |
| 14  | Neutral Food could advertise attacks or extras that Food execution ignores; reject unsupported neutral rules                                                  | [content validation](../../src/game/content-validation.ts)  |
| 15  | Permanent creature kits could consume a card required by save validation; reject consuming permanent slots                                                    | [content validation](../../src/game/content-validation.ts)  |
| 16  | Several chance passives accepted percentages above 100 and silently saturated; validate every chance passive's upper bound                                    | [content validation](../../src/game/content-validation.ts)  |
| 17  | Block conversion above 100 percent could subtract more Block than was granted; reject that authored conversion                                                | [content validation](../../src/game/content-validation.ts)  |
| 18  | Unknown battle-start grants produced different player/enemy behavior, including invalid enemy stats; reject unknown grant types                               | [content validation](../../src/game/content-validation.ts)  |
| 19  | Unknown card-bonus triggers silently became Guard bonuses; reject unsupported triggers                                                                        | [content validation](../../src/game/content-validation.ts)  |
| 20  | Unsupported supplemental scopes silently became self Cleanse or unrestricted Reflect; validate both scopes                                                    | [content validation](../../src/game/content-validation.ts)  |

## Evidence scope

[The focused regression suite](../../tests/unit/game/audit-oct25.test.ts) contains one
case per numbered finding. Against the original task base, all 20 cases fail. With
the fixes, all 20 pass. The original failure output is retained as ignored task
evidence at `reports/audit-oct25-before.txt`.

The lightweight changed-file gate passed formatting, syntax lint and source
contracts. Protected integration reruns the current gate against combined main.
Compilers, broader unit suites, modifier baselines, browser and desktop execution
remain CI-owned and pending. No hosted push or CI result is claimed. There are no
layout or visual-style edits, and no native, Windows-package, physical-controller,
Steam-client or Steam-Deck evidence from this audit.
