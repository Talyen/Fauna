# Ten boundary fixes

Base: `faac0e208d9e8ee9eed86e56f486ce42f820e8e6`, committed local main.

The [focused regression suite](../../tests/unit/game/boundary-audit.test.ts) reproduced
all ten issues before the implementation changes. Its final thirteen cases also
cover automatic skipping, last-Mana plays and both reserved identity namespaces.

| Issue                                                                            | Corrected behavior                                                                                  |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Lost Procession left a surviving Echo injured while replacing a fallen one       | Existing living Echoes receive restoration on every summon                                          |
| Partial Bleed removal mutated an already captured Leech payment                  | Tick receipts copy both the obligation array and its entries                                        |
| Group healing continued after overflow Cleanse reactions defeated its healer     | Each recipient rechecks the healer's Health                                                         |
| Passing Flame continued after a recipient's Molten Shell defeated Pyrella        | Remaining Burn delivery stops when Pyrella falls                                                    |
| End Turn and automatic skipping could exceed the save schema's turn ceiling      | Admission, automatic advancement and decoding share the limit; last-turn card plays remain saveable |
| Enemy forecasts counted protection retained on knocked-out creatures             | Fallen combatants contribute no active combat value                                                 |
| Destination saves admitted roster IDs that collide with future enemies or Echoes | Save validation reserves those namespaces and permits intact-backup recovery                        |
| Saves admitted duplicate Bleed Leech sources with ambiguous FIFO allocation      | Obligations require one positive entry per source                                                   |
| Lowercase Windows drive paths exposed private directories in diagnostics         | Drive-path redaction accepts either letter case                                                     |
| JSON escaping made diagnostic history exceed its own reload limit                | Retention bounds the serialized history and preserves the newest entries                            |

The identity and obligation checks defend corrupted-save admission; ordinary
runtime commands already generate distinct identities and combined obligations.

Verification: ten initial regressions failed on the original code; the final
focused suite passed all thirteen cases with one worker under the 30-second
budget. The changed-file gate passed formatting, syntax lint, source contracts
and documentation checks. Protected integration reruns that lightweight gate.

Full compilation, broader unit/integration coverage, balance, browser simulation,
desktop runtime, Windows packaging, physical controllers, Steam client and Steam
Deck validation were not run locally. Hosted CI is pending; no push or publication
is part of this task. These changes add no presentation layout or interaction flow.
