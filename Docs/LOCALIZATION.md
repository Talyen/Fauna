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
Numbers are formatted for the selected language. Missing, stale or structurally
invalid translations fall back to English.

Run `npm run localization:extract` after changing these calls and commit the
resulting English catalog. `npm run localization:check`, the local changed-file
gate and CI check its freshness, duplicate IDs, English forms and parameter
syntax. This only covers explicit calls in `src/ui`; it does not detect all
unconverted player text, validate non-English catalogs or qualify a language.
The inventory remains a separate migration aid.

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

The inventory, explicit UI messages and internal rule-message adapter are
preparation steps. The adapter retains numeric values and keyword identities so a
complete translated rule can reorder them; invalid templates fall back to the
English rule. The English catalog covers only migrated UI calls. It does not yet
cover every message, generated rules or non-English catalogs, and no language
selector is available. Fauna remains English-only.
