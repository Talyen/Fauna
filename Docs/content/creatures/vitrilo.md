# Vitrilo

The owner selected Glass Cutter, Sunflare Cast, Prism Key and Kilnheart on October 29, 2026. The [authored kit](../../../src/game/content/creatures/vitrilo.ts) owns Health, exact rules and all six passive tiers. Vitrilo is an ordinary recruitable creature outside the first-run starter pool

## Glass Cutter

While Vitrilo is living and deployed, its side's Light ability attacks steal the tier amount of the target's Block for the attacking creature after interception, Negate, reflection and Dodge resolve but before damage. Theft is capped by the target's available Block. A miss, non-attack damage or a Vitrilo in backup does not trigger the passive. Each actual attack delivery, including a repeat or a bounce, resolves separately. The recipient receives Block through the normal grant owner. Removing Block by theft is not damage absorption and does not itself trigger Block-break reactions. Enemy Vitrilo uses the base tier; multiple deployed providers add their amounts

## Abilities

Sunflare Cast is an ordinary targeted Light attack. Prism Key targets a living enemy, Purges one beneficial category using the ordinary removal order and gives the actual removed effect to the acting creature. Block, Armor and Thorns transfer their removed amounts, Dodge preserves its ordinary and temporary parts, and single-use protections transfer as the same protection. Normal grant caps and reactions apply. Effects that cannot be removed, an empty target and a missed or reflected Purge do not grant the original actor anything. A reflected Purge gives its stolen protection to the reflecting creature. Additional removals from explicit Boon effects follow their ordinary rules; direct extra categories from Pearl Sieve are stolen as well. Pruning Crescent does not duplicate Thorns already stolen by Prism Key

Kilnheart restores Health and then grants Block to the acting creature; its primary Health value upgrades while its Block extra remains fixed. Repeats resolve the full ability again. No new saved state is required

## Artwork and evidence

The [Drive folder](https://drive.google.com/drive/folders/14T3JA8J_uEQGkUOa1EYoU_XR7D6dF75f) contains the portrait and both versions of the ability illustrations. The v2 action illustrations and the available portrait are preserved under `public/art/creatures/vitrilo/`; individual source URLs are recorded in the [manifest](../../../assets/manifest.json). The user selected the abilities, not an artwork version. Rendered review, measured balance, hosted CI and platform qualification remain separate from the source selection
