# Creature inspection options

These are standalone design studies, not production changes or accepted references. On October 22, 2026 the user rejected the current inspection and its first compact proposal, requested that the passive and its ranks remain visible, and asked to see various options.

All three show the same Mossguard at two stars. The creature name and ability names/rules remain hover/focus details. All artwork uses the shared ArtCard, with unchanged source illustrations and native aspect ratios. The miniature ability row intentionally changes relative artwork scale in these studies; production sizing contracts have not changed.

| Option | Visible passive information                                                                          | 1280×720, 125% text      | 1920×1080, default text  |
| ------ | ---------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------ |
| A      | All six complete tier effects; check marks the current rank                                          | [A](captures/a-1280.png) | [A](captures/a-1920.png) |
| B      | All six rank controls; selected tier effect beneath them; check marks the current rank independently | [B](captures/b-1280.png) | [B](captures/b-1920.png) |
| C      | One shared rule and all six rank values; current value highlighted                                   | [C](captures/c-1280.png) | [C](captures/c-1920.png) |

Open `/design/inspection-options/index.html?option=a` in a task-owned quiet preview; replace a with b or c for the other studies. These query controls are not proposed player UI. Thumbnail activation opens enlarged action artwork; Back/Escape restores that thumbnail. A second Back/Escape closes the study. The selection button only closes the sample, and these studies never read or write player saves.

The compact C rule is specific to Mossguard's single changing percentage. General treatment for passives with multiple effects or changing conditions remains a design decision; do not reduce their full rules to a numeric table without a faithful representation.

## Review evidence

The [capture manifest](captures/evidence.json) records six Chromium captures: every option at 1280×720 with 125% text and at 1920×1080 with default text, all with reduced motion. The full frames, tooltips and B's five-star state were inspected. Focused review checked modal fit without scrolling, all six tiers or controls, hover ability disclosure, keyboard rank changes, action enlargement and focus return. These are isolated studies using shared player components, not a production player-flow validation.

All three await user preference. Only Mossguard was rendered. Full CI, macOS desktop, Windows packaging, physical controllers, Steam and Steam Deck were not run. No design has been applied to main.
