# Battle presentation

Read the relevant section for the changed flow. [Shared UI rules](../UI.md) own accessibility, tokens, layout and the proportional review procedure; [menu design](../MENU_DESIGN.md) and [journey design](../EXPEDITION_DESIGN.md) own navigation and progression. Shared [presentation lifetime](../UI.md#presentation-lifetime) rules apply to all effects below. Implementation lives in the [battle owners](../../src/ui/battle/).

## Battle composition

Apply the [copy and layout rule](../UI.md#copy-and-layout): communicate combat choices through grouping and action placement without taglines, helper text or secondary labels.

- Horizontally centered enemy row above horizontally centered active creatures, with a compact overlapping fan at the bottom. Hand cards match creature artwork-frame height even while rotated, raised, or selected. Uniform compensation preserves each original aspect ratio. Keep the chosen overlap.
- Creature-first scale and spacing follow the reviewed A composition. Selection stays raised in its hand slot. Hover/focus lifts a card; selected cards lift further.
- Thin 4px health bars sit inside battlefield frames, aligned with the bottom border. Status icons sit below each frame, with horizontal pagination for more than three effects. Numeric health totals never appear in hover/focus tooltips, including pinned inspection. Block retains its external icon and count. Guaranteed forecasts show health-bar changes and exact effect amounts without visible HP totals. Chance forecasts retain the current Health bar or Block count whenever alternatives disagree, showing short possible outcomes or Dodge/Critical notices instead. Possible knockout is distinct from guaranteed knockout. Hidden draws or exhausted projection budgets show Outcome varies, while the selected action retains its authored rules. Previews, cancellation and target changes never consume live RNG or save progression.
- Hide enemy intents and battle, turn, draw and discard counters. Mana uses Alchemy's original full/spent crystals, sockets, fade and glint; provenance is in the battle-layout sample README. Overflow Mana uses the same crystals and spending preview; more than six crystals wrap into rows of four above the Draw Pile, including the nine-point capacity with Rainkeeper.
- Acting creatures use a quiet neutral external outline; valid recipients have external corner brackets, with gold brackets on the active recipient. A thin arrow connects the actor to the active recipient outside the artwork. Mouse selection waits for a hovered recipient and clears its forecast on leave; keyboard/controller selection immediately previews the remembered valid recipient. Click the target or press Enter/controller A to commit, even with only one valid recipient. Cards with automatic recipients (self, team-wide, random or most injured), utility cards and card-driven swaps play immediately on tap, Enter or controller A, without target selection or confirmation. Only cards requiring a chosen enemy or ally enter target selection; there is no extra Play button. A compact selected-action summary keeps the action name, final rules and recipient or selection prompt visible.
- A/D switches valid targets, remembering the last valid enemy/ally. W/S moves between rows; A/D moves within a row. Battle has no pinned inspection, including on right-click or I/controller X. Creature activation only chooses a target while an action is selected. Escape/controller B cancels, then opens Pause. End turn/controller Y is immediate; spending the final Mana automatically settles the enemy turn when Auto-end turn is enabled (the default).
- Enemy attacks present sequentially through floating numbers, bounded movement and sound

## Floating combat feedback

Fauna adapts Alchemy's floating feedback to its three-creature rows. Committed events carry damage type, Critical and periodic flags, and structured status/outcome identities. Presentation never parses prose to discover rules. Descriptive text remains in the accessible battle log. Damage, healing, Block and additive status gains use typed icons and signed numbers. Notices use icons without visible prose; Cleanse/Purge pair their icon with each affected effect, immunity pairs Shield with the rejected status, skipped turns pair Timer with the control effect, and Death's Door retains Skull. Existing hand/resource readouts acknowledge draws and Mana; this work adds no Alchemy-only reactions or gameplay.

### Aggregation

Within an action, sum actual damage packets by recipient and type, retaining whether any packet was Critical. Keep costs and non-impact losses separate. Notices precede losses, then gains, in stable order. Suppress redundant zero entries when the action has another meaningful result; an otherwise ineffective action retains its effect icon and 0. Identical notices deduplicate.

Cross-action additive merges match recipient, effect, type/resource, impact/periodic identity and direction within 250ms of the original burst. Non-additive values never sum across actions. Merges preserve entry/burst IDs, animation, start and expiry.

Reserve initial numeric digits plus one extra digit and the sign; overflow becomes a separate entry. Unmatched incoming entries get a new burst and lifetime. Evict before merging when necessary so fresh effects cannot disappear with an old burst.

### Timing

The numeric base is 37.8 CSS pixels at 100% text, bold, with proportional icons, tabular reserved numbers, dark outlines and static shadows. Values live in `src/ui/tokens.css`. Pop from 0.5× to 2× by 150ms, settle to 1.8× at 200ms, hold through 400ms, then shrink to 1× by 900ms. Rise with an accelerating curve after the hold, up to 240px, and fade over the final 250ms of the 1,100ms lifetime. Critical damage retains its type and size, adding a pale 140ms flash and gold 480ms glow. Further merges do not restart an existing Critical accent.

### Placement

One noninteractive viewport overlay follows artwork bounds through portrait motion and layout changes, above card flights and below modals. Newest actions use the lower portrait anchor; older actions move upward over 150ms. Reserve space for the full pop. Up to three numeric entries use one centered column; larger bursts use two, with notices spanning both.

Keep at most three bursts per creature. Clamp travel and placement to the viewport, offset overlapping creature groups vertically, and fade older groups early when space is exhausted. Evicted groups never reappear. Artwork and numeric text never shrink to fit the viewport. End turn keeps the battlefield in its stable viewport so resolved outcomes remain visible; keyboard/controller command focus retains its existing owner.

### Motion and interruption

Reduced motion removes pop, travel and repositioning, retaining the same lifetime, semantic icons and steady Critical glow. Switching motion back on does not replay existing feedback. Interrupted sequences reveal remaining numbers without replaying sound or impact. Pause and teardown also clear feedback and release portrait tracking, which runs only while bursts exist.

## Combat movement and sound

Active Stunned creatures show Alchemy's eight orbiting gold stars over their artwork; Frozen creatures gain an edge frost veil and twelve growing ice crystals. The shared ArtCard layer follows committed control state for allies and enemies, clears on recovery or knockout, and stays inside the artwork without changing target bounds or blocking input. Existing status icons and rules remain outside the artwork. Reduced motion retains static stars and crystals; pausing stops their animation.

Separate attack and support wrappers use Alchemy's 950ms wind-up/swing and 520ms support brace without overwriting ArtCard interaction transforms. Adapt its outcome-driven impact/cue selection and bounded recoil rather than copying artwork or audio assets. Each presented action selects one strongest nonzero cue, with damage winning ties over healing and block. Positive health loss applies a short 180ms portrait recoil of 3px for periodic or small hits, 6px for medium hits, and 10px for large hits; fully absorbed and ineffective hits have no health-loss recoil. Recoil is bounded per creature and disabled with reduced motion. Floating feedback retains its damage type and timing.

Prepared recorded cues distinguish combat outcomes, healing, gaining Block and absorption; media selection and provenance belong to the [prepared asset contract](../CONTENT.md#prepared-assets). Audio follows the shared unlock/preferences/lifetime rules; unavailable devices or autoplay denial leave play usable. Desktop autoplay supports controller-only play. Visual aggregation never invents extra impacts or sounds.

## Battle interaction decisions

- Enemy details open below their artwork and readout; ally and hand details open above. Radix collision handling may shift/flip to remain on-screen. Selecting an action closes its tooltip while targeting; hovering/focusing the card again restores its rules. While targeting, creature hover/focus prioritizes forecasts; full creature abilities are available in Collection through Pause.
- Health loss is striped on the bar, with exact typed Health damage beside the target and absorbed damage labeled separately. Block previews show old → projected Block, including depletion to zero. Status forecasts show gains, removals and changed stacks, including effects on creatures other than the chosen recipient. Forecast readouts reserve space and wrap their full outcomes without scrolling or moving the artwork. Lethal previews add a small skull alongside the health bar.
- Invalid targets dim slightly; knocked-out creatures retain their slots with dimmed grayscale artwork and empty health bars. Empty battlefield clicks cancel selection.
- Selected cards softly fade the Mana crystals they would spend. Actual Mana changes only after acceptance. Unavailable cards stay dimmed and inspectable; activation gives a short shake and quiet denial cue, with a brief visible reason such as Not enough Mana or the acting creature being Stunned/Frozen.
- Mouse use stays hover-driven: no programmatic battle targeting focus, automatic hand focus, focus-only tooltip or focus lift. Navigation keys, Tab and controller navigation intentionally activate focus. After play, keyboard/controller focus moves to the nearest remaining hand slot. Pointer selection itself still lifts the selected card.

The shared [keyword catalog](../KEYWORDS.md) assigns every current and planned keyword a semantic `--keyword-<id>` foreground. Current resource and damage tokens alias that palette. Card prose, passives, glossary definitions, talent tabs and XP feedback consume the same identity. Planned keywords remain outside automatic prose highlighting and the player glossary until their rules are implemented.

## Hand transfers

The existing HandMotion owner presents Alchemy's sequential draw and reverse-order discard flights: 500ms per card, divided by 1.4 for three-card batches and 1.6 for larger batches, cubic travel with a bounded arc, and an uninterrupted ease-in-out half-turn. Draws reveal the copied card back before the action face; discards reveal the top-card region of the copied discard pile and land on that same region. The hand follows live slot geometry, including additional overlap and 320ms reflow retargeted from the currently visible interrupted pose. A new turn discards and redraws repeated card identities as well as changed cards. Waiting discards remain visible until their own departure.

Opening draws run when entering a new battle; loaded battles settle directly. Transfers settle on activation, pause, resize, blur, reduced motion or teardown. Pointer movement alone does not cancel flights.

## Layout

Both rows reserve three positions at one fitted artwork size. A Legendary occupies the center and its Minions the sides. The hand uses a six-degree fan step and five-pixel quadratic drop.

The hand shows at most six playable cards. FIFO overflow has no count, controls or separate inspection. Plays promote waiting cards in draw order; End turn discards the visible hand and retains overflow.

Battle keeps enemy and player rows, target feedback, the six-card hand, Mana, pile inspection and End turn reachable simultaneously. The battlefield centers vertically in the space above the bottom hand at every supported viewport. Compact heights use a side rail for targeting feedback, with equal space on the opposite side to keep both artwork rows horizontally centered. Effects and Block sit below each frame; thin health bars sit inside its bottom edge. Alchemy's Draw Pile and Discard Pile artwork uses portrait ArtCards at 80% of hand-card width and height. Mana/Draw, the overlapping hand, and End turn/Discard form one centered bottom group, with a stable reserved hand area as cards enter and leave. Knockout replacement appears only when required; there is no free Swap control. Side columns keep their size; additional hand overlap accommodates supported narrow viewports. Auto-play is a Play/Pause icon Button beside the upper-right menu, with an accessible pressed state. The hand remains an overlapping quadratic fan at the bottom, including its authored partial bottom-edge clipping; every visible hand card must have a real selectable hit area and full inspection. This is the sole artwork clipping exception and never creates a scroll area. Screen-reader-only content may retain its accessibility clipping.
