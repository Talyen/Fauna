# Dunefox

[Creature index](README.md) · [Authoring contracts](../../CONTENT.md)

Dunefox is a 24 Health evasive support creature available through ordinary encounters, recruitment and starter drafts. Each ability costs 1 Mana:

- **Sandburst Pounce:** Deal 6 Physical damage
- **Dune Whirl:** Deal 1 Physical damage to all enemies; Blind all enemies
- **Mirage Step:** Gain 30% Dodge until your next turn; Draw 1 card

**Shifting Sands** reads "Allies gain 15% of your Dodge chance" at zero stars and scales to 20%, 25%, 30%, 35% and 40% at one through five stars. Other living deployed allies receive that fraction of Dunefox's intrinsic current Dodge chance, including the ordinary 5%, talents and temporary bonuses, before adding received Shifting Sands bonuses. Multiple providers contribute independently without recursive amplification; Dunefox does not benefit from its own aura. Total Dodge remains capped at 75%. For example, Mirage Step raises an otherwise unmodified Dunefox to 35% Dodge, sharing 5.25 percentage points at the base tier. Knockouts and backup providers contribute nothing; swaps, control and expiring bonuses update the live aura automatically. Enemies use the base tier.

Blind grants a 50% chance to miss the next attack and expires after that attack whether it hits or misses. A single seeded roll covers all recipients and supplemental damage packets of that attack; support abilities, skipped turns, periodic damage and retaliation do not consume Blind. A miss emits the existing Dodge outcome and icon for each recipient and activates ordinary Dodge rewards, including against a recipient unable to Dodge normally. Blind is a harmful, non-stacking status that can be Cleansed or reflected once through the existing harmful-status owner. Dune Whirl applies Blind to surviving enemies after its damage, including enemies that Dodged that damage.

Mirage Step grants a separate temporary Dodge bonus, removed at the start of the owner's next turn, including in backup or on a skipped turn. Purge removes both ordinary and temporary granted Dodge together; unrelated permanent Dodge survives ordinary expiry. Enemy Mirage Step grants the same 30% Dodge and omits the player-only draw. The current save format stores Blind and temporary Dodge and rejects obsolete development saves without migration.

## Artwork provenance and validation record

These retained notes record source selection and verification at implementation time; they do not establish current rendered acceptance

The unchanged landscape portrait and three action PNGs come from the user's [Dunefox Drive folder](https://drive.google.com/drive/folders/1NI9Ud-lqluU5whB6A3066vh2Oop5DUP3). Each original file URL is recorded in the asset manifest; the shared preparation pipeline retains native 4:3 creature and 3:4 action compositions. Source artwork was visually inspected; in-game rendered review remains pending.
