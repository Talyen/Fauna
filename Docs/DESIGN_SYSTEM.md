# Design-system implementation map

[UI contracts](UI.md) own shared appearance, accessibility and review. [Menu design](ui/screens.md#navigation-and-menus) owns navigation; [battle](ui/battle.md) and [screen specifications](ui/screens.md) own compositions. This map locates their implementation.

Shared components follow the [copy and layout rule](UI.md#copy-and-layout): resolve unclear composition through layout rather than taglines, helper text or secondary labels.

## Canonical owners

| Concern                                                          | Owner                                                                                                            |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Registered shadcn/Radix controls and native widget behavior      | `src/components/ui/`; stable `ui-*` skin classes                                                                 |
| Colors, typography, spacing, artwork geometry and motion tokens  | [tokens.css](../src/ui/tokens.css)                                                                               |
| JavaScript motion values                                         | [motion-values.ts](../src/ui/shared/motion-values.ts), reading the same tokens; absent styles settle immediately |
| Shared control states                                            | [design-system.css](../src/ui/design-system.css); feature CSS must not bypass these states                       |
| Ordered stylesheet entrypoint                                    | [styles.css](../src/ui/styles.css); feature folders own layout                                                   |
| Reusable cards, combat readouts, navigation, rewards and effects | `src/ui/shared/`                                                                                                 |
| React measurement and modal lifecycle                            | `src/ui/infrastructure/`, below primitives and feature compositions                                              |
| Dependency-light utilities                                       | `src/lib/`, without React, feature, application, platform or gameplay imports                                    |
| Primitive provenance and Radix owners                            | [shadcn registry](../scripts/checks/shadcn-registry.json)                                                        |
| Source policy                                                    | [ui-contract.mjs](../scripts/checks/ui-contract.mjs)                                                             |

Primitives and infrastructure cannot import higher-level owners. Screen styles compose shared controls; token-based geometry and local motion remain permitted. The source gate checks ownership, semantic colors and typography; rendered review establishes actual fit, contrast and interaction.

## Presentation owners

[Shared layout recipes](UI.md#shared-layout-recipes) locate Screen, pagination and ArtCard and explain their use. Other presentation owners:

| Behavior                                  | Entry point                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Closing modal inertness and focus handoff | [modal-surface-ref.ts](../src/ui/infrastructure/modal-surface-ref.ts)                                              |
| Combat impact and feedback                | [combat-impact.ts](../src/ui/battle/combat-impact.ts), [combat-feedback.tsx](../src/ui/battle/combat-feedback.tsx) |
| Hand transfers                            | [hand-motion.tsx](../src/ui/battle/hand-motion.tsx)                                                                |
| Swap motion                               | [swap-motion.ts](../src/ui/shared/cards/swap-motion.ts)                                                            |
| Result completion and animated numbers    | `src/ui/shared/rewards/`                                                                                           |
| Audio playback and delegated activation   | `src/ui/audio/`                                                                                                    |

The [reference index](../design/visual-quality/README.md) records artistic acceptance scope. The [UI adoption record](archive/UI_ADOPTION.md) retains older browser observations. For a new change, follow the single [rendered review procedure](UI.md#required-review); past rollout results do not qualify current main.

## Source checks and registration

The [registry](../scripts/checks/shadcn-registry.json) lists reviewed primitives and Radix behavior owners. Register each new upstream shadcn control with its source URL and behavior owner during review; provenance is metadata, not source comments or formatting.

The syntax-based source gate rejects raw native controls, handmade widget roles, focusable native click targets, direct Radix imports, unregistered primitives and competing UI libraries. Custom toggles, tabs, dropdowns, dialogs and clickable layout widgets are prohibited. Comments and test fixtures are not player surfaces; container keyboard/pointer gestures and delegated click handlers may route input without becoming widgets. Interaction tests and rendered review supplement static enforcement.

## Token bindings

`src/ui/tokens.css` supplies semantic roles directly to Tailwind. Existing gameplay aliases resolve to those roles; damage types, Health and Block retain separate semantic tokens.

| Role pair                                   | Use                                                           |
| ------------------------------------------- | ------------------------------------------------------------- |
| `background` / `foreground`                 | Canvas                                                        |
| `card` / `card-foreground`                  | Artwork surfaces                                              |
| `popover` / `popover-foreground`            | Warm-charcoal dialogs and tooltips, with shared subtle border |
| `primary` / `primary-foreground`            | Primary actions                                               |
| `secondary`, `accent` and their foregrounds | Quiet controls and hover                                      |
| `muted` / `muted-foreground`                | Supporting information                                        |
| `border`, `input`, `ring`, `destructive`    | Boundaries, inputs, focus and destructive actions             |

The color gate rejects raw hex/function/named colors, direct Tailwind palettes (including black/white and arbitrary hex) and literal inline JSX colors. It inspects class/style contexts, excluding copy, IDs and unrelated metadata. Token-based inline values, measured geometry and local motion are permitted. Change palettes in the token owner; use semantic opacity/state variants. Contrast tests validate foreground/background pairs; rendered review checks interaction styling and radii.

## Geometry and layout assertions

Progress owns dynamic progress geometry, FanSlot owns hand geometry, and PagedItems owns measured page geometry. Use the [shared layout recipes](UI.md#shared-layout-recipes) before adding measurement or pagination state.

The rendered layout assertion enforces scrolling scope and reachability; source syntax alone cannot establish whether a region fits. It checks document and nested overflow, viewport bounds, hidden clipping, hit areas and obscured controls, including portaled dialogs and tooltips. Approved secondary regions allow offscreen vertical content, with interaction tests exercising its reachability. It also checks screen content centering within its available stage and dialog centering within the viewport, with the pause dropdown aligned to its menu button. Screenshots pass that assertion before capture. Follow [required review](UI.md#required-review) for readability and composition; these geometry checks protect regressions.
