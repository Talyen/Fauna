# Captoad

[Creature index](README.md) · [Current kit](../../../src/game/content/creatures/captoad.ts) · [Authoring contracts](../../CONTENT.md)

Captoad joins ordinary encounter and recruitment pools. Its base passive, Sporecoat, reads "Retaliate with 1 Poison damage when hit"; retaliation scales from 1 through 6 Poison damage at zero through five stars. A landed direct attack triggers once even when Block or Armor absorbs it completely. Dodge, periodic damage, derived damage and retaliation do not trigger it. A knocked-out Captoad cannot retaliate. The Poison packet cannot Dodge, crit or start another retaliation; resolved Poison damage adds ordinary Poison stacks and source attribution, respecting Block and harmful-status reflection.

Mushroom Guard heals only its actor. Bogbound Leap follows [ordinary swap and card-zone rules](../../EXPEDITION_DESIGN.md#knockout-replacement-and-ability-swaps), then draws two, including when alone without backup. Enemy Leap swaps with another living enemy without a draw or extra action; enemy identity remains stable for save validation.

## Artwork provenance and validation record

Source: [Captoad Drive folder](https://drive.google.com/drive/folders/16zyEo4h2IGJGun_C1VqTCqV3U3-HMdGI). Player wording uses Backup; internal save fields retain their existing names.
