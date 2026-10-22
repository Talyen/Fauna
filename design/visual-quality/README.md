# Fauna visual references

Use this pack with the repo [UI design](../../.agents/skills/fauna-ui-design/SKILL.md), [UI critique](../../.agents/skills/fauna-ui-critique/SKILL.md) and [art direction](../../.agents/skills/fauna-art-direction/SKILL.md) skills. [UI contracts](../../Docs/UI.md) own behavior, accessibility, layout and tokens; this pack supplies visual evidence and preference records. Open the images before applying a reference.

## Reference status

- **Established contract:** an existing implementation illustrating a specific documented rule; this does not mean the user approved the whole image
- **Candidate:** an agent's proposed direction, awaiting the user's judgment
- **User approved:** an image the user explicitly selected, with the choice date and scope recorded here
- **Counterexample:** a specific visible weakness to avoid, not a ban on everything in the image

## Whole-screen reference set

| Reference                                            | Status                                         | Carry forward                                                                                                           | Do not infer                                                                                                                                             |
| ---------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Settings](references/settings-1920.png)             | Established contract                           | Restrained palette, bounded content width, aligned labels/values and standard controls                                  | The repeated Display label and separators are not an endorsed aesthetic requirement                                                                      |
| [Battle](references/battle-1920.png)                 | Established contract                           | Artwork dominates, meaningful row ordering, overlapping hand, one strong End turn action                                | The sparse idle image does not establish targeting, readability of every state, motion or native acceptance                                              |
| [Merchant A](references/merchant-before-1280.png)    | Preferred over B; still rejected aesthetically | Preserve original illustrations, aspect ratios and accessible controls                                                  | Earlier claims that equal purchase emphasis and hover-only rules were defects are withdrawn; the user preferred A and later specified individual changes |
| [Merchant B](references/merchant-candidate-1280.png) | Rejected; not a positive reference             | Inspect the failed attempt: visible effects, aligned rows and neutral buttons did not deliver an acceptable composition | Do not reuse this composition as an improvement template                                                                                                 |

## Screen records and capture tools

[Decision records](DECISIONS.md) retain Merchant comparisons, artwork references, Memento/Tournelle evidence and the user-directed creature inspection composition. Each record states its acceptance scope and verification limits. Add screen-specific history there instead of expanding this index. Existing implementation is not automatically an accepted artistic reference.

[Repeatable Merchant capture](DECISIONS.md#repeatable-evidence) documents the task-owned capture command; other flows use their existing fixtures and preview tools. Follow the single [rendered review procedure](../../Docs/UI.md#required-review) for baseline captures, comparison sizes, interaction review and preference decisions. The [benchmark](BENCHMARK.md) evaluates the workflow; it adds no routine task requirements.
