# Arabesca

[Ability and passive regressions](../../../tests/unit/game/ability-contracts.test.ts) · [Review fixture](../../../tests/support/arabesca.ts)

Use the [authored kit](../../../src/game/content/creatures/arabesca.ts) for current values and complete tiers; [recorded selection values](../../archive/CREATURE_KIT_SELECTIONS.md#arabesca) preserve historical tuning.

Arabesca is a spring dancer. The owner selected Ribbon Snare, Springbound, Dancing Double and allied Dodge healing on October 25, 2026. Allies include Arabesca herself. Her kit uses short, direct rules tied to the depicted action.

## Petalwake

Every Arabesca Dodge heals her living deployed side, including herself and allied Minions. Knocked-out creatures are excluded; the shared automatic-healing owner includes backups when Camp Hammock is owned. Another creature's Dodge does not activate her passive. Duplicate Arabescas each heal only when that individual Dodges. Enemy Arabescas use the base tier and heal their own side.

Blind misses already resolve as Dodge and activate Petalwake. Negate, Block and periodic damage do not. Healing uses ordinary recipient modifiers, Health caps and healing-triggered Boons, without card-only overhealing rewards. Catch Breath restores Health to the Dodging creature; Petalwake also restores her companions. Cindernewt retaliates on Dodge instead of healing.

## Abilities

Ribbon Snare uses ordinary Stun damage and buildup, Armor, Block, Dodge and critical-hit rules. Damage follows ordinary ability upgrades before amplification. Its six-point starting value follows the ordinary attack budget.

Springbound removes Freeze buildup from living deployed allies, including Arabesca and Minions, then grants temporary Dodge to Arabesca alone. It reuses Thaw Path's buildup removal: active Freeze and unrelated harmful effects remain unchanged. Dodge expires with the owner's ordinary action window, including in backup or on a skipped turn. The Dodge bonus follows ordinary ability upgrades and caps. The situational team cleanse supplements a self-protection card; its value depends on the opposition.

Dancing Double exchanges a card and Mana for one additional resolution of a later card. It can prepare an ally's powerful attack or utility, and its payoff depends on that card and available Mana. The effect is fixed across ability upgrades, like existing fixed protection and resurrection effects. These budget observations do not establish measured balance.

## Shared card repeat

[Repeat ownership](../../../src/game/combat/card-repeat.ts) belongs to the battle side, independently for player and enemy. The next accepted card spends the existing grant before resolving. Full primary and supplemental effects repeat at most twice in total, even with other repeat sources. Normal actor/target liveness checks still apply between resolutions. Repeated effects cost no additional Mana and award no additional accepted-play count or keyword XP.

Dancing Double does not repeat itself when initially played. If an existing grant doubles it, its resolutions refresh one future grant rather than stacking charges or recursing. Shared Food can consume the grant, resolves twice and is Consumed once; creature-specific Food exclusions remain unchanged. The grant survives turns, creator departure, swaps and save/resume, and resets with a new battle. Rejected commands and detached previews cannot consume the live grant. The battle shows Next card ×2 while the player's grant is pending.

[Implementation evidence](../../task-evidence/arabesca.md) records the original save-format and baseline changes.

## Play pattern and availability

Springbound prepares evasive healing, Ribbon Snare supplies pressure and control, and Dancing Double prepares a strong teammate's card or a second Springbound resolution. Weaknesses include unreliable Dodge, control, periodic damage and the tempo spent preparing a double instead of addressing immediate danger. No special partner is required, and the passive can heal Arabesca even when she is the last survivor.

Arabesca is appended to ordinary encounter and card catalogs, preserving the earlier entries' relative order, and can be recruited normally. She is excluded from the first-run starter pool; collected starter selection follows the existing rules. Auto-play recognizes her Freeze removal, Dodge and pending-repeat utility.

## Artwork

The [Drive collection](https://drive.google.com/drive/folders/14UODVexijj1Kbj0R9t4M6lV6Hb525DSa) supplies unchanged originals:

- [Portrait](https://drive.google.com/file/d/1gbmzXPBJco03g9FgBHk7TM3rA3GuLep6/view): a flowering antlered dancer beside a snowy stream
- [Ribbon Snare](https://drive.google.com/file/d/1TWxkx_BpDc0p1m4MdkqZr5cp4KLzVKuG/view): petal ribbons restrain a stone pursuer
- [Springbound](https://drive.google.com/file/d/1huJRQZDH_YlI9frn4IzE8NhZ4-WWa7Ji/view): a graceful leap over thawing falls
- [Dancing Double](https://drive.google.com/file/d/1Ec4K0wytqKvA-HiJ6VdJ9wWoZGC7xz4s/view): a luminous petal duplicate follows her

Original PNGs are preserved under `public/art/creatures/arabesca/`. The asset manifest records source identity and the standard lossless prepared-art recipe. The owner's selection establishes the requested artwork and mechanics; rendered acceptance and measured balance remain separate evidence.

[Implementation evidence](../../task-evidence/arabesca.md) records local checks, rendered review, exercised interactions and pending validation.
