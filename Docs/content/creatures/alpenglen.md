# Alpenglen

[Creature index](README.md) · [Content contracts](../../CONTENT.md)

Use the [authored kit](../../../src/game/content/creatures/alpenglen.ts) for current values and complete tiers; [recorded selection values](../../archive/CREATURE_KIT_SELECTIONS.md#alpenglen) preserve historical tuning.

Alpenglen’s resting alpine ibex portrait and warm sunlight against cold mountains suggest the last warmth remaining after sunset. It joins ordinary encounters, recruitment and collected starter drafts. It stays outside the curated first-run pool pending measured solo balance: reflection and repeat setup leave only Last Light Charge as immediate damage.

## Ability scaling

Charge gains the ordinary two damage per ability level; the two setup abilities retain their single protection or repeat grant. Ordinary enemies use room-scaled damage and the base passive tier.

## Last-card ownership

The admitted play snapshots whether the visible hand contains exactly that card before removing it. Buffered future cards do not count as visible cards. Charge retains that condition for both resolutions even if reactions draw or return cards. It uses ordinary Critical Hit, Dodge, Negate and attack-reflection rules; a guaranteed Critical Hit does not bypass protection that prevents Critical Hits.

Once the accepted card has resolved, each living deployed Alpenglen heals through the existing attributed healing owner. Any creature's card, including shared Food, can qualify. A repeated resolution is not another accepted play. Drawing, returning the played card or promoting overflow does not revoke an earned trigger; discarding a hand on End turn does not earn one. Rejected commands do nothing.

Each Alpenglen uses its own complete tier and independently selects the most injured living recipient by Health fraction, with battlefield order breaking ties. Healing respects caps, talents, Boons and Camp Hammock's backup eligibility. Fallen and backup Alpenglens contribute nothing; control does not disable a living deployed automatic passive. Healing cannot revive a fallen recipient.

Real enemy decks use the same captured condition and base-tier healing. Ordinary enemies have no hand, so they cannot satisfy a last-card condition; their Charge retains ordinary Critical Hit chance. They can still reflect attacks and grant their side the next-card repeat. The enemy evaluator models these rules without advancing live RNG.

No saved counter or format change is required. Existing current-format saves preserve reflection and the side's next-card repeat grant; Last Warmth never replays on resume.

## Play and balance

Sunset Reversal protects Alpenglen while its player spends other cards. Ember followed by a final-card Charge can deliver two 8-damage Critical Hits at base ability level, provided the target survives the first hit, and earns one Last Warmth heal. Ember can instead repeat another ally's stronger attack, healing or support ability. A final card from another creature still provides warmth.

The passive differs from Cadenza's second-card healing and Reverie's inactive-creature healing by rewarding commitment of the visible hand. Poor draws can leave setup without enough damage; large hands and limited Mana delay the healing. Attacks against teammates, Blind, Purge and periodic damage remain relevant pressure. Block now absorbs periodic damage through the shared combat rules, independently of Alpenglen.

Charge's four damage trades below-baseline immediate output for a reachable eight-damage finisher. Ember intentionally reuses Arabesca's shared repeat mechanic, and Sunset Reversal reuses Oathara's attack reflection. The complete kit, higher ability levels, duplicate passives and repeated finishers require hosted balance evidence; no measured win-rate claim is made.

## Artwork provenance

The user selected the three ability illustrations and Last Warmth on October 25, 2026 from the inspected [Alpenglen Drive folder](https://drive.google.com/drive/folders/1h5OQclG1-6daJ1cjKH_FCXpTLc3Gkhgq). Its sole supplied portrait is retained with them:

| Use               | Original                                            | Drive source                                                                       |
| ----------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Portrait          | `Alpenglen_03.png`                                  | [Original](https://drive.google.com/file/d/1PmfLCOYSqJp8_emzV2nnDCj_AJQH4mHK/view) |
| Sunset Reversal   | `Alpenglen_Ability-Expansion-01_SunsetReversal.png` | [Original](https://drive.google.com/file/d/12-P0bObaUvYTWCYLtGupQHOLgVycvJ2H/view) |
| Ember of Evening  | `Alpenglen_Ability-Expansion-02_EmberOfEvening.png` | [Original](https://drive.google.com/file/d/1l_dj41eH_oxzs0mHtOjWtGbynXLeZrb4/view) |
| Last Light Charge | `Alpenglen_Ability-Utility-04_LastLightCharge.png`  | [Original](https://drive.google.com/file/d/1lRSth6jP4kQw8gXBrwoX5W1BwtWNKZ-8/view) |

The golden returning wave, preserved sun and forceful leap match their chosen actions. Unchanged originals live under `public/art/creatures/alpenglen/`; the manifest and shared lossless recipe preserve their complete compositions at 4:3 for the portrait and 3:4 for actions. [Implementation evidence](../../task-evidence/alpenglen.md) records observed checks and outstanding gates.
