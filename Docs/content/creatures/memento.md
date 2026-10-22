# Memento

Legendary · The palace that remembers · 60 Health

[Authored kit](../../../src/game/content/creatures/memento.ts) · [Legendary rules](../../EXPEDITION_DESIGN.md#legendaries-and-minions) · [Art prompts](memento-art-prompts.md)

| Ability            | Rules                                                |
| ------------------ | ---------------------------------------------------- |
| Lost Procession    | Summon an Echo / Restore your Minions to full Health |
| Treasury Echo      | Create 2 Pearls                                      |
| Drowned Revelation | Draw 2 cards                                         |
| Pearl              | Gain 2 Block or Mana                                 |

Every card costs 1 Mana. Lost Procession summons one Echo if either of two spaces is available, otherwise heals living Minions to full Health. Echoes start with 6 Health; ability upgrades add 2 Health per level. Treasury Echo adds generated Pearl cards directly to hand, using persistent FIFO overflow when full. Pearls remain in the deck until battle ends or their owner leaves the field. Block and Mana are equally likely; Mana respects the turn maximum.

The Court Remembers: Each time you play a card, an Echo attacks for 1 Water damage. The six passive tiers deal 1, 2, 3, 4, 5 and 6 Water damage. One random living, uncontrolled Echo attacks one random living opponent after each accepted card, including Pearl. Summoning can trigger the new Echo immediately. Repeated ability effects do not count as additional card plays. Echoes have no other attacks or abilities.

Memento currently fills both Boss encounters while it is the only authored Legendary. Ordinary enemies and Recruit destinations exclude it; recruiting it unlocks it as a solo starter. Health and the two-Echo limit are initial tuning.

The battle card limit is 256 including generated cards. Deploying an additional creature at that limit replaces the newest generated copies with its permanent kit. Enemy automatic play is bounded to 256 decisions per turn. Sources and generated images are preserved under `public/art/memento/`; derivatives use the normal asset recipe. Artistic acceptance and full CI/platform validation remain separate from local checks.
