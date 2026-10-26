# Wisterelle

[Creature index](README.md) · [Kit](../../../src/game/content/creatures/wisterelle.ts) · [Discard draws](../../../src/game/card-zones.ts) · [Regressions](../../../tests/unit/game/creatures/wisterelle.test.ts)

Wisterelle is a support creature built around the flowering railway station. The owner selected Forgotten Junction, Lantern Fare, Left Luggage and Lost and Found on October 25, 2026. Its unchanged portrait and three selected action illustrations come from the [Wisterelle Drive folder](https://drive.google.com/drive/folders/1xj0u7m4-QZa4eCDmX6WIPciExhHnp5x5); exact file IDs and rights provenance remain in the asset manifest.

## Kit and ownership

Lost and Found restores Health to the original living owner of a card drawn directly from Discard; the authored kit owns the complete rank progression. Only the living deployed Wisterelle provides restoration; a fallen or backup Wisterelle does not. The roster permits only one individual per species. Shared Food has no owner and receives no passive healing. Borrowing a fallen creature's card does not revive its owner or redirect the restoration to its borrower.

Direct recovery uses the same Discard draw owner, including Cadenza and Almanelle. The actual draw can trigger Well Read and draw-related Boons, but inserted copies and promoted overflow are not extra draws and do not heal again. Shuffling Discard into the draw pile and later drawing normally does not trigger Lost and Found. Dream Yo-Yo returns are also separate from drawing from Discard. Restoration uses ordinary healing modifiers and Boons, without card-only overhealing rewards.

Forgotten Junction targets a chosen living backup. The existing formation/swap owner exchanges the creature and its kit before drawing one card. Missing, fallen and deployed targets are rejected without spending Mana or RNG. Repeats can draw again but cannot swap a creature that has already departed. The single draw and chosen replacement do not grow with ability upgrades.

Lantern Fare targets a chosen living injured ally, restoring 3 Health and refunding 1 Mana. Its Health value gains two per ability level; the Mana refund remains one. It cannot be spent on a full-Health or fallen target. Enemy Wisterelle uses the same healing with ordinary room scaling; the player Mana refund is omitted. Ordinary enemies have neither backup rosters nor card piles, so Forgotten Junction and Left Luggage remain player-only resource abilities.

Left Luggage draws a random card owned by another living deployed ally and refunds one Mana. It excludes Wisterelle’s own cards, their copies and shared Food. It is unavailable unless Discard already contains an eligible card; rejected commands preserve state and RNG. No free play or Consume is involved. The unique-species roster prevents another Wisterelle from recycling Left Luggage back.

Wisterelle is appended to the catalogs and two mixed encounter packs for recruitment. Its support-only kit is excluded from the first-run starter pool. All abilities cost one Mana before explicit modifiers.

## Strategic assessment

Recover a useful ally card to restore its owner, use Lantern Fare to help an injured ally without reducing available Mana, then use Forgotten Junction when a different creature would serve the formation better. Recovery is less reliable with a crowded Discard; an empty Discard provides no retrieval or passive healing. The kit deals no direct damage and depends on offensive teammates. Its nearest overlaps are Cadenza/Almanelle's recovery and Dulcera's restorative support, but its passive ties restoration specifically to the recovered card's owner rather than card-count or swap triggers.

Portrait selection is Wisterelle_03. The three action selections are ForgottenJunction, LanternFare and LeftLuggage; the other five action illustrations are retained upstream and unused. The branching switch supports deliberate backup choice, rekindled lanterns support restoration/Mana, and the open trunk supports retrieval. Source inspection, rendered verification, artistic acceptance and measured balance remain separate facts.

## Verification evidence

[Implementation evidence](../../task-evidence/wisterelle.md) retains dated checks, rendered conditions, interactions, source identities and limitations.
