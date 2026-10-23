# Design-system implementation map

[UI contracts](UI.md) own shared appearance, accessibility and review. [Menu design](MENU_DESIGN.md) owns navigation; [battle](ui/battle.md) and [screen specifications](ui/screens.md) own compositions. This map locates their implementation.

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

| Behavior                                  | Entry point                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Screen stage and headers                  | [screen.tsx](../src/ui/shared/navigation/screen.tsx)                                                               |
| Pagination and adaptive browsing          | [pagination.tsx](../src/ui/shared/navigation/pagination.tsx)                                                       |
| Artwork                                   | [ArtCard](../src/ui/shared/cards/art-card.tsx)                                                                     |
| Closing modal inertness and focus handoff | [modal-surface-ref.ts](../src/ui/infrastructure/modal-surface-ref.ts)                                              |
| Combat impact and feedback                | [combat-impact.ts](../src/ui/battle/combat-impact.ts), [combat-feedback.tsx](../src/ui/battle/combat-feedback.tsx) |
| Hand transfers                            | [hand-motion.tsx](../src/ui/battle/hand-motion.tsx)                                                                |
| Swap motion                               | [swap-motion.ts](../src/ui/shared/cards/swap-motion.ts)                                                            |
| Result completion and animated numbers    | `src/ui/shared/rewards/`                                                                                           |
| Audio playback and delegated activation   | `src/ui/audio/`                                                                                                    |

The [reference index](../design/visual-quality/README.md) records artistic acceptance scope. The [UI adoption record](archive/UI_ADOPTION.md) retains older browser observations. For a new change, follow the single [rendered review procedure](UI.md#required-review); past rollout results do not qualify current main.
