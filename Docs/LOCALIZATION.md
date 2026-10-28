# Localization

The language registry currently enables English, German, Simplified Chinese,
Russian, Spanish (Spain), Brazilian Portuguese, Japanese and French. The
bundled catalogs and current qualification flags are in
[languages.json](../src/ui/shared/localization/languages.json) and
[shipped-catalogs.ts](../src/ui/shared/localization/shipped-catalogs.ts); their
presence does not establish fresh rendered or linguistic review for a change.

English is authoritative. Locally bundled, reviewed catalogs resolve player text
in presentation. The language preference belongs to the device rather than a
save, and a language switch does not change
commands, progression, random state or focus. Whole messages carry named values
and movable semantic parts, so translators can reorder them. Translation freshness,
placeholder and plural validation, glyph coverage and rendered acceptance are
part of the work, not optional afterthoughts. Gameplay identities and saved state
remain independent of the selected language.

Fauna's generated ability descriptions and passive tiers interpolate gameplay
values. The rule-message adapter extracts values and keyword identities from the
existing English generator into complete templates that translations can reorder;
unrecognized or invalid templates fall back to English. The checked-in
[coverage declaration](../src/ui/shared/localization/coverage.json) marks UI,
content, rules and runtime migration complete for language enablement. Those
flags are declarations checked alongside catalogs, not an exhaustive audit of
every runtime string. Resolve translated rules only in presentation; never translate gameplay
IDs or stored state. Audit names, descriptions, generated rules, glossary, accessibility
names, feedback, startup and recovery text as well as ordinary controls. Locale-aware
numbers and plural forms must use the selected language. Diagnostics should remain
useful for troubleshooting and must not be blindly translated as game text.

Boulder Brace's self-Block rule is a structured pilot: its existing catalog ID remains
stable, while its English template, value and keyword identity come from the
guard rule owner. Card display and accessible text use that structure for the
complete matching rule; changed effects fall back to the existing adapter. The
pilot retains the original English description as a compatibility bridge;
extraction rejects mismatches between it and the structured form. This preserves
the existing reviewed translations without changing their freshness attestations.
The pilot does not migrate other abilities; compare singular forms, extras and
enemy adaptation before expanding it.

## Recorded review

The [October 27 localized screen review](task-evidence/2026-10-27-localized-screen-review.md)
records all seven translated languages across selected menus, battle, rewards and
support screens, plus focused interaction checks. The
[translation and artwork review](task-evidence/2026-10-27-translation-art-review.md)
records its linguistic and content scope. These are dated, selected-state browser
observations; changed content needs fresh review, and native desktop, Windows,
physical controllers, Steam and Deck remain separate qualification work.

## Migration inventory

`npm --silent run localization:inventory` prints a JSON inventory of literal JSX text,
selected text attributes and simple conditional or interpolated expressions in
`src/ui`. Paths and line/column locations support review; a `{…}` marks a dynamic
expression and is not a translation placeholder. The inventory is an aid, not a
catalog, a stable message ID source or a coverage gate: it misses text in variables,
helpers, content, game rules, startup code and other attributes, and may include
non-player literals. Review each candidate in context and separately enumerate the
missing surfaces. Do not infer completion from the count.

## Explicit UI messages

Migrated components use `useMessages()` as `i18n`. Call `i18n.message` with a
stable literal ID and English sentence, or `i18n.plural` with literal English
`one` and `other` forms. Named `{{value}}` parameters let translations reorder
values; use a complete message for accessible names as well as visible labels.
Numeric message parameters are formatted for the selected language. For rich
values such as animated numbers, use `i18n.template` with `MessageParts` so
the translation can move the value without remounting it. Authored names use
`i18n.content` with the extracted content ID and the original English value;
never derive gameplay identity from the translated name. Missing, stale or
structurally invalid translations fall back to English.

Creature proper names retain their canonical spelling in German, French, Spanish
and Brazilian Portuguese; Japanese, Simplified Chinese and Russian use the
reviewed names in their own scripts. Rules that name a creature must use the
same localized name, inflected where the language requires it.

Run `npm run localization:extract` after changing these calls and commit the
resulting English catalogs and generated shipped-catalog imports. Production
bundles only qualified language catalogs. Its generated imports retain each
translation's source text for runtime freshness checks but omit authoring-only
review flags and hashes. Development previews can exercise unqualified catalogs
with temporary qualification. Authored species names, titles and traits, card
names, Talent names, Boon names, keyword labels, and Boon, Talent and creature
passive rules, Food rules, and glossary terms and definitions are extracted by their stable
identities. Glossary keyword terms reuse the shared keyword labels. Rules retain keyword tags
and named values;
translation records also retain the exact English rule for freshness checks.
Authored creature card variants use stable IDs derived from the whole English
template and preserve the production rule's ordering. The extractor samples the
known singular and enemy-power branches; unrecognized runtime forms fall back to
English, so sampling alone does not establish complete card-rule coverage.
Translations must remain grammatical for every numeric value that can fill a
template; add explicit plural handling when a count-neutral sentence is not enough.
Measured combat statuses reuse the keyword label and glossary definition while
keeping their committed English snapshot for animation. Transient status rules
use IDs derived from their full templates and retain semantic keyword tags;
unrecognized variants fall back to their English snapshots.
Combat previews retain keyword and status identities for localized changes and
conditional outcomes, including accessible summaries. Their rendered behavior
still requires review in the qualified languages before qualification.
The live combat log translates recognized combat, action, status and reward
events only when their complete committed text matches the corresponding event
payload. Unrecognized announcements retain their original English until migrated.
`npm run localization:check`, the local changed-file gate and CI check freshness,
duplicate IDs, English forms and parameter syntax. UI extraction only covers
explicit calls in `src/ui`; generated rule extraction covers recognized templates
and sampled branches. Neither can discover every future or unrecognized runtime
string or qualify a language by itself. The inventory remains a separate migration aid.

### Translation packets

Run `npm run localization:prepare` to create `reports/localization/tasks.json`
for pending messages across the seven target languages. Each locale includes
English source, its glossary, source hashes, previous reviewed records and empty
result fields. Edit only the result fields. Preparing again retains drafts whose
source and glossary have not changed; prior packets are backed up under
`reports/localization/backups/`. The complete locale glossary participates in the
freshness hash, so a terminology change currently requires that locale's affected
packet to be reviewed again.

After reviewing meaning and terminology, run `npm run localization:apply --
--reviewed`. The flag attests to that semantic review; the tool cannot verify
translation quality. Null results remain pending. Every supplied result is
validated before any catalog is changed, and replaced locale catalogs are backed
up. The tool rejects stale source or glossary snapshots, unknown messages,
incorrect parameters and missing locale-specific plural categories.
`npm run localization:translations:check` validates existing reviewed records;
the local changed-file gate and CI run it as well.

The language registry identifies qualified languages. Its qualification check
requires complete reviewed catalogs for each enabled language, completed UI,
content and rule migration, and a runtime connected to those catalogs. Japanese,
Simplified Chinese and Russian also require bundled script fonts whose character
maps cover the translated catalog, native language name and compact numbers.
The checks do not establish font wiring, rendered-flow, platform or linguistic
quality; the remaining qualification steps below still apply.

Font preparation is an explicit authoring step. `npm run localization:fonts`
uses fontTools 4.60.1, fetches commit-pinned Noto sources, verifies their SHA-256
digests, and subsets the current translations and native language names. Set
`FAUNA_FONT_PYTHON` to the Python environment containing that version, or pass
`-- --source-dir <directory>` to use verified original fonts offline. Replaced
fonts are backed up under `reports/localization/backups`. The bundled OFL notices
are in `Docs/NOTO-SANS-LICENSE.txt`, `Docs/NOTO-SANS-JP-LICENSE.txt`
and `Docs/NOTO-SANS-SC-LICENSE.txt`. Regenerate after adding glyphs and inspect actual
rendering before qualification; a subset alone does not enable a language.

## Implementation and qualification

1. Establish stable message IDs, named parameters, semantic keyword parts and a
   reactive presentation reader. Extract English and generate a deterministic
   catalog; prevent stale source, invalid placeholders and missing plural forms
2. Convert all player-visible and accessible text, including generated rules and
   state-dependent messages. Keep content mechanics and saved data independent of
   language; test cross-language save/resume and unchanged command/RNG outcomes
3. Translate and semantically review every target catalog, including actor,
   timing, quantities, negation and glossary consistency. Bundle fonts covering
   all required glyphs and validate those fonts against the catalogs. Semantic
   review is part of implementation; separate native-speaker review is not required
4. Add a device-local language choice and automatic detection through Fauna's
   existing platform capabilities, with English fallback. Check live switching,
   focus and controller navigation; verify startup, recovery and storage failures
5. Inspect actual rendered flows at supported sizes, including enlarged text, and
   qualify browser, desktop, Windows and Steam separately. Do not offer or advertise
   a language until its catalog, fonts, interactions and layouts are complete

The device-local preference owner can resolve an available qualified catalog
using a saved choice, Steam's game language, then system languages. Optional
storage and Steam failures fall back without blocking play; stale Steam responses
cannot override a manual choice. The Steam worker
uses an isolated, bounded language request so an invalid or timed-out optional
reply does not stop its Cloud transport. Startup and runtime catalog localization
use the same qualified languages. Production build and platform verification are
reported separately from catalog and rendered-flow checks.

The rule-message adapter retains numeric values and keyword identities so a
translated rule can reorder them; invalid or unrecognized templates fall back to
English. The card extractor checks runtime numeric branches against the forms it
samples, so newly introduced branches need explicit coverage. The UI inventory is
an additional aid and cannot by itself prove coverage of dynamic text. The
language selector offers the languages marked qualified in the registry.
