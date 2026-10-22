# Fauna design system

Fauna's screens are game surfaces. Show cards, decision-relevant state, and the actions required to play. The background uses Alchemy’s warm near-black canvas (`hsl(30 10% 3%)`). No promotional copy, decorative chrome, permanent save-success indicators, or visible combat log.

Every screen centers its complete content composition horizontally and vertically within the available area after page gutters and gameplay feedback. The shared Screen stage owns that area; headings, content groups, pagination and primary actions remain together in the bounded main surface. Preserve paired numeric alignment, readable rule paragraphs, non-scrolling tabs, and battle controls whose positions convey meaning.

Read shared rules here and only the affected [battle](ui/battle.md) or [screen specification](ui/screens.md) section. Navigation and progression remain in their existing owners.

## Shared components and enforcement

Use source-owned shadcn/ui for every standard UI control and its interaction behavior. Current approved primitives: Button, Dialog, Popover, Tooltip, Tabs, Switch, RadioGroup, Slider, and Progress. Preserve native Tab, arrow-key, Space, Enter, Escape, focus trapping and return behavior. W/A/S/D and gamepad navigation adapt to those components rather than replacing their state machines.

`scripts/checks/shadcn-registry.json` explicitly lists reviewed primitives and their Radix owners. New standard controls must come from upstream shadcn, retain provenance, and be registered during review. Do not build custom toggles, tabs, dropdowns, dialogs, or clickable layout elements. The check rejects raw native controls, handmade widget roles, direct Radix imports, unregistered primitives, competing UI libraries. These source guards complement interaction tests; they cannot prove all behavior by static analysis.

Explicit gameplay compositions are artwork cards, the hand fan, targeting, mana crystals, combat feedback and forecast overlays on shadcn Progress bars. They use shadcn controls where interactive and shared tokens; no general-purpose custom widget is permitted under this exception. Warm near-black canvas, typography, semantic combat colors and minimum hit areas remain project theme decisions.

ArtCard is the sole artwork surface: exactly one image. Battlefield health bars are the sole UI overlay, placed just inside the bottom edge; other text and UI stay outside artwork. Creature artwork stays 4:3 landscape and action artwork 3:4 portrait, with contain rendering; never stretch or crop to another ratio. Ordinary artwork names and rules belong in hover/focus details. See [inspection](ui/screens.md#creature-and-action-inspection) and [Collection](ui/screens.md#collection) for their disclosure rules. Dynamic progress geometry is owned by Progress; hand geometry by FanSlot; measured page geometry by PagedItems. All visual colors, text sizes, and radii use shared tokens. The source gate enforces component ownership, palette and typography rules. Token-based inline styles and local motion/geometry are permitted; interaction styling and radius choices are reviewed through rendered behavior rather than blanket syntax bans.

Keywords in rule prose are semibold inline words in their semantic colors, with normal word spacing. They have no individual hover tooltip, click action or keyboard focus stop; definitions remain in the Glossary. Rules inside a surrounding hover/inspection tooltip retain this same plain-text treatment.

## Battle composition

See [battle composition](ui/battle.md#battle-composition) for the screen contract.

## Other screens

See [other screens](ui/screens.md#other-screens) for the screen contract.

## Silent recovery policy

Never show players errors, technical failure messages, save or sync status, recovery notices, conflict choices, retry buttons, or instructions to fix a failure. This applies to every player surface, including startup, settings, rendering, display changes, audio and rejected commands. Keep ordinary gameplay rules, availability and outcomes clear. Failures belong only in bounded internal diagnostics.

Recover automatically at the owning boundary. Try validated current-format saves and backups, retain competing progress before replacement, and continue locally when cloud access fails or exceeds the startup wait. Resolve divergent cloud heads automatically: prefer intact local progress; otherwise use the stable snapshot-ID order. Never combine currency, rewards or progression fields. If all development saves are invalid, continue with a fresh profile silently. Inaccessible storage allows in-memory play; do not rotate unknown local data until reads recover. Retry failed writes in the background using the latest committed state. Remove save warnings on browser exit; desktop close drains admitted writes and makes one final retry, then closes silently even if storage remains unavailable.

Optional features retain their last usable state or fall back silently. Rendering failures remount presentation with bounded retry frequency while retaining the session; no commands or rewards are replayed. A neutral loading indicator may cover recovery, without exposing the failure or asking the player to act. Persistent storage failure cannot guarantee durable progress, and persistently broken content/rendering cannot guarantee playable output; hiding a message does not count as repairing the cause. CI must exercise recovery and verify the resulting player flow.

## Interaction states and accessibility

Shared tooltips follow Alchemy's immediate hover behavior: compact charcoal panels, shared measured corners, 12px padding, content-sized width capped at 120% of the standard creature artwork width (320px at 100% Tooltip size, scaled with Tooltip size), and a 100ms opacity fade on entry and exit, preferring above with an 8px gap. Details stay pointer-transparent, collision-aware and available on intentional keyboard/controller focus. Clicking dismisses details; fresh mouse movement over the artwork restores them. Window blur or a hidden document dismisses open details.

Idle artwork has no visible border; other controls use thin neutral borders. Enabled Buttons scale to 1.035 on hover or intentional navigation focus over 150ms; artwork also animates a 2px gold ring with 1px overlapping the artwork and 1px outside it on hover. This transient interaction scale preserves fixed layout dimensions and composes with the battle hand's existing lift and rotation. Disabled artwork stays inspectable without scale or border emphasis. Reduced motion removes scale and tooltip motion. Hover brightens controls; focus uses an external solid gold outline; selection uses a solid external ring. Knockout adds grayscale and dimming. Talent effects and unlock requirements stay visible without hovering. Unavailable talents distinguish missing points from incomplete earlier rows, remain readable and focusable for their tooltip, and cannot issue purchase commands. All non-art controls provide at least 44px hit height. Icons have accessible labels and are paired with values or names. Color alone never conveys availability or selection.

Mouse, W/A/S/D/Tab, and standard-mapped controller actions share the same commands and focus paths. Enter/Space and controller A activate focused controls; B/Escape returns one level. Nested dialogs own their focus and restore a connected, enabled opener; fallback goes to the current screen. Text enlargement, reduced motion, and sound preferences persist independently of game saves. Larger text retains its selected size; reflow and explicit pages keep content and controls reachable without scrolling or clipping. Pause, inspection and navigation do not alter the game revision.

The browser and shadcn/Radix own native Tab order, widget navigation, modal trapping and focus return. The game input adapter supplies controller actions and spatial navigation. Focus outlines, focus rings and focus-only hand lifts appear only during intentional keyboard/controller navigation or activation. Pointer movement, clicks or wheel scrolling remove them completely, including inside portaled dialogs. Automatic focus and Escape/B after pointer use do not enable them. A held stick cannot reclaim navigation after pointer/keyboard use until released. Escape and inspection shortcuts act once per key press. Background windows ignore game input; returning to the window or reconnecting a controller requires releasing held controller controls before they can act.

## Layout, artwork size and spacing

The minimum supported renderer content viewport is **1280×720 CSS pixels**, independent of device pixel ratio. CI layout coverage uses 1280×720, 1280×800, 1920×1080, 2560×1080 and 3440×1440. Smaller windows are unsupported and are not review targets. Electron minimum outer bounds include the native frame, capped by the available work area; fullscreen and monitor changes reapply the display policy.

No player surface may scroll horizontally or vertically: screens, dialogs, panels, tabs and tooltips all follow this contract. Fit actual content; hiding scrollbars or clipping inaccessible content is not a fix. Long content uses explicit pages with standard shadcn Buttons, accessible Previous/Next names and a page indicator. Collection remembers a page anchor per filter; other filtered pickers reset to page one. Resizing clamps page bounds and keeps the current item on a visible page where possible. Inspection returns to its opener on its original page.

`tokens.css` owns preferred artwork dimensions: portrait 200×266⅔ and landscape 266⅔×200, with equal area. Battle fits creature artwork to the largest common size that clears both rows, readouts, target feedback and the hand; hand cards use the active portrait profile. Up to 900px viewport height, the shared short side is 180px (90%); up to 760px, it is 160px (80%). Larger displays retain the preferred sizes. Preserve artwork ratios, contain rendering and ArtCard ownership. Reflow before reducing artwork; paginate when the minimum size cannot fit. Never automatically scale typography, control hit areas or the whole interface. Text enlargement remains an explicit player preference. The talents overview packs at most five categories per row around their artwork widths with 12px column gaps (currently three centered rows of five). Its portrait artwork grows without a fixed cap to the largest size that fits both the row width and remaining height, reserving full-size category names, available-point labels and gaps.

Use 24px between screen sections and 12px between related items. Page gutters are 32px horizontally and 24px vertically. Dialogs reserve room for the close control. Screens reserve their actual remaining height after gameplay feedback. Collection reserves two artwork rows and a pagination slot. Its measured width resolves one to four columns independently of the current item count, with pagination outside the gallery. Deck, talent rows, passive tiers, Glossary, owned Boons, Campfire and keyword earnings use bounded pages. Settings keeps native category tabs, without panel scrolling.

Battle-specific geometry follows the [battle layout](ui/battle.md#layout).

The source-policy gate rejects scrolling CSS, utilities and imperative scrolling in player UI. The shared browser layout assertion checks document and nested overflow, viewport bounds, hidden clipping, hit areas and obscured controls, including portaled dialogs and tooltips. It also checks screen content centering within its available stage and dialog centering within the viewport, with the pause dropdown aligned to its menu button. Screenshots pass that assertion before capture. Geometry checks are regression protection; rendered review still establishes readability and composition.

## Tokens

`src/ui/tokens.css` owns semantic shadcn theme tokens and combat colors. Use `background`/`foreground` for the canvas, `card`/`card-foreground` for artwork surfaces, `popover`/`popover-foreground` for dialogs and tooltips, using warm charcoal surfaces and the shared subtle `border`, `primary`/`primary-foreground` for primary actions, `secondary` and `accent` pairs for quiet controls and hover, `muted`/`muted-foreground` for supporting information, `border`/`input` for boundaries, `ring` for focus, and `destructive` for destructive actions. Tailwind's theme mappings reference these tokens directly. Existing gameplay aliases resolve to these same roles; they are not independent palettes. Damage types, health and block remain separate semantic game tokens.

The color policy rejects raw hexadecimal/function/named colors in player UI, direct Tailwind palette colors (including black/white and arbitrary hex colors), and literal colors in inline JSX styles. Token-based inline values and measured geometry remain permitted. Palette changes belong in the token owner; contrast tests validate foreground/background role pairs. Use opacity/state variants of semantic utilities instead of inventing colors per component.

- Typography: locally bundled Inter Variable, regular rules, medium controls, semibold names, tabular numbers. 16px rules/controls, 20px names, 24px screen headings, 14px secondary information. Inspection enlarges rules to 18px and names to 28px. Font license: `Docs/FONT-LICENSE.txt`.
- Spacing: a 4px grid, using layout instead of decorative separators or panels.
- Color: Alchemy's warm near-black canvas (`hsl(30 10% 3%)`), charcoal surfaces (`hsl(30 8% 6%)`), ivory text (`hsl(40 25% 88%)`), warm muted text (`hsl(35 12% 62%)`), subtle warm borders (`hsl(30 8% 16%)`), and gold (`#cd9b51`, with light, deep and pale roles). Shared semantic tokens own the palette; gameplay keyword identities remain unchanged. Gold marks primary actions, selection and focus. Knockout adds grayscale; affordability never prevents inspection.
- Geometry: Apple-inspired smooth corners use native CSS `corner-shape: squircle` (a superellipse approximation, not an exact Figma 60% smoothing curve). Shared surfaces derive their radius from 22.37% of the measured shorter border-box side, bounded to 10–32px. Unmeasured controls use their 44px height; empty artwork slots use the shared artwork short side. Artwork, dialogs, tooltips, buttons and tabs share this rule; pills and circular controls remain fully rounded. Artwork images inset their radius by the border width; outer interaction frames expand it by their offset. Browsers without corner-shape support retain ordinary rounded corners. Semantic shadcn sm/md/lg/xl radii remain derived at 0.6/0.8/1/1.4 times the local base. No sharp visible surface corners or `rounded-none` overrides, thin borders, no decorative shadows, glows or textures (the external selection ring is an interaction indicator). Artwork has no UI scrim.
- Motion: 150ms general transitions, with the shared hover and tooltip timings above; respect reduced motion. Gameplay commits before visual feedback and input never waits on animations.
- Icons: Lucide, with accessible names and immediate hover/focus details where applicable. Status effects show icons only; their counts and names live in tooltips.

The hand shows at most six playable cards. Extra draws remain entirely hidden in an unplayable buffer, with no count, controls or inspection view. Playing a card fills the open slot from the buffer in draw order. Ending the turn discards the visible hand and retains the buffer.

## Combat vocabulary

Palette and icon pairings are adapted from `Alchemy: src/lib/game-data/keywords.ts` and `Alchemy: src/features/alchemy/shared/config/metadata.ts`. Health uses red (#f87171, Heart), block sky blue (#7dd3fc, Shield). Damage color follows the attack type, independent of lost health:

| Type     | Foreground | Icon         |
| -------- | ---------- | ------------ |
| Physical | #cbd5e1    | Swords       |
| Burn     | #fb923c    | Flame        |
| Freeze   | #67e8f9    | Snowflake    |
| Stun     | #fcd34d    | Zap          |
| Poison   | #15803d    | FlaskConical |
| Nature   | #059669    | Leaf         |
| Light    | #fde68a    | Sun          |
| Water    | #60a5fa    | Droplets     |
| Bleed    | #dc2626    | Droplets     |

Shared keyword colors match Alchemy's catalog base colors, including darker Poison (#15803d), Nature and Thorns (#059669), Bleed (#dc2626), and Leech (#9f1239). Health restoration uses Health's red identity. Tooltip attack rules spell out the type; floating feedback and target previews retain the damage type. Enemy intents are hidden. Keyword words in rules use their assigned colors, including secondary clauses; other prose stays neutral. Labels and icons preserve meaning alongside color; rendered readability requires review, especially for the darker colors.

Types are content metadata, carried on damage presentation events. Enemy types derive from the resolved species ability. Burn, Poison, Bleed, Stun and Freeze packets use the combat rules in [Keywords](KEYWORDS.md). Fire, Ice, Lightning and Healing are not separate keyword identities.

Use shadcn/ui for dialogs, tooltips, menus, sliders, and shared controls, composing gameplay cards from the same primitives and tokens. Gamepad navigation remains an application responsibility and must be verified through these compositions. Adopting a library is not a reason to add more controls or containers.

## Floating combat feedback

See [floating combat feedback](ui/battle.md#floating-combat-feedback) for the screen contract.

## Combat movement and sound

See [combat movement and sound](ui/battle.md#combat-movement-and-sound) for the screen contract.

## Required review

Choose the row that describes the actual effect; use the layout row whenever fit or artwork geometry changes. This procedure is the sole owner of local rendered evidence requirements.

| Change                                                                                         | Local evidence                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Small copy, icon or color adjustment with unchanged layout and behavior                        | Inspect a fresh whole-screen capture at 1280×720 with 125% text; check the changed content and contrast where applicable; a baseline capture is optional                                      |
| Layout, artwork scale, typography, shared visual tokens or composition                         | Inspect the current flow and relevant reference images before editing; compare matching before/after states at 1280×720 with 125% text and 1920×1080 with default text                        |
| Interaction with unchanged geometry                                                            | Inspect a fresh capture at 1280×720 with 125% text; exercise the changed action, cancellation/focus return and unavailable state where applicable; use the layout row too if geometry changes |
| Documentation, tooling or behavior-preserving source changes with no visual/interaction effect | No rendered evidence required; use the task check and relevant regression suites                                                                                                              |

[Seeded preview and capture commands](DEVELOPMENT_TOOLS.md#task-checkouts-and-previews) prepare the standard review conditions using existing gameplay fixtures and shared layout assertions. Capture records are implementation evidence; inspect the images and exercise changed interactions.

Keep gameplay state, input and motion conditions constant for comparisons. Inspect composition, copy, artwork, readability and reachability; correct observed defects and inspect fresh captures. Record evidence paths, conditions, exercised interactions and relevant limitations in the handoff or existing evidence record. Additional states are required only when directly implicated by the change.

Open the relevant [reference images](../design/visual-quality/README.md) for composition or art-direction work, distinguishing accepted direction from candidates and rejected examples. If artistic direction remains unresolved, present comparable A/B options without persuasive labels and ask which the user prefers; record the selected image, date and scope. User preference is required before labeling a direction approved.

Current rendered evidence is required before integrating visual or interaction changes. If unavailable, keep the task committed on its branch and report the blocker. Geometry assertions and CI screenshots establish implementation evidence, but cannot establish visual quality alone.

CI covers the wider viewport, text, motion and exceptional-state matrix. Report only relevant boundaries: browser controller simulation, native desktop, Windows packaging, physical controller, Steam client and Steam Deck remain separate facts.

## Battle interaction decisions

See [battle interaction decisions](ui/battle.md#battle-interaction-decisions) for the screen contract.

## Collection and audio settings

See [collection and audio settings](ui/screens.md#collection-and-audio-settings) for the screen contract.

## Piles, effects and Campfire

See [piles, effects and campfire](ui/screens.md#piles-effects-and-campfire) for the screen contract.

## Support visits and platform settings

See [support visits and platform settings](ui/screens.md#support-visits-and-platform-settings) for the screen contract.

## Shared implementation

[Design system](DESIGN_SYSTEM.md) maps accepted decisions to shared primitives, tokens and presentation owners, records enforcement and remaining validation. Screen styles own layout; control interaction states belong in the shared shadcn skin.

## Hand transfers

See [hand transfers](ui/battle.md#hand-transfers) for the screen contract.

## Adaptive browsing and effect borders

See [adaptive browsing and effect borders](ui/screens.md#adaptive-browsing-and-effect-borders) for the screen contract.

## Shared layout recipes

Use existing owners before adding resize observers, breakpoints or pagination state:

| Content                              | Shared owner                                                                      | Screen supplies                                                    |
| ------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Bounded page and balanced navigation | [Screen and ScreenHeading](../src/ui/shared/navigation/screen.tsx)                | Heading, actions and content; the stage reserves available height  |
| Grid or rows that must fit           | [PagedItems](../src/ui/shared/navigation/pagination.tsx) with `adaptive`          | Items, preferred page size, maximum columns/rows and cell renderer |
| Explicit fixed pages                 | PagedItems and PageControls in that same owner                                    | Items and page size; shared controls handle bounds and focus       |
| Artwork sizing                       | [ArtCard](../src/ui/shared/cards/art-card.tsx) and [tokens](../src/ui/tokens.css) | Native ratio and existing profile; screen CSS arranges the cells   |

For an adaptive grid, pass `adaptive={{ columns: 4, rows: 2 }}` with the existing grid class and preferred `pageSize={8}`. PagedItems measures available stage space, reserves pagination even on a single page, retains measured row heights and keeps the first visible item when capacity changes. Campfire and recruit replacement use one-row variants; talent trees use up to three rows. Reuse those consumers for their actual CSS constraints. The shared owner handles measurement and lifecycle; screens should not duplicate it. Collection keeps its existing filter-specific page anchors and measured gallery owner.

Keep the no-scrolling product rule, selected typography, 44px hit areas and native artwork ratios. Add a shared capability only when an affected consumer actually needs it. [Layout assertions](../tests/e2e/support/layout-contract.ts) cover overflow, reachability and centering in CI; focused rendered review still checks the changed flow.
