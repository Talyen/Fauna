# Pollenmoth

[Creature index](README.md) · [Current kit](../../../src/game/content/creatures/pollenmoth.ts) · [Authoring contracts](../../CONTENT.md)

Pollenmoth is a support creature encountered and recruited on ordinary routes. Bloomwake uses the shared most-injured living-ally targeting, including Pollenmoth. Injury is measured by remaining Health percentage, with battlefield order breaking ties. Backup and knockouts are excluded.

Cross-Pollination has six complete passive tiers:

1. Light damage bounces once
2. Light damage bounces once; 50% chance to bounce twice
3. Light damage bounces twice
4. Light damage bounces twice; Health restoration has a 50% chance to bounce once
5. Light damage bounces twice; Health restoration bounces once; 50% chance to bounce twice
6. Light damage and Health restoration bounce twice

Each bounce repeats the original effect amount, with defenses and healing modifiers applied separately. Damage selects a random living opponent not already visited; healing selects the most injured remaining ally missing Health. Bounces cannot revisit a recipient or start another chain. A Dodged initial hit does not bounce; a knocked-out source stops its chain. Full-Health healing attempts do not bounce. Chance rolls and random targets use committed seeded combat randomness, so previews never consume live RNG. Healing bounces belong to Pollenmoth's own healing abilities, not another creature's healing or automatic recovery.

## Artwork provenance and validation record

Source: the user's Pollenmoth Drive folder (file URLs in the manifest). Rendered gameplay review was pending.
