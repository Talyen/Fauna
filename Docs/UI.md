# UI contracts

## Start here

Apply these rules to every UI change, then read only the affected sections below and the relevant [screen](ui/screens.md) or [battle](ui/battle.md) specification:

- Center the complete composition horizontally and vertically in the available Screen stage, keeping headings, artwork, pagination and actions together
- Show decision-relevant state and actions; preserve disclosure layers and accessible names; omit promotional copy, decorative chrome, save-success indicators and a visible combat log
- Use registered shadcn controls, shared tokens and ArtCard; keep artwork uncropped at native ratios and ordinary names/rules outside it
- Preserve selected text size, reachable controls, numeric alignment, readable rules and non-scrolling tabs; fit gameplay to the viewport
- Keep mouse, keyboard and standard-controller flows equivalent; focus and selection remain distinct, and color/sound never carry meaning alone
- Consume committed gameplay; navigation, previews and animation never grant rewards, save progression or block commands
- Follow [required review](#required-review) before integrating visual or interaction changes; only explicit user choices establish artistic approval

| When changing                 | Read                                                                                                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Controls or input             | [Components](#shared-components-and-enforcement), [interaction/accessibility](#interaction-states-and-accessibility), [control states](#shared-control-states-and-feedback) |
| Composition or fit            | [Layout and artwork](#layout-artwork-size-and-spacing), [shared recipes](#shared-layout-recipes), affected screen                                                           |
| Typography, colors or effects | [Tokens](#tokens), [combat vocabulary](#combat-vocabulary), [keyword effects](#keyword-visual-effects)                                                                      |
| Failure behavior              | [Recovery policy and owners](#recovery-and-persistent-failures)                                                                                                             |
| Navigation or progression     | [Menus](ui/screens.md#navigation-and-menus), [Journey](EXPEDITION_DESIGN.md), [Keywords](KEYWORDS.md)                                                                       |
| Implementation or checks      | [Design system](DESIGN_SYSTEM.md); [preview/capture tools](DEVELOPMENT_TOOLS.md#task-checkouts-and-previews)                                                                |

These contracts remain applicable when a shared change affects several flows; selective reading does not exempt affected behavior.

## Copy and layout

Avoid taglines, avoid helper text, avoid secondary labels - if a screen needs them to make sense, fix the layout instead.

Make the player's decision clear through composition, grouping, reading order and action placement. Keep gameplay rules, availability, outcomes and accessible names in their intended disclosure layers.

## Shared components and enforcement

Use source-owned shadcn/ui for standard controls: Button, Dialog, Popover, Tooltip, Tabs, Switch, RadioGroup, Slider and Progress. Preserve their native keyboard, focus-trap and focus-return behavior; W/A/S/D and gamepad input adapt to it.

Row-based directional navigation is declared by `data-nav-layout="rows"` on its region and `data-nav-row` on each row. Shared input follows those declarations without screen or styling selectors; controls outside declared rows retain spatial navigation, and native composite controls retain their own arrow behavior.

[Device preferences](../src/ui/settings/preferences.ts) own defaults, normalization, existing storage keys and updates for sound, effects, text size and battle controls. Settings consumes that owner; DOM text scaling and audio configuration apply the committed preferences separately. Native display state remains owned by the desktop adapter.

Register new controls through the [source checks and registration policy](DESIGN_SYSTEM.md#source-checks-and-registration), which prohibits competing widgets/libraries and direct Radix imports.

Artwork cards, the hand fan, targeting, Mana crystals, combat feedback and forecasts on shadcn Progress are explicit gameplay compositions. They use shared tokens and shadcn controls where interactive; this exception permits no general-purpose custom widgets. Theme and minimum hit areas follow the sections below.

ArtCard is the sole artwork surface, with exactly one contained image at its native [aspect ratio](CONTENT.md#artwork-contracts). Never stretch or crop the image; the [battle hand](ui/battle.md#layout) retains its sole authored bottom-edge clipping exception. Battlefield health bars sit just inside the bottom edge and are the sole UI overlay; other text/UI stays outside. Ordinary names/rules use hover/focus details, with [inspection](ui/screens.md#creature-and-action-inspection) and [Collection](ui/screens.md#collection) defining disclosure. Use shared color, text-size and radius tokens. [Design-system checks](DESIGN_SYSTEM.md) enforce source ownership; token-based inline styles and local motion/geometry are allowed, with interaction styling/radii assessed in rendered review.

Keywords in rule prose are semibold inline words in their semantic colors, with normal word spacing. They have no individual hover tooltip, click action or keyboard focus stop; definitions remain in the Glossary. Rules inside a surrounding hover/inspection tooltip retain this same plain-text treatment.

## Recovery and persistent failures

Recover transient failures automatically without interrupting play. Keep technical errors, save-success indicators, sync status, conflict choices and feature-specific retry controls out of player surfaces. Persistent failures that prevent saving or displaying the game receive one concise, accessible explanation of the player consequence; raw errors, paths and diagnostics remain internal. Keep ordinary gameplay rules, availability and outcomes clear.

The [save and Cloud contracts](ARCHITECTURE.md#save-contract) own backup validation, fresh startup for all-invalid development saves, in-memory play, retries, conflict preservation and shutdown. Presentation shows one nonmodal notice after two consecutive write failures or exhausted startup read recovery, asking the player to keep Fauna open while saving retries. Saving the latest committed state removes it. Do not add presentation-owned save or close orchestration.

Optional features retain their last usable state or fall back silently. Rendering failures remount presentation at bounded frequency while retaining the session and never replaying commands/rewards. Use neutral loading for brief recovery; after three render failures in the recovery window, explain the consequence while retries continue. Thirty successful rendering seconds reset the window. A hidden notice does not repair lost durability or broken rendering; CI must exercise recovery and verify the resulting player flow.

Bundled content validation runs once before session loading. Its inputs cannot recover with time. A fatal preparation failure settles the existing splash immediately with the accessible message Fauna could not start, stops its preparation animation and releases owned preparation work. It never retries validation, loads invalid content or offers a retry control. Normal startup and presentation recovery keep their existing timing and owners.

### Recovery owners

Use the session/platform port rather than feature-specific retry loops or error screens. Inspect these owners when changing failure behavior; `npm run context -- --task recovery` locates them.

| Failure                                                       | Existing owner                                                                                                     | Regression coverage                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Local loading, backup choice, save ordering and write retries | [Application session](../src/application/session.ts)                                                               | [Session tests](../tests/unit/application/session.test.ts)                  |
| Cloud reconciliation and background retries                   | [Cloud controller](../src/application/cloud.ts)                                                                    | [Cloud tests](../tests/unit/application/cloud.test.ts)                      |
| Native storage rotation and recovery snapshots                | [Storage](../desktop/storage.cjs) and [recovery](../desktop/recovery.cjs)                                          | [Desktop tests](../tests/unit/platform/desktop.test.ts)                     |
| Rendering failures                                            | [GameErrorBoundary](../src/ui/shared/diagnostics.tsx) around the existing session                                  | [Recovery integration](../tests/integration/recovery/)                      |
| Fatal startup preparation                                     | [Preparation](../src/ui/startup/prepare.ts), [mounting](../src/main.tsx) and [splash](../src/ui/startup/splash.ts) | [Startup recovery](../tests/integration/recovery/startup-recovery.test.tsx) |
| Bounded internal diagnostics                                  | [Session diagnostics](../src/application/diagnostics.ts)                                                           | [Diagnostic tests](../tests/unit/application/diagnostics.test.ts)           |

This policy does not authorize swallowing exceptions, replaying commands or inventing fallback progression. Change and verify the owning boundary when existing recovery cannot satisfy a new failure mode.

## Interaction states and accessibility

### Tooltips

Shared tooltips follow Alchemy's immediate hover behavior: charcoal panels with Alchemy's exact fill, ivory heading, muted body, subtle border and soft shadow; 20px rounded corners; 12px padding; content-sized width capped at 320px (scaled with Tooltip size); and a 180ms entry / 120ms exit fade with a 2px directional offset (4px on entry), preferring above with an 8px gap. Details stay pointer-transparent, collision-aware and available on intentional keyboard/controller focus. Clicking dismisses details; fresh mouse movement over the artwork restores them. Window blur or a hidden document dismisses open details.

### Artwork and availability

Artwork rests within a 1px dim neutral frame, matching Alchemy's 80% border color; other controls use thin neutral borders. Enabled artwork scales to 1.035 on hover or intentional navigation focus over 150ms; artwork also reveals its keyword shine over the same frame on hover or intentional focus. Text controls remain fixed in size on hover, with a primary-button bloom and quieter fill and border feedback for secondary actions. Artwork scale preserves fixed layout dimensions and composes with the battle hand's existing lift and rotation.

Disabled artwork stays inspectable without scale or border emphasis. Reduced motion removes scale and tooltip motion. Hover and intentional focus share one interaction frame; focus on ordinary controls replaces the resting boundary rather than adding another border. A chosen battle action remains raised while its recipient is being chosen. Knockout adds grayscale and dimming. Talent effects and unlock requirements stay visible without hovering. Unavailable talents distinguish missing points from incomplete earlier rows, remain readable and focusable for their tooltip, and cannot issue purchase commands.

All non-art controls provide at least 44px hit height. Icons have accessible labels and are paired with values or names. Color alone never conveys availability or selection.

### Input and focus

Mouse, W/A/S/D/Tab, and standard-mapped controller actions share the same commands and focus paths. Enter/Space and the controller confirm button activate focused controls; the controller back button or Escape returns one level. Prompts follow the detected controller family or the player's saved override. Nested dialogs own their focus and restore a connected, enabled opener; fallback goes to the current screen. Text enlargement, reduced motion, and sound preferences persist independently of game saves. Larger text retains its selected size; reflow, explicit pages and permitted secondary scrolling keep content and controls reachable without hidden clipping. Pause, inspection and navigation do not alter the game revision.

The browser and shadcn/Radix own native Tab order, widget navigation, modal trapping and focus return. The game input adapter supplies controller actions and spatial navigation. Focus outlines, focus rings and focus-only hand lifts appear only during intentional keyboard/controller navigation or activation. Pointer movement, clicks or wheel scrolling remove them completely, including inside portaled dialogs. Automatic focus and Escape/B after pointer use do not enable them.

A held stick cannot reclaim navigation after pointer/keyboard use until released. Escape and inspection shortcuts act once per key press. Background windows ignore game input; returning to the window or reconnecting a controller requires releasing held controller controls before they can act.

## Shared control states and feedback

| Surface      | Treatment                                                                                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Buttons      | Primary gold with hover bloom, destructive red, quiet controls neutral with opaque hover fills; press shrinks 2%, disabled 50%; busy text/spinner prevents repeated activation                          |
| Artwork      | One keyword shine or neutral interaction frame on hover/focus; a chosen hand card stays raised without an extra selection border; unavailable/knockout opacity 45%, with grayscale for knockout         |
| Tabs         | Centered with 12px gaps/padding, neutral 2px boundaries and gold selection/hover borders; regular labels, no strip, no selected-hover change; panels switch instantly                                   |
| Switches     | Gold/gray track, 150ms thumb travel, subtle hover brightening without growth                                                                                                                            |
| Radios       | Gold outline/dot; hover brightens the existing outline; focus emphasizes the existing circle                                                                                                            |
| Sliders      | Gold/gray track, ivory thumb, thin hover border and thicker focus/drag border; immediate values in 10-point steps                                                                                       |
| Dialogs      | Near-black surface, neutral border, 80% black backdrop and 150ms opacity-only entry/exit; closing surfaces are inert and hidden from assistive technology; outgoing controls cannot navigate or confirm |
| Progress     | Rounded 8px track, 150ms fill changes; forecasts update immediately                                                                                                                                     |
| Status icons | Icons only, fixed catalog order, names/counts in tooltips and accessible descriptions; 200ms entrance/pulse, 150ms removal; zero removes without an extra pulse                                         |
| Empty state  | Centered muted 24px icon and accessible label; no visible filler, action or tooltip                                                                                                                     |

Ordinary loading indicators wait 200ms; ready content never waits for them. [Startup](ui/screens.md#startup-loading) has its own deliberate splash duration. Menu/settings activation uses a quiet prepared click; hover/focus stay silent and rejection retains its denial cue. Audio unlocks on interaction, respects volume/mute preferences and never controls gameplay. Listening approval belongs to the media evidence.

Navigation crossfades decorative inert snapshots over 150ms, or 250ms into battle, without duplicating IDs, effects or focus. Accepted reward choices briefly brighten the chosen artwork and dim alternatives on the outgoing surface; rejection clears that cue, and recruitment immediately shows its committed team outcome. Collection paging is instant. Result earnings count over 400ms; rewards arrive 75ms apart and level-up icons pulse to 110% over 250ms. Input finishes presentation and accepts the original action. Shared swap copies use opposing 32px arcs over 150ms and a 4px/150ms selected lift; slot ownership and dialog focus settle immediately.

### Presentation lifetime

Animations and feedback consume committed state; they never issue gameplay commands, grant rewards, save previews or delay command acceptance. Reduced motion removes spatial effects and makes control transitions immediate, showing final results without replay. Pause and interruption revoke owned animations, timers and stale callbacks; resume never replays canceled actions. Teardown also releases owned listeners and voices. Decorative copies are inert, hidden from assistive technology and stripped of IDs. [Battle presentation](ui/battle.md) defines feedback lifetimes, interruption and motion exceptions.

## Layout, artwork size and spacing

The minimum supported renderer content viewport is **1280×720 CSS pixels**, independent of device pixel ratio. CI layout coverage uses 1280×720, 1280×800, 1920×1080, 2560×1080 and 3440×1440. Smaller windows are unsupported and are not review targets. Electron minimum outer bounds include the native frame, capped by the available work area; fullscreen and monitor changes reapply the display policy.

The document, battle, artwork browsing, action surfaces and tooltips fit without scrolling. Glossary, Settings panels and help dialogs may use bounded vertical scrolling for secondary content. Mark each such region with `data-scroll-region`, `role="region"`, an accessible name and `tabIndex={0}`; use the shared `.secondary-scroll-region` style and retain visible navigation outside it. Mouse wheel, native keyboard scrolling and controller up/down must reach the complete contents; Back/Escape restores the originating screen. Horizontal scrolling and hidden inaccessible content remain defects. Other long content uses explicit pages with standard shadcn Buttons, accessible Previous/Next names and a page indicator. Collection remembers a page anchor per filter; other filtered pickers reset to page one. Resizing clamps page bounds and keeps the current item on a visible page where possible. Inspection returns to its opener on its original page.

`tokens.css` owns preferred artwork dimensions: portrait 200×266⅔ and creature landscape 293⅓×220. Creature artwork uses a shared 110% scale while portrait action cards retain their size. Up to 900px viewport height, portraits use a 180px short side and creatures are 264×198; up to 760px, portraits use a 160px short side and creatures are 234⅔×176. Larger displays retain the preferred sizes. Battle fits creature artwork to the largest common size that clears both rows, readouts, target feedback and the hand; hand cards use the active portrait profile. The five-member recruitment tray caps creature width to its available space. Reflow before reducing artwork; paginate when the minimum size cannot fit. Never automatically scale typography, control hit areas or the whole interface. Text enlargement remains an explicit player preference. The [talents overview](ui/screens.md#talents) has a viewport-fitted artwork exception.

Use 24px between screen sections and 12px between related items. Page gutters are 32px horizontally and 24px vertically. Dialogs reserve room for the close control. Screens reserve their actual remaining height after gameplay feedback. Screen-specific grid and reading-region rules belong to the [screen specifications](ui/screens.md).

Battle-specific geometry follows the [battle layout](ui/battle.md#layout).

[Layout assertions](DESIGN_SYSTEM.md#geometry-and-layout-assertions) check scrolling, reachability, centering and clipping before capture. Rendered review also assesses readability and composition.

## Tokens

Use semantic tokens from `src/ui/tokens.css` for theme, typography, geometry and combat colors. Palette changes belong there; use opacity/state variants rather than per-component colors. [Token bindings and checks](DESIGN_SYSTEM.md#token-bindings) describe role pairs, Tailwind mappings and permitted measured styles.

### Typography

Use locally bundled Inter Variable, regular rules, medium controls, semibold names, tabular numbers; names wrap without ellipsis and rules remain left-aligned. Shared screen headings follow Alchemy's bold, letter-spaced uppercase treatment and centered gold divider; the underlying accessible text remains unchanged. Settings section headings use the same uppercase hierarchy. 16px rules/controls, 20px names, 24px screen headings, 14px secondary information. Inspection enlarges rules to 18px and names to 28px. Japanese, Simplified Chinese and Russian use the bundled script-specific fonts selected by the shared language styles; preserve their glyph coverage when changing copy. [Localization](LOCALIZATION.md#translation-packets) owns font preparation and notices. Inter license: `Docs/FONT-LICENSE.txt`.

### Spacing

Use a 4px grid and layout instead of decorative panels; shared screen headings retain their centered divider.

### Color

Alchemy's warm near-black canvas (`hsl(30 10% 3%)`), charcoal surfaces (`hsl(30 8% 6%)`), ivory text (`hsl(40 25% 88%)`), warm muted text (`hsl(35 12% 62%)`), subtle warm borders (`hsl(30 8% 16%)`), and gold (`#cd9b51`, with light, deep and pale roles). Shared semantic tokens own the palette; gameplay keyword identities remain unchanged. Gold marks primary actions, selection and focus. Knockout adds grayscale; affordability never prevents inspection.

### Geometry

Shared surfaces use Alchemy's ordinary rounded corners and fixed role radii: 12px controls/buttons/tabs, 14px compact icon faces, 20px tooltips, 22px popovers, 26px dialogs and 30px artwork/empty artwork slots. Tooltip corners scale with Tooltip size; artwork corners stay fixed across sizes and hover transforms. Pills and circular controls remain fully rounded.

Artwork images inset their radius by the border width; outer interaction frames expand it by their offset. Semantic shadcn sm/md/lg/xl radii match Alchemy's 20/22/24/12px values. No sharp visible corners or `rounded-none` overrides.

Thin borders, keyword plasma, shine borders and short-label shines follow the shared effects owner; tooltip shadows and the primary-button hover bloom follow their shared controls. Other decorative panel shadows, glows and textures remain excluded. Artwork has no UI scrim; hover, focus and target states share one frame.

### Motion

150ms general transitions; control, feedback and reduced-motion behavior follow [shared states](#shared-control-states-and-feedback).

### Icons

Lucide, normally 20px within 44px hit areas; compact header exceptions belong to the screen specification. Use accessible names and immediate hover/focus details where applicable.

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

Shared keyword colors match Alchemy's catalog base colors, including darker Poison (#15803d), Nature and Thorns (#059669), and Bleed (#dc2626). Leech uses a lighter rose (#fb7185) for contrast. Poison and Bleed rule text use lighter green and red text roles for contrast on dark surfaces; artwork palettes and combat colors retain their base identities. Health restoration uses Health's red identity. Tooltip attack rules spell out the type; floating feedback and target previews retain the damage type. Enemy intents are hidden. Keyword words in rules use their assigned colors, including secondary clauses; other prose stays neutral. Labels and icons preserve meaning alongside color; rendered readability requires review, especially for the darker colors.

Types are content metadata, carried on damage presentation events. Enemy types derive from the resolved species ability. Burn, Poison, Bleed, Stun and Freeze packets use the combat rules in [Keywords](KEYWORDS.md). Fire, Ice, Lightning and Healing are not separate keyword identities.

## Keyword visual effects

`src/ui/shared/effects/` owns Alchemy-derived WebGL plasma, Canvas 2D rising embers, CSS masked border shine and short-label text shine. Keyword palettes resolve through `tokens.css`; shared keywords use Alchemy palettes (Holy maps to Light and Consume is violet). Fauna-only keywords retain their primary identities with darker secondary stops. Visual keyword extraction follows displayed rules and aliases, independently of progression categories and Mana costs. Undiscovered Collection artwork uses its species palette for hover and intentional focus without exposing its name or rules.

Artwork shine borders appear while the pointer hovers over enabled artwork or intentional keyboard/controller focus rests on it, including action, Boon and creature cards; idle, selected, acting and Death's Door states never reveal them on their own. Undiscovered Collection artwork also shines on hover or intentional focus without exposing its details. Action/Boon borders use every distinct keyword in displayed effect text, including aliases. Creature artwork uses its kit palette. Focus uses the same single shine frame; a chosen hand card stays raised rather than adding another border. Unavailable actions gain no availability shine, while legitimate inspection still supplies a palette.

Plasma uses the first two distinct keywords, or one keyword's light/deep pair; keyword-less content uses neutral Physical. Single-keyword borders use light/deep/light; multiple keywords form a primary-color loop. Text shines use at most three keyword colors with faded stops and a white highlight; ordinary rules retain solid keyword colors. Artwork ratios and target feedback remain independent; targeting brackets replace hover and focus frames on valid recipients.

The mounted app owns one active backdrop. Scoped hover and intentional keyboard/controller focus override detail/selection baselines, then screen baselines. Hidden screens, closing dialogs and transition snapshots cannot own a source. Inspection supplies a host inside the shared dimmed backdrop behind an opaque panel; the originating screen stays visible beneath the overlay. Talent availability and unspent points remain visible through their ordinary status and count; Death's Door retains its status readout and uses a red artwork shine on hover or intentional focus. Settings, selected talent categories, Collection details and journey results supply contextual baselines.

The [Display settings](ui/screens.md#settings) own intensity preferences. Zero intensity removes its renderer; particles change opacity rather than density. Reduced motion hides moving backgrounds and freezes shine without changing saved intensity. Unfocused/hidden windows park their renderers. Missing WebGL uses static radial decoration and never blocks play. Ambient ember colors follow the screen, not hovered keywords: 40 gold embers normally, 80 warmer embers in battle with stronger Boss opacity, and warm Campfire embers; starter selection has no particles.

## Required review

This is the single task procedure for UI design, implementation and critique. Read [Start here](#start-here), the sections implicated by the change and the affected [battle](ui/battle.md) or [screen](ui/screens.md) specification. [Design system](DESIGN_SYSTEM.md) and [tool details](DEVELOPMENT_TOOLS.md#task-checkouts-and-previews) are optional references when needed.

1. Identify the player's decision and the information available at rest versus through inspection. Preserve the requested disclosure layout and action roles; equally valid choices may have equal emphasis
2. For layout or artwork work, inspect the current rendered flow and relevant [reference images](../design/visual-quality/README.md) before editing. References carry their recorded acceptance scope; existing screens and agent candidates do not imply user approval
3. Compose around artwork, reading order and a bounded content group using the [shared recipes](#shared-layout-recipes). Apply the [copy and layout rule](#copy-and-layout); fix unclear layout and remove redundant copy while retaining rules, availability, outcomes and accessible names
4. Capture and inspect the evidence for the applicable row below. Exercise changed interactions separately from capture. Inspect the full frame independently of the implementation rationale: composition, copy, artwork, contrast, fit, focus and committed outcomes. Correct observed defects and inspect fresh captures
5. Record evidence paths, conditions, exercised interactions and relevant limitations in the handoff or an existing evidence record. If artistic direction remains unresolved, present comparable A/B options without persuasive labels. Only the user's explicit choice establishes artistic approval; record its date and scope
6. Integrate visual or interaction changes only after current rendered evidence is inspected. If evidence is unavailable, commit the task on its branch and report the blocker

| Change                                                                                         | Local evidence                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Small copy, icon or color adjustment with unchanged layout and behavior                        | Fresh whole-screen capture at 1280×720 with 125% text; inspect the content and contrast; baseline optional                                                                          |
| Layout, artwork scale, typography, shared visual tokens or composition                         | Matching before/after states at 1280×720 with 125% text and 1920×1080 with default text, plus the pre-edit inspection in step 2                                                     |
| Interaction with unchanged geometry                                                            | Fresh capture at 1280×720 with 125% text; exercise the changed action, cancellation/focus return and unavailable state where applicable; use the layout row too if geometry changes |
| Documentation, tooling or behavior-preserving source changes with no visual/interaction effect | No rendered evidence; use the task gate and relevant regressions                                                                                                                    |

Use the layout row whenever fit or artwork geometry changes. [Preview and capture commands](DEVELOPMENT_TOOLS.md#task-checkouts-and-previews) prepare the conditions for each tier.

Keep gameplay state, input and motion conditions constant for comparisons. Captures check shared layout assertions and prepare standard review conditions; inspect the images and exercise changed interactions. Additional states are required only when directly implicated by the change. Geometry assertions and CI screenshots alone cannot establish visual quality.

CI covers the wider viewport, text, motion and exceptional-state matrix. Report only relevant boundaries: browser controller simulation, native desktop, Windows packaging, physical controller, Steam client and Steam Deck remain separate facts.

## Shared layout recipes

Use `npm run context -- --task layout` and these recipes before adding observers, breakpoints or pagination state. Shared `usePagination` owns per-view/filter anchors, resize preservation and list clamping; `useGridColumns` measures fixed-row gallery width, while PagedItems also measures available height:

| Content                              | Shared owner                                                                      | Screen supplies                                                    |
| ------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Bounded page and balanced navigation | [Screen and ScreenHeading](../src/ui/shared/navigation/screen.tsx)                | Heading, actions and content; the stage reserves available height  |
| Grid or rows that must fit           | [PagedItems](../src/ui/shared/navigation/pagination.tsx) with `adaptive`          | Items, preferred page size, maximum columns/rows and cell renderer |
| Explicit fixed pages                 | PagedItems and PageControls in that same owner                                    | Items and page size; shared controls handle bounds and focus       |
| Artwork sizing                       | [ArtCard](../src/ui/shared/cards/art-card.tsx) and [tokens](../src/ui/tokens.css) | Native ratio and existing profile; screen CSS arranges the cells   |

For an adaptive grid, pass `adaptive={{ columns: 4, rows: 2 }}` with the existing grid class and preferred `pageSize={8}`. PagedItems measures available stage space, reserves pagination even on a single page, retains measured row heights and keeps the first visible item when capacity changes. Campfire uses a one-row variant; full-roster recruitment uses its bounded five-member tray; talent trees use up to three rows. Reuse those consumers for their actual CSS constraints. The shared owner handles measurement and lifecycle; screens should not duplicate it. Collection uses the shared hooks with filter-specific anchors and its reserved two-row gallery.

Add a shared capability only for a concrete consumer. [Layout assertions](DESIGN_SYSTEM.md#geometry-and-layout-assertions) protect fit and reachability; [required review](#required-review) checks the rendered flow.
