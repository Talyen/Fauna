# Pollenmoth

[Creature index](README.md) · [Authoring contracts](../../CONTENT.md)

Pollenmoth is a 23 Health support creature encountered and recruited on ordinary routes. Its abilities: Dazzle Burst deals 3 Light damage to a random living enemy; Petal Shelter gives living deployed allies 2 Block; Bloomwake restores 3 Health to the most injured living deployed ally, including Pollenmoth. Injury is measured by remaining Health percentage, with battlefield order breaking ties. Backup and knockouts are excluded.

Cross-Pollination has six complete passive tiers:

1. Light damage bounces once
2. Light damage bounces once; 50% chance to bounce twice
3. Light damage bounces twice
4. Light damage bounces twice; Health restoration has a 50% chance to bounce once
5. Light damage bounces twice; Health restoration bounces once; 50% chance to bounce twice
6. Light damage and Health restoration bounce twice

Each bounce repeats the original effect amount, with defenses and healing modifiers applied separately. Damage selects a random living opponent not already visited; healing selects the most injured remaining ally missing Health. Bounces cannot revisit a recipient or start another chain. A Dodged initial hit does not bounce; a knocked-out source stops its chain. Full-Health healing attempts do not bounce. Chance rolls and random targets use committed seeded combat randomness, so previews never consume live RNG. Enemy Pollenmoths use their base passive. Healing bounces belong to Pollenmoth's own healing abilities, not another creature's healing or automatic recovery.

## Artwork provenance and validation record

The creature portrait and three dedicated action illustrations are unchanged copies from the user's Pollenmoth Google Drive folder. Their original URLs and rights notes are recorded in the asset manifest. Prepared assets retain the native 4:3 creature and 3:4 action compositions. Rendered gameplay review remains pending.
