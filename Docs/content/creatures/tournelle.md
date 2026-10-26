# Tournelle

Use the [authored kit](../../../src/game/content/creatures/tournelle.ts) for current values and complete tiers; [recorded selection values](../../archive/CREATURE_KIT_SELECTIONS.md#tournelle) preserve historical tuning.

Tournelle is an ordinary creature whose scarf, sunburst brooch and rescue imagery inform a protective Light kit. The user selected these rules on October 22, 2026

## Resolution

- Gallantry compares remaining Health percentages, matching the existing injury owner. Each living deployed protector rolls in board order; the first success takes the attack, with no recursive interception. It resolves before the recipient's Dodge, Block, Armor and harmful statuses. The selected recipient keeps supplemental damage from that attack. Repeats select again; periodic damage, retaliation, derived packets and Light bounces cannot initiate interception. Enemy protectors use the 10% base tier
- Kindled Courage removes only Blind from living deployed allies, preserving other harmful effects and active control. Each actual removal uses ordinary Cleanse rewards. The shared keyword draw owner finds the next eligible Light card, including eligible discard recovery under existing tutor rules, and uses normal hand/overflow and Well Read behavior. No matching card means no replacement draw. Its Cleanse grants Health XP; card selection does not grant Light XP
- Valiant Challenge compares current Health points against its resolved recipient on each attack, after interception; reflection compares the original attacker’s Health against the reflector’s. Base damage is 4 or 8; ordinary upgrades increase its base before doubling. Displayed rules retain the undoubled base. Enemies use the same comparison after ordinary room scaling
- Safe Passage selects the lowest positive current Health in the deployed roster, with board order breaking ties, then a random living backup. It excludes Minions and knockouts. The departing kit leaves every card zone; the incoming kit is shuffled into draw before drawing. Tournelle can itself depart and the draw still completes. Without backup it draws without reordering the row. Ordinary enemies have no backup or draw pile, so this ability is excluded from their repertoire; they retain Blind cleansing and Valiant Challenge
- Utility clauses remain fixed through upgrades, matching existing fixed Cleanse/draw utility. Replacements and ability swaps retain Health and effects, never refresh opening benefits, and persist the resulting formation

## Balance and availability

The 4/8 conditional attack averages near the six-point guideline when the condition varies. Interception trades another creature's safety for Tournelle's Health rather than preventing damage; 30 Health supports that role. Blind-only group removal plus a targeted draw, and a restricted swap plus draw, are utility budgets rather than six extra damage equivalents. No new free Mana loop or hand-size exception is introduced. Base and advanced damage/rank behavior have focused coverage; these estimates are not win-rate or playtest acceptance

Tournelle is appended to the explicit species/card catalogs and two ordinary combat packs. It is recruitable and eligible for later collected-species drafts. The existing first-run starter pool is unchanged

## Artwork

Unchanged originals from the user's [Tournelle folder](https://drive.google.com/drive/folders/1qpoPbzR2GxzTh-81Y3sQmXewc-IJmynL) are preserved under `public/art/tournelle/` and prepared through the manifest's lossless card recipe

| Selection         | Source                                                                                       | Visible connection                                          |
| ----------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Creature portrait | [Tournelle 04](https://drive.google.com/file/d/1TZfYsjvKSQeO5i_LHOT0bqyR7kx-gYem/view)       | Stoat in a red scarf facing sunlight beyond snowy mountains |
| Kindled Courage   | [Kindled Courage](https://drive.google.com/file/d/1gBMp0kBwlpyKgJnv_Tt32d-EcFfSoLbj/view)    | Golden scarf-light clears the storm                         |
| Valiant Challenge | [Valiant Challenge](https://drive.google.com/file/d/1ze5eKOdpZriAseUceIEWBJ-NDPilbgFw/view)  | Brooch-light reaches a larger distant rival                 |
| Safe Passage      | [Last-Second Rescue](https://drive.google.com/file/d/1khPQmksWYiHy3GrLK0v3NB1uFPxIf4s9/view) | Scarf lifts a bird away from breaking ice                   |

Creature artwork uses 4:3 landscape; abilities use 3:4 portrait. Source inspection, rendered review, user design selection and balance acceptance are separate evidence

## Rendered review

[Implementation-time evidence](../../../design/visual-quality/DECISIONS.md#tournelle-and-required-replacements) retains the Collection, battle, rank and replacement frames, observed interactions and verification scope.
