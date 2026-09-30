# Wikidata-primary peak processing

`npm run data:peaks` runs `scripts/wikidata_peaks.py`. Wikidata defines the candidate catalogue and all primary peak identities; OSM does not seed, filter, or override this catalogue. `npm run data:peaks:legacy` retains the historical OSM-first importer for comparison only. Original source files and older public versions are preserved.

## Discovery and normalization

Six bounded queries cover 43–49° N, 4–17° E. Candidates must have P625 coordinates and an instance/subclass path (`P31/P279*`) to mountain Q8502. This is a reproducible class-based catalogue, not a claim of exhaustive Alpine coverage. Exact spatial joins to the supplied SOIUSA polygons determine section and inherited East/West memberships. No finer subdivisions are invented. The uncoded Klagenfurt Basin is ineligible.

Metadata queries process 200 IDs per cached batch. They retrieve recorded labels and aliases in all available languages, Wikipedia sitelinks, P17 countries, best-ranked P2044 elevation, P2660 prominence and P2659 isolation. IDs are `wikidata:Q…`. Coordinates come from Wikidata; conflicting best-ranked coordinates exclude the entity with a diagnostic. Conflicting quantities remain null with diagnostics, not a silently selected value. Metres, kilometres and feet are converted explicitly; unsupported units are reported. Isolation is stored in kilometres, elevation/prominence in metres. Missing metadata remains null or an empty collection.

Country membership is separate from SOIUSA. Multiple P17 claims are retained, including international summits; missing country claims are reported. No country is inferred from language. This pipeline does not claim that every international border ambiguity has been resolved. A future optional OSM join must preserve primary Wikidata IDs, not overwrite primary values, and record field-specific provenance.

The name resolver uses the requested recorded language before canonical fallback. It never translates a mountain name. Wikipedia links use actual sitelinks, preferring the interface language, then another available article, then the Wikidata item. Browser gameplay makes no requests to Wikidata or Wikipedia until a player follows a link. Historical OSM sessions keep their source links and remain resumable.

## Difficulty

The centralized weighted heuristic in `prepare.py` measures identification, not climbing difficulty:

| Input | Weight | Normalization (capped at 1) |
|---|---:|---|
| Wikipedia language-edition count | 35% | log1p(count) / log(61), inverted |
| Recorded prominence | 20% | metres / 1500, inverted |
| Recorded topographic isolation | 15% | kilometres / 100, inverted |
| Peak density within 10 km | 15% | log1p(count) / log(301) |
| Similar-elevation density, ±200 m within 10 km | 10% | log1p(count) / log(101) |
| Elevation | 5% | metres / 4809, inverted |

Missing inputs are omitted and weights renormalized. Isolation is never approximated by nearest-peak distance. Density uses the Wikidata catalogue, whose coverage varies; Wikipedia presence is an imperfect notoriety proxy. Recognition bands use data/config/difficulty.json and scripts/classification.py. Easy requires 20 Wikipedia editions, or 8 editions plus prominence >=500 m or isolation >=10 km and score <=45. Medium requires an article, score <=65, and either two editions, prominence >=300 m, or isolation >=5 km. Remaining peaks are Hard. Missing metadata is not evidence. Categories are not forced into thirds. The CSV ranks by tier, descending edition count, score, then stable ID; reasons are retained. All nine region/difficulty combinations must contain at least six peaks. Overrides require a reason and source. Easy does not guarantee every mountain is famous.

## Publication and reproducibility

Raw queries and acquisition metadata are cached in `.cache/data/wikidata-primary/`. Requests are spaced, cached by query hash, and bounded; interrupted builds resume cached batches. Failed required requests stop publication rather than silently releasing a partial catalogue. `--offline` reproduces the snapshot without network access. Archive the raw cache with releases.

Processed peaks, full SOIUSA hierarchy, diagnostics and the API index live in `data/processed/`. Public version directories contain a manifest, 64 shards (numeric Q-ID modulo 64), and individual exact section geometries. Dataset versions hash peak content, original KML and the static area-name catalogue. Manifests retain acquisition times, checksums, generation time and attribution. Generation time changes on rebuild; data identity does not.

Publish static assets before switching the API index. In production, switch versions at the Alpine day boundary and retain older versions for saved games. This development migration can be previewed immediately with a fresh browser session; existing progress is preserved.

Wikidata structured data is CC0. Historical OSM data remains subject to ODbL. Supplied SOIUSA boundary redistribution terms remain unconfirmed. Wikipedia article text is not copied into the game.
