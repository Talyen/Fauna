# Memento

Use the [authored kit](../../../src/game/content/creatures/memento.ts) for current values and complete tiers; [recorded selection values](../../archive/CREATURE_KIT_SELECTIONS.md#memento) preserve historical tuning.

Legendary · The palace that remembers

[Legendary rules](../../EXPEDITION_DESIGN.md#legendaries-and-minions) · [Art prompts](memento-art-prompts.md)

Every card costs 1 Mana. Lost Procession summons one Echo if either of two spaces is available, otherwise heals living Minions to full Health. Echoes start with 6 Health; ability upgrades add 2 Health per level. Treasury Echo adds generated Pearl cards directly to hand, using persistent FIFO overflow when full. Pearls have Consume: after their effect and court trigger they leave the battle instead of entering Discard. Unplayed Pearls discard and recycle normally until battle ends or their owner leaves the field. Block and Mana are equally likely; Mana respects the shared [capacity](../../../src/game/ability-rules.ts), including Rainkeeper’s overflow allowance for the player.

The Court Remembers triggers after each accepted card. One random living, uncontrolled Echo attacks one random living opponent after each accepted card, including Pearl. Summoning can trigger the new Echo immediately. Repeated ability effects do not count as additional card plays; there is no attacks-per-turn limit. Echoes have no other attacks or abilities.

Memento can appear in the first Boss encounter. Ordinary enemies and Recruit destinations exclude Legendaries; recruiting one unlocks it as a solo starter. Memento's Health and two-Echo limit are initial tuning.

The battle card limit is 256 currently present cards, including generated cards; consuming a Pearl frees generation capacity. Generation IDs remain unique across the battle and survive reload. Deploying an additional creature at that limit replaces the newest generated copies with its permanent kit. Enemy automatic play is bounded to 256 decisions per turn. Sources and generated images are preserved under `public/art/memento/`; derivatives use the normal asset recipe. Artistic acceptance and full CI/platform validation remain separate from local checks.
