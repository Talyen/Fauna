# Wendlet

The owner selected Living Shadow, Midnight Mantle, Umbra Snare and Borrowed Silhouette on October 28, 2026. The [authored kit](../../../src/game/content/creatures/wendlet.ts) owns Health, exact rules and all six passive tiers. Wendlet is an ordinary recruitable creature outside the first-run starter pool

## Living Shadow

When a living deployed Wendlet loses Block to ordinary turn decay, it grants the most injured living deployed ally the tier percentage of the Block actually lost, rounded normally. Wendlet can receive the grant; ties use battlefield order. No Block loss, knockout, reserve decay, Purge or damage absorption triggers it. Normal Block grant caps, conversion, sharing and Boon reactions apply. Enemy Wendlet uses its base tier; no new saved state is needed

## Abilities

Midnight Mantle gives Wendlet temporary Dodge and self Block. The Dodge value upgrades; the Block extra stays fixed. Umbra Snare deals Stun damage through ordinary attack, control and upgrade rules

Borrowed Silhouette chooses uniformly among the three authored abilities of each living backup using seeded randomness, creates a level-zero temporary copy owned and played by Wendlet, draws it using the ordinary hand, overflow and draw-reaction owner, then grants 1 Mana. The card keeps its original ability effects and uses Wendlet as its actor; the backup remains in place. Its temporary copy is discarded and recycled normally until battle end or Wendlet leaves deployment. With no living backup or no card capacity, no copy is created and the Mana grant still resolves. Repeats resolve both effects again; normal Mana and card limits apply. Ordinary enemies have no backup deck and do not select this ability

Copies preserve source species through Well Read copies and current-format save/resume. Borrowed Legendary abilities can create actor-owned Echoes, Pearls or Pendulums using the shared rules; a borrowed ability does not grant the backup's passive. Oathara can play a fallen Wendlet's abilities under Unfinished Journey and owns any cards or Minions it creates. Generated cards and Minions leave with their acting owner through existing cleanup

## Artwork and evidence

The owner narrowed the [Drive collection](https://drive.google.com/drive/folders/199repgT4C7QM3F5y3C96M6KLZKJo4BDK) to the portrait and the three v2 illustrations in this kit. Originals are preserved under `public/art/creatures/wendlet/` and their source URLs are recorded in the [manifest](../../../assets/manifest.json). Measured balance, hosted CI and platform qualification remain separate from local checks and rendered review
