# Captoad

[Creature index](README.md) · [Authoring contracts](../../CONTENT.md)

Captoad has 30 Health and joins ordinary encounter and recruitment pools. Its base passive, Sporecoat, reads "Retaliate with 1 Poison damage when hit"; retaliation scales from 1 through 6 Poison damage at zero through five stars. A landed direct attack triggers once even when Block or Armor absorbs it completely. Dodge, periodic damage, derived damage and retaliation do not trigger it. A knocked-out Captoad cannot retaliate. The Poison packet cannot Dodge, crit or start another retaliation; resolved Poison damage adds ordinary Poison stacks and source attribution, respecting Block and harmful-status reflection. Enemies use the same base passive.

All three abilities cost 1 Mana:

- **Spore Puff:** Deal 2 Poison damage to all enemies
- **Mushroom Guard:** Gain 3 Block; Restore 3 Health
- **Bogbound Leap:** Swap out for a random backup; Draw 2 cards

Mushroom Guard heals only its actor through ordinary card-healing rules. Bogbound Leap first selects a random living backup with seeded RNG, preserving both creatures' Health and effects while updating the saved formation. It removes the departing creature's cards from hand, overflow, draw and discard; the incoming three cards are shuffled into the draw pile before drawing two, making the new kit immediately drawable. Other creatures' cards retain their zones. With no living backup, it swaps battlefield positions with a random living ally; alone it still draws two. Enemy Leap swaps with another living enemy and has no shared-hand draw. Reordering never gives an enemy an extra action in that turn window and retains enemy identity for save validation. Knockout replacement retains existing card-slot positions; there is no free manual Swap.

## Artwork provenance and validation record

These retained notes record source selection and verification at implementation time; they do not establish current rendered acceptance

The unchanged portrait and three ability PNGs come from the user's [Captoad Drive folder](https://drive.google.com/drive/folders/16zyEo4h2IGJGun_C1VqTCqV3U3-HMdGI). Each source URL is recorded in the manifest; native 4:3 and 3:4 compositions are retained. Prepared output checks do not establish rendered acceptance. Player-facing vocabulary uses Backup in place of Reserves; internal save fields retain their existing names.
