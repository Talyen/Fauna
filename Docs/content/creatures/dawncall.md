# Dawncall

[Creature index](README.md) · [Authoring contracts](../../CONTENT.md)

Dawncall is a 24 Health support creature available through starter drafts, ordinary encounters and recruitment. All three abilities cost 1 Mana:

- **Dawn Cry:** Cleanse 1 harmful effect from all allies; Draw 1 card
- **Sunwing Sweep:** Deal 2 Light damage to all enemies
- **Morning Bloom:** Restore 2 Health to all allies

**Early Bird** grants the first attack each turn 20%, 35%, 50%, 65% or 80% additional Critical hit chance at zero through four stars. At five stars, the first attack each turn is a guaranteed Critical Hit against every enemy it hits. Bonuses add to the ordinary allied 5% Critical hit chance; each landed target rolls independently below the guaranteed tier. Dodge still prevents damage. The first attack consumes the opening opportunity even if it misses; support abilities, periodic damage, retaliation and derived packets do not consume it. Repeats are subsequent attacks. The opportunity persists through swaps and current-format resume, refreshes at the owner's next turn even in backup or control, and resets for each battle. Enemy Dawncall uses the base 20% bonus plus the ordinary 5% Critical hit chance, independently for each landed target.

Dawn Cry removes one harmful category from each living deployed ally through ordinary Cleanse rules, then draws one card even if no harmful effects were present. Morning Bloom heals each living deployed ally, including Dawncall. Neither affects backup nor revives knocked-out creatures. Enemy Dawn Cry Cleanses living enemies and omits the player-only draw; enemy Morning Bloom uses ordinary encounter healing scaling. The current save format stores the opening-attack receipt.

## Artwork provenance and validation record

The original landscape portrait (`03.png`) and Dawn Cry, Sunwing Sweep and Morning Bloom action PNGs come from the user's [Dawncall Drive folder](https://drive.google.com/drive/folders/1yPgufTCHVyQTjXPWwlGwkGz0H7k38EtR). Unchanged originals live in `public/art/dawncall/`; the manifest records each original URL and the shared prepared-media pipeline supplies lossless WebP derivatives. Source artwork was visually inspected; rendered gameplay and balance acceptance remain pending.
