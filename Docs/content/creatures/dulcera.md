# Dulcera

[Swap owner](../../../src/game/team.ts) · [Focused regressions](../../../tests/unit/game/creatures/dulcera.test.ts)

Use the [authored kit](../../../src/game/content/creatures/dulcera.ts) for current values and complete tiers; [recorded selection values](../../archive/CREATURE_KIT_SELECTIONS.md#dulcera) preserve historical tuning.

Dulcera is a support creature, the gentle sanctuary. The owner selected Gentle Passage, Chapel Light, Meadow Shelter and Hushed Waters on October 25, 2026. Her rounded sea-cow silhouette, submerged chapel, warm sunlight and protective seagrass connect restoration with safe passage. She appears in ordinary encounter packs and recruitment. Her kit has no direct damage, so she is excluded from the first-run starter pool; collected copies follow ordinary starter selection.

## Gentle Passage

The shared swap owner restores Health after the new formation is committed. Living Dulceras involved in the exchange provide passage: those deployed before or after the swap, including a departing Dulcera and an arriving Dulcera herself. A provider present in both formations contributes once; duplicate providers contribute independently. Fallen and unrelated backup Dulceras provide nothing. Only newly deployed creatures receive restoration. Rearranging existing positions, opening a battle, recruitment outside battle and resuming a save do not trigger passage. Legendary formation changes and knockout replacements use the same boundary.

This is ordinary passive healing: maximum Health, Mending and healing-triggered Boons apply; it neither revives nor grants card-only overhealing rewards or healing bounces. No new saved counters or fields are needed. Rejected commands retain state and RNG. Preview resolves the same production swap on detached state.

Tournelle intercepts attacks and Reedstag shares protection; Gentle Passage makes changing the lineup restorative. It works with other creatures' swap abilities and required replacements. Its weakness is the need for living backups and opportunities to exchange creatures; it supplies no damage or automatic recovery while the lineup stays unchanged.

Skybex's Mountain Guide grants incoming protection at the same swap boundary. The combined result grants that protection before Gentle Passage restores Health. Arabesca's shared card double can repeat Hushed Waters' Cleanse, while the existing deployed-actor check prevents exchanging an actor that already left the formation again.

## Abilities

Chapel Light restores Dulcera herself and refunds its Mana cost. Healing follows ordinary ability upgrades; the supplemental Mana refund stays fixed. It provides modest recovery without spending net Mana, similar to existing resource-support abilities, with no draw attached.

Meadow Shelter uses the existing group Block rule, including living allied Minions. Its initial group value follows the six-point guideline with three allies; ordinary upgrades increase the primary Block value. Its straightforward overlap with Pollenmoth's protection is intentional: the illustration depicts a protective seagrass arch, and the passive supplies Dulcera's distinct strategy.

Hushed Waters randomly chooses a living backup using seeded selection. The exchange resolves first, including Gentle Passage, then the incoming and remaining living deployed allies are fully Cleansed. The departing Dulcera retains her own effects in backup. With no living backup, the lineup and RNG remain unchanged and the Cleanse still resolves. Auto-play skips the card when neither exchange nor Cleanse offers a benefit. Upgrades do not add swaps or improve complete removal. It combines existing extraction and team-removal utility; its value depends on available backups and harmful effects rather than printed damage.

Ordinary enemies have no backup roster. Enemy Dulceras can heal themselves, protect their group and Cleanse their group; Hushed Waters does not rearrange their positions. Chapel Light's Mana extra is removed by ordinary enemy adaptation. Enemy swaps therefore cannot trigger Gentle Passage, and no enemy reserve system is introduced.

## Play pattern and balance scope

Meadow Shelter protects the team while attackers spend the remaining Mana. Chapel Light patches Dulcera's injuries without shrinking that action budget. Hushed Waters brings in a weary backup, restores some Health and clears the new lineup's afflictions. Several Dulceras amplify passage without generating Mana, cards or additional swaps.

A poor draw still offers Block or a Mana-neutral heal. Without backups, Hushed Waters retains its Cleanse but loses extraction and passage. A team lacking damage can be overwhelmed despite its recovery. Strong healing/Block talents and Boons remain ordinary amplification; focused examples and budget comparisons do not establish measured win rates or fight length. Broad balance sweeps remain CI-owned.

## Artwork and evidence

Unchanged originals come from the [Dulcera Drive collection](https://drive.google.com/drive/folders/1zJ1y0S5agPaoBCelodw8MNbD0ZCBgbPT):

- [Portrait, Dulcera_03](https://drive.google.com/file/d/17yh8uw5uH7b7mkcxK0GfFalOMXrNz-J3/view): gentle sea cow resting beneath a submerged chapel arch
- [Chapel Light](https://drive.google.com/file/d/1QJUZw-TEe59CFMOzf7_fmMfJgocDJMkQ/view): amber sunlight gathered between her flippers
- [Meadow Shelter](https://drive.google.com/file/d/12YKPTcxa0gPYJDE2yrV-T-VaaiRx2XZ3/view): seagrass redirects falling rubble around a safe hollow
- [Hushed Waters](https://drive.google.com/file/d/101oV5XFxz3DMF5apa36E7nEbTk-_0Kel/view): a flipper quiets a turbulent current, supporting withdrawal and cleansing

The owner selected these three ability illustrations and their rules on October 25, 2026. Originals are retained under `public/art/creatures/dulcera/`; [the manifest](../../../assets/manifest.json) records their Drive sources and standard lossless preparation recipe. The artwork uses the existing landscape creature and portrait action profiles without layout changes.

[Implementation evidence](../../task-evidence/dulcera.md) records observed checks and rendered review separately from artistic approval, balance measurement and platform qualification.
