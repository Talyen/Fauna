# Parhelion

Use the [authored kit](../../../src/game/content/creatures/parhelion.ts) for current values and complete tiers.

Parhelion is an ordinary support creature, “The sun upon the snow”

## Sunthaw

The creature whose buildup is cleansed receives the healing. Each living deployed Parhelion contributes its current tier to a friendly deployed recipient, including itself. Duplicate providers add their amounts; reserves and knocked-out providers contribute nothing. Enemy providers use their base tier, independently of the player's Collection rank

Any actual Freeze buildup Cleanse qualifies, including Polar Reprieve, Stillara's Thaw Path, ordinary Cleanse and Dodge's Unburdened. Clearing Stun, removing another harmful effect, an empty Cleanse, normal control recovery and battle setup grant nothing. Active Freeze is distinct from buildup: Polar Reprieve retains the existing buildup-only thaw behavior and does not release a Frozen creature. Removing active Freeze without buildup does not trigger Sunthaw

Healing follows ordinary received-healing modifiers, maximum Health and healing Boons, without revival, ability bounces or card-only overhealing rewards. Existing Renewal and Sin-Eater's Lantern rewards still resolve independently. Removal precedes healing, so another removal or a repeated Reprieve cannot heal the same buildup twice.

The nearest overlap is Renewal's general Cleanse healing and Sin-Eater's Lantern. Sunthaw specializes in Freeze and supplies a friendly field effect through a creature slot, including when another creature provides the Cleanse. Its payoff is entirely conditional on enemies applying Freeze; it cannot heal arbitrary injuries on demand

## Artwork

The selected sources are unchanged PNGs from [Parhelion's Drive folder](https://drive.google.com/drive/folders/1Dk_ZU0a9p_GklN_EoJ3-qj13t-UDu5eU). The portrait shows an alert white hare under three suns, with blue mountain shadows and golden light on water. Warm footprints and flowers support Polar Reprieve's thaw and recovery; gathered solar ribbons support Sundog Reservoir; the brilliant snow wall supports Whiteout Waltz's Freeze and Blind

Originals live under `public/art/creatures/parhelion/`; the [asset manifest](../../../assets/manifest.json) owns provenance and prepared derivatives. The user's selection establishes the kit and source artwork choice, with rendered observations recorded separately

## Progression and play

Polar Reprieve trades damage for group buildup removal and a fixed draw; repeating it does not recreate buildup. Sundog Reservoir provides net Mana when capacity permits; ordinary enemies cannot use it and omit Reprieve's draw. Whiteout Waltz pairs group Blind with modest Freeze damage.

The kit depends on Freeze to trigger its passive and on teammates to handle fast or periodic damage. It remains outside the first-run solo starter pool. These are design estimates; higher upgrades and Talent/Boon combinations still need measured balance review.
