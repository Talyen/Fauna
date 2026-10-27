# Localization preparation

Fauna currently ships in English only. Its target languages are English, German,
Simplified Chinese, Russian, Spanish (Spain), Brazilian Portuguese, Japanese and
French, matching Alchemy's current selection. These are targets, not a claim that
translations are available or qualified.

Alchemy provides a useful model: English is authoritative; locally bundled,
reviewed catalogs resolve player text in presentation; the language preference
belongs to the device rather than a save; and a language switch does not change
commands, progression, random state or focus. Whole messages carry named values
and movable semantic parts, so translators can reorder them. Translation freshness,
placeholder and plural validation, glyph coverage and rendered acceptance are
part of the work, not optional afterthoughts. Fauna should adapt those principles
to its own content and platform boundaries rather than copy Alchemy's catalogs.

Fauna's generated ability descriptions and passive tiers interpolate gameplay
values, and `KeywordText` currently recognizes English words to apply semantic
colors. Before translating these rules, represent values and keyword identities
independently of the rendered English, retaining complete messages and allowing
reordering. Resolve them only in presentation; never translate gameplay IDs or
stored state. Audit names, descriptions, generated rules, glossary, accessibility
names, feedback, startup and recovery text as well as ordinary controls. Locale
aware numbers and plural forms must use the selected language. Diagnostics should
remain useful for troubleshooting and must not be blindly translated as game text.

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

Run `npm run localization:extract` after changing these calls and commit the
resulting English catalogs. Authored species names, titles and traits, card
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
Conditional combat previews localize their numeric outcome summaries; status
changes in those summaries still use English, and their translated keyword
styling requires further migration before qualification.
`npm run localization:check`, the local changed-file gate and CI check freshness,
duplicate IDs, English forms and parameter syntax. UI extraction only covers
explicit calls in `src/ui`; content extraction does not yet cover all rule prose or generated descriptions. Neither establishes complete coverage or
qualifies a language. The inventory remains a separate migration aid.

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

The language registry marks only English qualified. Its qualification check
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
   all required glyphs and validate those fonts against the catalogs
4. Add a device-local language choice and automatic detection through Fauna's
   existing platform capabilities, with English fallback. Check live switching,
   focus and controller navigation; verify startup, recovery and storage failures
5. Inspect actual rendered flows at supported sizes, including enlarged text, and
   qualify browser, desktop, Windows and Steam separately. Do not offer or advertise
   a language until its catalog, fonts, interactions and layouts are complete

The device-local preference owner can resolve an available qualified catalog
using a saved choice, Steam's game language, then system languages. Optional
storage and Steam failures fall back without blocking play; stale Steam responses
cannot override a manual choice. Only English is selectable. The Steam worker
uses an isolated, bounded language request so an invalid or timed-out optional
reply does not stop its Cloud transport. Runtime catalog and startup coverage is
still incomplete, so the runtime qualification flag remains false.

The inventory, explicit UI messages and internal rule-message adapter are
preparation steps. The adapter retains numeric values and keyword identities so a
complete translated rule can reorder them; invalid templates fall back to the
English rule. The English catalogs cover only migrated UI calls and selected authored names. They
do not yet cover every message or generated rule, and no player-facing language
selector is available until another language is qualified. Fauna remains English-only.
