# Euphera

[Creature index](README.md) · [Authoring contracts](../../CONTENT.md)

Euphera has 26 Health and joins starter drafts, ordinary encounters and recruitment. Its abilities:

- **Twilight Lance:** Purge enemy Thorns; Deal 5 Light damage
- **Wish Exchange:** Redistribute allied Block evenly; Allies gain 1 Block
- **Possible Path:** Shuffle your hand into your deck; Draw that many cards

**Good Fortune** gives failed allied chance effects a 10%, 20%, 30%, 40%, 50% or 60% chance to reroll once at ranks zero through five. A successful gate retries the original probability once; neither the gate nor the retry can trigger another retry. Successful initial rolls, impossible effects and guaranteed effects consume no additional RNG. Only living, deployed providers supply the passive, including while controlled; the strongest provider applies when several are present. Swaps and knockouts change availability immediately. Enemy Euphera supplies its own side with the base 10% tier.

The shared [chance boundary](../../../src/game/chance.ts) covers favorable combat rolls: Critical hits, Dodge, overcoming Blind, passive copying, sharing, reflection, bounces, repeats, and talent or Boon triggers. Uniform target selections, shuffled card order, alternative damage types, Block-or-Thorns/Pearl choices and destination generation remain ordinary random selections. Good Fortune emits committed action feedback when a retry changes a failure into success. Previews use the same seeded boundary on their detached command draft; no extra saved counters or format change are needed.

Twilight Lance removes every Nature, Water and Fire Thorns stack from the chosen enemy before its Light hit, preventing those pools from retaliating. The Purge still happens on a miss and retains every other beneficial or harmful effect. Ordinary Dodge, Critical hits, Block, damage modifiers, card upgrades and room power apply to the damage.

Wish Exchange pools Block from living deployed allies, divides it evenly, and assigns leftover points in battlefield order without creating or losing Block. Backup and knocked-out creatures neither contribute nor receive it. Redistribution is a transfer, so moved Block does not trigger conversion, protection sharing or gain rewards. The subsequent new Block uses ordinary grants and their reactions. Card upgrades and enemy room power scale only that new Block.

Possible Path exchanges the remaining visible hand after its own card has entered discard. It shuffles those existing card instances into the draw pile, then draws the same number through the ordinary draw owner. Identity, ownership, upgrades and temporary-copy flags remain intact. Hidden overflow stays in FIFO order and fills available hand slots normally; it is not part of the exchanged count. Well Read and Good Fortune apply to actual replacement draws. An empty remaining hand does not shuffle or draw. Enemies use Twilight Lance and Wish Exchange on their corresponding opposing/friendly rows and exclude Possible Path because they have no ordinary player hand. Auto-play supports all three player abilities and avoids an empty exchange.

## Artwork provenance and validation record

Source: [Euphera Drive folder](https://drive.google.com/drive/folders/1jm5_8I9N8Q5m6yT4QcN7xKuCupkhzAmq). Portrait: `Euphera_03.png`; originals: `public/art/euphera/`. All other ability artwork is excluded. [Implementation-time review](../../../design/visual-quality/DECISIONS.md#euphera-implementation-review) retains the inspected states, findings, evidence location and verification scope.
