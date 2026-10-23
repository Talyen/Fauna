# Prismram

[Creature index](README.md) · [Authoring contracts](../../CONTENT.md)

Prismram is a 30 Health crystal defender found in ordinary combat packs and collected through recruitment. All three abilities cost 1 Mana:

- **Prism Charge:** Deal 6 Physical damage
- **Faceted Ward:** Gain 3 Block; Reflect the next harmful status effect
- **Spectrum Lance:** Deal 4 Light damage; Purge target: remove 1 effect

**Refraction** gives harmful status effects received a 10%, 20%, 30%, 40%, 50% or 60% chance to redirect to a random living enemy at zero through five stars. Enemy Prismram always uses 10%. Faceted Ward guarantees the next reflection before passive chance is considered; repeated Wards refresh one pending reflection rather than stacking. The pending effect persists across turns, swaps and current-format saves, resets for each battle and can be Purged.

Reflection transfers the incoming Burn, Poison, Bleed, Stun or Freeze buildup at its original post-mitigation strength; direct damage still lands on the original target. The recipient uses normal control thresholds and immunity. Reflected effects belong to the reflecting creature and cannot reflect again. Only living deployed opponents are eligible, including the attacker. Fully blocked damage, periodic ticks, retaliation and immune control applications do not consume a Ward or roll Refraction.

## Artwork provenance and validation record

The landscape portrait (`04.png`) and three portrait ability illustrations are unchanged PNGs from the user's [Prismram Drive folder](https://drive.google.com/drive/folders/1_-fYMW69ianG7xHrSc0fukfMX_kl42Vb), copied into `public/art/prismram/`. The manifest records the original file URLs. Creature and ability artwork use the shared prepared-media pipeline for battle, inspection and Collection. Source images were visually inspected; in-game rendered acceptance remains pending.
