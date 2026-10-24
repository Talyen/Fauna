# Standalone asset sources

The [asset workflow](../CONTENT.md#prepared-assets) now reads only repository-owned sources. This record covers the import from committed local main `9f4f8ede01eb55cafdbfa1d515b812f1120ee4eb`.

## Source and output identity

- Imported 18 distinct audio files, totaling 33,378,606 bytes, under `assets/source/audio/`; 17 sound selections and four music selections reuse these files
- Every imported file matches both its previous source SHA-256 and its prepared output SHA-256; originals in the external library were only read during import
- Manifest changes are limited to repository origins, local source paths and historical `originalSource` metadata; IDs, recipes, output names, provenance, rights notes and pending listening status are preserved
- All 191 preparation records remain identical, including all 186 unique runtime URLs and file hashes; no files under `public/prepared/` changed
- Only the generated lookup's `manifestHash` and `generation` changed to identify the updated source manifest

The detailed comparison against the starting commit is retained in the task checkout's ignored `reports/standalone-assets.json`.

## Local evidence

- `npm test -- tests/unit/tooling/assets.test.mjs`: all six tests passed in 1.31 seconds, using the bounded single-worker launcher
- The new regression prepares and checks all selected audio in a temporary checkout with `ASSET_LIBRARY_ROOT` pointing to a missing directory, compares every audio preparation record with the committed lookup, and rejects reintroducing a library origin without replacing the published generation
- `npm run assets:prepare`: all 191 selections verified; 191 cache hits and zero encoded/copied outputs
- `npm run assets:check`: all 191 selections verified against repository originals and prepared outputs
- Both full asset commands ran under the shared host lane with `ASSET_LIBRARY_ROOT=/nonexistent/fauna-unlinked-library`, a 1 GiB Node heap and one image-processing worker

## Verification boundary

This establishes source portability and unchanged asset bytes. No gameplay, artwork, audio mixing or runtime asset URLs changed. Builds, broad tests, browser/desktop runs and packaging remain CI-owned and were not run locally for this task.
