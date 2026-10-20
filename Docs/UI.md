# Fauna design system

Fauna's screens are game surfaces. Show cards, decision-relevant state, and the actions required to play. The background is solid black (`#000`). No promotional copy, decorative chrome, permanent save-success indicators, or visible combat log.

Screen composition is mostly center-aligned: headings, content groups, artwork captions, and primary action rows. Preserve paired numeric alignment, readable rule paragraphs, horizontally scrolling tabs, and battle controls whose positions convey meaning.

## Shared components and enforcement

Use source-owned shadcn/ui for every standard UI control and its interaction behavior. Current approved primitives: Button, Dialog, AlertDialog, Tooltip, Tabs, Switch, RadioGroup, and Progress. Settings uses a sound Switch and labeled text-size RadioGroup; End journey uses AlertDialog with Cancel initially focused and no outside-click dismissal. Preserve native Tab, arrow-key, Space, Enter, Escape, focus trapping and return behavior. W/A/S/D and gamepad navigation adapt to those components rather than replacing their state machines.

`scripts/shadcn-registry.json` explicitly lists reviewed primitives and their Radix owners. New standard controls must come from upstream shadcn, retain provenance, and be registered during review. Do not build custom toggles, tabs, dropdowns, dialogs, or clickable layout elements. The check rejects raw native controls, handmade widget roles, direct Radix imports, unregistered primitives, competing UI libraries and inline visual styles. These source guards complement interaction tests; they cannot prove all behavior by static analysis.

Explicit gameplay compositions are artwork cards, the hand fan, targeting, mana crystals, combat feedback and forecast overlays on shadcn Progress bars. They use shadcn controls where interactive and shared tokens; no general-purpose custom widget is permitted under this exception. Black canvas, typography, semantic combat colors and minimum hit areas remain project theme decisions.

ArtCard is the sole artwork surface: exactly one image, no text or UI overlays. Creature artwork stays 4:3 landscape and action artwork 3:4 portrait, with contain rendering; never stretch or crop to another ratio. Names, rules, health numbers and traits belong in hover/focus details or centered pinned inspection. Dynamic progress geometry is owned by Progress; hand geometry by FanSlot. All visual colors, text sizes, and radii use shared tokens. The CI static gate (`npm run check:full`) enforces component ownership, palette and typography rules.

## Battle composition

- Enemy row above active creatures, with a compact overlapping fan at the bottom. Hand cards match creature artwork-frame height even while rotated, raised, or selected. Uniform compensation preserves each original aspect ratio. Keep the chosen overlap.
- Creature-first scale and spacing follow the reviewed A composition. Selection stays raised in its hand slot. Hover/focus lifts a card; selected cards lift further. The current composition fits 1920×1080 and 1280×800 at normal text size.
- Health bars only on the battlefield. Numeric health appears only in hover/inspection and accessible descriptions. Block retains its external icon and count. Forecasts show health-bar changes and exact effect amounts without visible HP totals.
- Hide enemy intents and battle, turn, draw and discard counters. Mana uses Alchemy's original full/spent crystals, sockets, fade and glint; provenance is in the battle-layout sample README.
- Acting and targeted creatures use external outlines and a thin targeting line. Click the target or press Enter/controller A to commit targeted cards. Team-wide actions use Play. There is no extra targeted Play button.
- A/D switches valid targets, remembering the last valid enemy/ally. W/S moves between rows; A/D moves within a row. I/controller X or right-click opens pinned inspection. Escape/controller B cancels, then opens Pause. End turn/controller Y is immediate; spending the final Mana automatically settles the enemy turn.
- Floating numbers, bounded movement and sound consume ordered committed events. Enemy attacks present sequentially. Animations never determine outcomes or block input.

## Other screens

- Starter selection uses three artwork columns, names and an external Selected check beneath artwork. Clicking opens the shared creature inspection with Choose [creature]; choosing returns to the grid. Begin journey remains separate and unavailable until one starter is chosen. Browsing, action inspection and cancellation preserve the choice. All unlocked species remain available; extra choices form additional rows.

Menus and Collection follow [menu design](MENU_DESIGN.md). Progression and rewards follow [journey design](EXPEDITION_DESIGN.md).

- Main menu is a centered vertical list with a gold default Button for Continue/New journey/Resume and ghost Buttons for all other choices; launching never automatically resumes gameplay. Pause is a centered overlay. Talents is full screen with a keyword artwork overview opening dedicated trees. Each tree has ten unique talents in rows of 1, 2, 3, and 4, with icon, name, and full effect visible. Back returns from a tree to the overview, then to the originating menu. Purchases are immediate and reset operates on the whole category. This approved direction replaces the current tabbed six-talent implementation.
- Creature hover/focus details contain only name, exact health, current effects, and passive; no action lists. Creature inspection uses the stacked layout: 4:3 artwork above the passive and three 3:4 action thumbnails. All art remains full bleed without overlays. Enemy inspection shows battle state followed by a separately labeled Species kit with the collectible passive/cards; intents stay hidden.
- Opening a thumbnail replaces the contents of the same shadcn Dialog. Previous/Next buttons outside artwork, A/D, and controller left/right cycle through the species' three actions. Back/Escape/controller B returns to the creature and restores focus to the current action thumbnail. A subsequent Back closes inspection and restores the original opener. X/outside-click closes the whole dialog using standard Dialog behavior. Direct hand/deck action inspection cycles the same kit and closes on Back; it does not introduce a creature parent view. Card rules show final effects with no bonus breakdown. Definitions stay exclusively in the menu Glossary.
- Collection orders unlocked species first. Locked artwork is grayscale and noninteractive, with no tooltip or unlock requirement. Unlocked creatures open centered inspection.
- Destinations use one centered Victory screen with compact automatic earnings and a single destination-specific choice. Ordinary combat shows Choose a Recruit with the three defeated enemies, including owned and repeated species; intermediate bosses offer portrait relic choices. Both rows are centered in the same reserved choice area so headings and Skip keep consistent positions. Names sit below the artwork. Selecting or skipping advances directly, without Continue or a second reward decision. Replacement stays within this screen with Cancel available. No eligible choices skip the screen; the final boss and defeat go directly to results. Journey results show only the outcome and permanent gains with keyword names, levels and XP bars; available talent points belong on Talents. Omit teams, creature unlocks, journey statistics and temporary relics. Results can be reopened from the main menu until a new journey begins. Relics use blank portrait 3:4 ArtCards with centered external names and hover/focus effects. Development saves do not retain older reward flows.

- New journeys show three location ArtCards with names and Combat labels beneath them; the biome boss has one location with a Boss label. Location inspection shows exact enemies and Begin battle. Enemy and action browsing replace the same dialog contents, returning one level at a time. Browsing never commits a location. The destination screen keeps Deck available. Optional Lineup management lives in the menu between battles; it never interrupts progression. During combat, a quiet outline Swap button sits above End turn. Its centered shadcn Dialog shows three deployed creatures and two reserves at the shared artwork size, with health bars outside the artwork. Select either group first; the opposite selection commits immediately and closes. Swaps are free. Reserves stay hidden on the battlefield. Knocked-out reserves are dimmed and unavailable, but inspectable.
- Settings and Glossary are centered scrollable dialogs returning to the menu. A child menu dialog temporarily replaces Pause so only its focus trap is active; closing restores the originating menu choice. End journey requires a confirmation; ordinary rewards and End turn do not.

## Interaction states and accessibility

Idle uses thin neutral borders. Hover brightens controls; focus uses an external dashed muted-gold outline; selection uses a solid external ring. Knockout adds grayscale and dimming. Locked talents remain focusable for their tooltip, with commands unavailable. All non-art controls provide at least 44px hit height. Icons have accessible labels and are paired with values or names. Color alone never conveys availability or selection.

Mouse, W/A/S/D/Tab, and standard-mapped controller actions share the same commands and focus paths. Enter/Space and controller A activate focused controls; B/Escape returns one level. Nested dialogs own their focus and restore a connected, enabled opener; fallback goes to the current screen. Text enlargement, reduced motion, and sound preferences persist independently of game saves. Larger text may scroll rather than clip controls. Pause, inspection and navigation do not alter the game revision.

The browser and shadcn/Radix own native Tab order, widget navigation, modal trapping and focus return. The game input adapter supplies controller actions and spatial navigation. Focus outlines, focus rings and focus-only hand lifts appear only during intentional keyboard/controller navigation or activation. Pointer movement, clicks or wheel scrolling remove them completely, including inside portaled dialogs. Automatic focus and Escape/B after pointer use do not enable them. A held stick cannot reclaim navigation after pointer/keyboard use until released. Escape and inspection shortcuts act once per key press. Background windows ignore game input; returning to the window or reconnecting a controller requires releasing held controller controls before they can act.

## Layout, artwork size and spacing

All artwork surfaces use fixed CSS-pixel sizes in `tokens.css`: portrait 200×266⅔ and landscape 266⅔×200, with equal surface area. Use these dimensions for Victory choices, starter/Collection browsing, destinations, inspection and Deck. Battle deliberately uses creatures 10% larger (293⅓×220) and hand cards 10% smaller (180×240). Never shrink or grow artwork, controls or typography according to viewport size. Viewport changes affect positioning, wrapping and scrolling; preserve native artwork ratios without cropping or stretching. Text enlargement remains an explicit player preference.

The shared page layout centers actual content, wraps real items, and scrolls when needed, following Alchemy's shared PageLayout approach. Fauna deliberately does not use Alchemy's automatic viewport density scaling. Artwork stays the same size on 4:3, 16:10, 16:9 and ultrawide displays, with no forced screen aspect ratio or letterboxing. Use CSS viewport dimensions for placement, independent of device pixel ratio.

The design system uses `--screen-section-gap` (24px) between heading, body and footer, and `--screen-item-gap` (12px) between closely related content. Page gutters are fixed at 32px horizontally and 24px vertically. Dialogs reserve separate room for the close control. The choice heading sits directly above its recruit or relic row, separate from the Victory heading and earnings. Victory choice rows reserve only the space needed by the portrait art and its label, keeping headings and Skip aligned without oversized padding. Currency and materials occupy their own row above a centered keyword grid. Keyword XP uses the same keyword name, level and progress bar on Victory and Journey results, following Alchemy's talent XP presentation.

Battle uses the fixed artwork sizes specified above. Health bars are centered with an inset equal to the artwork corner radius on each side. Mana sits in the lower-left corner, with 18px crystals and a 44px control target; Swap sits above End turn in the lower-right corner. The five-card hand rests low in the viewport. Its symmetric quadratic fan has a smooth curve; the middle card meets the bottom viewport edge and the outer two cards extend below it. Clipping is intentional, does not create page scroll, and never changes card size. Short viewports may scroll the combatants above the fixed hand and controls. Inspection scrolls rather than squeezing its artwork.

Review 1280×720, 1280×800, 1920×1080, 1024×768 (4:3), short 1024×600/960×540 windows, and 2560×1080/3440×1440 ultrawide. Include 150% text, reduced motion, inspection focus return, recruitment replacement cancellation, a full five-card hand with hidden overflow, and reachable controls.

## Tokens

`src/ui/tokens.css` owns semantic shadcn theme tokens and combat colors. Use `background`/`foreground` for the canvas, `card`/`card-foreground` for artwork surfaces, `popover`/`popover-foreground` for dialogs/tooltips, `primary`/`primary-foreground` for primary actions, `secondary` and `accent` pairs for quiet controls and hover, `muted`/`muted-foreground` for supporting information, `border`/`input` for boundaries, `ring` for focus, and `destructive` for destructive actions. Tailwind's theme mappings reference these tokens directly. Existing gameplay aliases resolve to these same roles; they are not independent palettes. Damage types, health and block remain separate semantic game tokens.

The color policy rejects raw hexadecimal/function/named colors in player UI, direct Tailwind palette colors (including black/white and arbitrary hex colors), and inline JSX styles. Palette changes belong in the token owner; contrast tests validate foreground/background role pairs. Use opacity/state variants of semantic utilities instead of inventing colors per component.

- Typography: locally bundled Inter Variable, regular rules, medium controls, semibold names, tabular numbers. 16px rules/controls, 20px names, 24px screen headings, 14px secondary information. Inspection enlarges rules to 18px and names to 28px. Font license: `Docs/FONT-LICENSE.txt`.
- Spacing: a 4px grid, using layout instead of decorative separators or panels.
- Color: pure black canvas (#000), neutral charcoal surfaces (#141414), ivory text (#ece6db), neutral secondary text (#b3b3b3), neutral gray borders (#484848), and muted gold (#d9b56f). Muted-gold primary actions and selection/focus indicators. Solid selection outline, separate dashed focus outline, neutral targetable border. Disabled/unaffordable cards dim; knockout adds grayscale and zero health.
- Geometry: shadcn’s default 0.625rem base radius (10px at 16px text), with semantic sm/md/lg/xl radii derived at 0.6/0.8/1/1.4 times the base. Artwork uses the base radius; standard controls keep their component radius. No sharp visible surface corners or `rounded-none` overrides, thin borders, no decorative shadows, glows or textures (the external selection ring is an interaction indicator). Artwork has no UI scrim.
- Motion: 150ms purposeful transitions; respect reduced motion. Gameplay commits before visual feedback and input never waits on animations.
- Icons: Lucide, with labels/numbers so color is never the only cue.

The hand shows at most five playable cards. Extra draws remain entirely hidden in an unplayable buffer, with no count, controls or inspection view. Playing a card fills the open slot from the buffer in draw order. Ending the turn discards both hand and buffer.

## Combat vocabulary

Palette and icon pairings are adapted from `Alchemy: src/lib/game-data/keywords.ts` and `Alchemy: src/features/alchemy/shared/config/metadata.ts`. Health uses red (#f87171, Heart), block sky blue (#7dd3fc, Shield). Damage color follows the attack type, independent of lost health:

| Type      | Foreground | Icon         |
| --------- | ---------- | ------------ |
| Physical  | #cbd5e1    | Swords       |
| Fire      | #fb923c    | Flame        |
| Ice       | #67e8f9    | Snowflake    |
| Lightning | #fcd34d    | Zap          |
| Poison    | #86efac    | FlaskConical |
| Nature    | #34d399    | Leaf         |
| Light     | #fde68a    | Sun          |

Poison and Nature use lighter foregrounds from Alchemy's green/emerald families for readable text on black and artwork. Tooltip attack rules spell out the type; floating feedback and target previews retain the damage type. Enemy intents are hidden. Keyword words in rules use their assigned colors, including secondary clauses; other prose stays neutral. Healing has a rose identity, distinct from Health.

Types are content metadata, carried on damage presentation events. Enemy types derive from encounter content. Types add no resistances, status effects, or damage arithmetic. Ice and Poison are reserved vocabulary until authored attacks use them.

Use shadcn/ui for dialogs, tooltips, menus, sliders, and shared controls, composing gameplay cards from the same primitives and tokens. Gamepad navigation remains an application responsibility and must be verified through these compositions. Adopting a library is not a reason to add more controls or containers.

## Combat movement and sound

Adapt Alchemy's outcome-driven impact/cue selection and bounded recoil rather than copying its artwork or audio assets. Each presented action selects one strongest nonzero cue, with damage winning ties over healing and block. Positive health loss applies a short 180ms, 4px portrait recoil; fully absorbed and ineffective hits have no health-loss recoil. Recoil is bounded per creature and disabled with reduced motion. Floating feedback retains its damage type and timing.

Original synthesized cues distinguish damage families, healing, gaining block, and absorption. Audio unlocks on user interaction and is optional; unavailable devices or autoplay denial cannot interrupt play. Desktop autoplay supports controller-only play. Settings offers a persistent Sound on/off setting. Pausing cancels pending presentation without replaying it on resume. Sounds, animation handles, listeners and pending timers are disposed on teardown; visual aggregation never invents extra impacts or sounds.

## Required review

Local handoff uses the bounded `npm run check` gate described in [AGENTS.md](../AGENTS.md#review-and-verification). Full static checks, DOM units, builds and browser journeys run in CI. Do not automatically run a local build, browser or desktop suite to satisfy this review; broader local validation is an explicit user opt-in.

Required rendered coverage remains draft, battle, targeting, rewards, Pause and inspection at 1280×800 and 1920×1080, including 150% text, reduced motion, focus return, input cancellation and unavailable/knockout states. Inspect CI screenshots when available or perform a requested focused local review. Report rendered review as pending if no current evidence is available. The browser suite enforces ratios, artwork-only surfaces, row ordering, viewport fit, stable target previews, control hit areas, semantic colors, modal focus ownership, and full journey flows. Screenshots are review evidence, not pixel-golden approvals.

Browser controller simulation does not verify physical controller behavior. Report macOS desktop, Windows packaging, physical controller, Steam client and Steam Deck verification separately.

## Battle interaction decisions

- Enemy details open below their artwork and readout; ally and hand details open above. Radix collision handling may shift/flip to remain on-screen. Selecting an action closes its tooltip while targeting; hovering/focusing the card again restores its rules. Creature details remain inspectable.
- Health loss is striped on the bar, with exact typed damage beside the target. Block previews show old → projected Block, including depletion to zero. Lethal previews add a small skull alongside the health bar. Numeric health totals remain in hover/inspection only.
- Invalid targets dim slightly; knocked-out creatures retain their slots with dimmed grayscale artwork and empty health bars. Empty battlefield clicks cancel selection. A/D retains remembered valid targets.
- Selected cards softly fade the Mana crystals they would spend. Actual Mana changes only after acceptance. Unavailable cards stay dimmed and inspectable; activation gives a short shake and quiet denial cue, without explanatory text. Sound and reduced-motion settings apply; rejected input never publishes gameplay or saves.
- Mouse use stays hover-driven: no programmatic battle targeting focus, automatic hand focus, focus-only tooltip or focus lift. Navigation keys, Tab and controller navigation intentionally activate focus. After play, keyboard/controller focus moves to the nearest remaining hand slot. Pointer selection itself still lifts the selected card.

The shared [keyword catalog](KEYWORDS.md) assigns every current and planned keyword a semantic `--keyword-<id>` foreground. Current resource and damage tokens alias that palette. Card prose, passives, glossary definitions, talent tabs and XP feedback consume the same identity. Planned keywords remain outside automatic prose highlighting and the player glossary until their rules are implemented.
