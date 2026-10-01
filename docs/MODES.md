# Daily modes and release evidence

## Release status — 1 October 2026

| Mode | Easy | Medium | Hard | Status |
| --- | ---: | ---: | ---: | --- |
| Alpine Peaks | Existing catalogue | Existing catalogue | Existing catalogue | Preserved |
| Worldwide Peaks | 62 | 172 | 537 | Enabled, `mode-13d7445c720f`, including 215 volcanoes |
| Alpine Valleys | 7 | 6 | 6 | Withheld: verified candidates cover CH, FR and IT, but not AT |

The selector exposes all three modes. A withheld mode displays a localized unavailable message and does not create a game. No Swiss-only or three-country fallback is allowed. Valley gameplay is implemented and exercised with explicitly synthetic test fixtures; those fixtures are never production data.

The Austrian NaLa polygon `ra10` matches **Oberösterreichisches Ennstal**, Wikidata **Q1372120**, a particular Upper Austrian named landscape unit, not the entire Enns valley. The [matched article’s area definition](https://de.wikipedia.org/w/index.php?title=Ober%C3%B6sterreichisches_Ennstal&oldid=259751042) explicitly includes both the Enns valley and the valley around Gaflenz. This is a combined multi-valley unit and is excluded. Its Wikidata record also has no P625 coordinate. A suitable alternative Austrian single-valley polygon and verified identity are required before release. Do not substitute the whole Enns valley, draw a polygon, or lower the four-country gate. Other exclusions and exact reasons are in `data/processed/alpine-valleys-report.json`.

## Sources and definitions

Sources are retrieved only by `scripts/prepare_modes.py`; gameplay reads bundled versioned JSON. Downloads and Wikidata responses are cached in `.cache/modes/`. Archive this directory with a release if exact offline reproduction is needed. The source archive SHA-256 hashes appear in each report. Geometry is reprojected to WGS84 using the source `.prj`, validated, and retained without clipping or automatic repair. Simplified geometry has a separate `-display.json` reference and is never used to score.

- **Worldwide:** [GMBA Mountain Inventory v2.0 Standard 300 selection](https://www.earthenv.org/mountains), [dataset DOI](https://doi.org/10.48601/earthenv-t9k2-1407), [Snethlage et al. 2022](https://doi.org/10.1038/s41597-022-01256-y), CC BY 4.0. Broad original units include island/highland groups as well as mountain ranges. IDs retain the source GMBA_V2_ID after the `gmba:` prefix. Only used units are shipped. Peaks must fall in exactly one valid source unit; unresolved assignments are excluded.
- **Switzerland:** ©swisstopo, swissNAMES3D 2026 polygon layer, original `Haupttal` and `Tal` named areas. [Free geodata terms](https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices): attribution required. Duplicate multilingual records must have identical geometry; ambiguous names/areas are rejected.
- **France:** DREAL PACA, [Unités paysagères en Provence-Alpes-Côte d’Azur](https://www.data.gouv.fr/datasets/unite-paysagere-en-provence-alpes-cote-dazur), Licence Ouverte 2.0. Named valley landscape units, potentially including slopes. The admitted Guisane unit is distinct from excluded combined multi-valley units.
- **Italy:** Regione Piemonte, [PPR Tavola P3 metadata](https://geodati.gov.it/geoportale/visualizzazione-metadati/scheda-metadati?metadataid=r_piemon%3A04c32dfc-51e1-4f6f-a7fc-538058884e21), `ambiti_paesaggio_2012`, landscape-plan named areas, CC BY 4.0. Source archive and original numeric AMBITO keys are recorded in the configuration. Combined Val d’Ala/Val Grande and Valle Po/Monte Bracco areas are excluded, not split.
- **Austria:** Land Oberösterreich, NaLa Raumgliederung, CC BY 4.0. [Official metadata](https://e-gov.ooe.gv.at/at.gv.ooe.ogd2-citi/api/metadata/04871c33-177d-43f7-b9a4-a44d721c3e1c). Combined valleys and lowland units are excluded. No Austrian target has yet passed all checks.
- **Identity and language:** Wikidata, CC0 structured data, supplies IDs, coordinates, recorded labels and Wikipedia sitelinks. Display falls back to a recorded Wikipedia title when the English label is absent. Wikipedia articles remain linked external references; article text is not bundled.

A valley's scoring area is its source's named geographic area, not necessarily the valley floor. The pipeline verifies a unique article-to-Wikidata match, valid source polygon, unambiguous Earth coordinates inside that polygon, and Alpine eligibility using the existing Alpine domain. It does not substitute administrative areas or catchments. The initial reviewed catalogue is deliberately incomplete.

## Recognition review

`data/config/world-candidates.json` preserves the historical shortlist. Current releases use all candidates from the completed worldwide discovery export and explicit per-identity decisions in `data/config/world-review.json`. The review pins the source SHA-256 and records inclusion or a reason for holding each candidate. The default `world-recognition-v1` rules use Wikipedia language-edition counts: Easy ≥60, Medium 35–59, Hard 20–34; below 20 is excluded. This is a recognition proxy, not proof of fame or climbing difficulty. Documented overrides disambiguate Gasherbrum I's name and classify Annapurna I as Easy: splitting the famous massif and summit into separate articles undercounts the individual summit's coverage. Overrides cannot bypass the minimum 20 editions or geometry checks. The prepared report lists inclusion/exclusion decisions; each admitted record carries count, review rationale and any override.

`data/config/valley-candidates.json` contains source keys, exact Wikipedia titles, reviewed tiers and individual recognition reasons. Valley tiers do not use summit elevation or prominence. Each mode requires at least six targets per tier; valleys also require FR, AT, IT and CH. Failed release checks remove that mode from the API index, while retaining older static assets for existing sessions.

## Interfaces, scoring and persistence

- `GET /v2/modes` reports availability.
- `GET /v2/challenge?mode=world-peaks` and `?mode=alpine-valleys` return generic target IDs, mode, dataset version, ordered tiers, scoring rule and Vienna rollover time. They have no geographical filters.
- `GET /v2/challenge?mode=alpine-peaks&region=alps` adapts the existing mixed challenge without changing its selected mountains. `/v1/challenge` remains compatible.
- New challenge seeds include mode and dataset version. Each daily tier uses an independently shuffled, deterministic deck. Browser caches and sessions are namespaced by mode. Legacy Alpine storage is unchanged.
- `world-region-v1`: distance points are `1000 × exp(-km / 250)`; inside the exact GMBA unit, add 15% of the remaining points, then round.
- `valley-area-v1`: inside or on any polygon boundary gives 1,000; outside gives `round(1000 × exp(-boundaryDistanceKm / 50))`. Hole interiors are outside; hole boundaries count. Distance uses the closest spherical segment of any ring in the polygon/multipolygon. There is no region bonus or artificial target-center marker.
- Saved sessions pin their dataset and scoring rule. Restoring a new-mode session recalculates results from pinned data. Geometry/network failure retains the submitted guess and offers retry. Switching modes cancels that mounted game's reveal timer; returning restores its progress. Rounds advance after six seconds (paused in help). Worldwide rounds begin with a world overview and use antimeridian-aware reveals.
- EN, DE, FR and IT labels/help are included. The active difficulty is bold. Alpine filters and the free Mont Blanc practice remain isolated in the legacy mode.

## Preparation, tests and deployment

```sh
npm run data:modes                       # prepare both catalogues
npm run data:modes -- --offline          # reproduce cached snapshots
npm run data:modes -- --mode world       # only worldwide
npm run data:modes -- --mode valleys     # only valleys
npm test
npm run test:data
npm run test:e2e
npm run build
```

Static files are published under `public/data/mode-<content-hash>/`, with manifest, scoring/display geometries, attribution and report. `data/processed/mode-index.json` is written only after successful asset preparation. A failed catalogue gate emits its review report without publishing a playable manifest. Raw downloads/review screenshots are ignored.

Deploy all new static version directories **before** replacing `data/processed/mode-index.json` on the API host and restarting it. Include that file in API deployments (`MODE_INDEX` can override the path); omitting it safely disables new modes. Retain old version folders for saved games. Change the active index at Vienna midnight. The frontend build includes static mode data automatically; no Wikidata/GIS endpoint is queried by gameplay.

## Validation evidence

The final build passes, with 51 unit/API tests and 15 Python geographic-data tests. Across the full browser run and targeted reruns after the dateline correction, all 38 applicable desktop/mobile cases passed; two device-specific cases were skipped on the other device. Tests cover legacy Alpine progress/practice, all interface languages, mode switching/resume, geometry failure/retry, difficulty progression, polygon reveals and catalogue gating. Valley browser fixtures are synthetic and remain separate from production data. An offline world rebuild reproduced `mode-c21e681de816` exactly.

## Complete candidate discovery

`npm run data:world:discover` queries both `P31/P279* Q8502` (mountains) and `P31/P279* Q8072` (volcanoes). Queries have no result `LIMIT` or geographic bounding box. The ≥20 total Wikimedia-sitelink prefilter cannot exclude a candidate with ≥20 Wikipedia editions; exact Wikipedia counts are applied after batched `wbgetentities` retrieval. Discovery membership is retained so volcanoes can be distinguished and deduplicated.

The export `data/processed/world-discovery.json` includes every returned candidate, original names and Wikipedia links, coordinates when unambiguous, proposed difficulty, original GMBA IDs, and failed checks. `reviewed: false` is intentional: query membership does not establish that every entity is a suitable individual mountain/volcano target. GMBA polygons and scoring boundaries remain unchanged. Review and publication remain separate; the initial 107-entry game is not described as the complete catalogue.

`world-discovery-status.json` must say `complete: true` before treating a retrieval as complete. Missing batches, empty query responses, service outages, and unresolved HTTP errors stop completion. Rate-limit `Retry-After` deadlines persist in the ignored cache and survive restarts. Scope is complete within the recorded Wikidata classes and recognition prefilter, not an inventory of every physical mountain on Earth.

### Completed retrieval — 1 October 2026

The resumed offline run used all cached query and entity responses and completed the GMBA checks. The mountain query returned 1,165 entities; the volcano query returned 362, all already present in the mountain result. Deduplication therefore yields 1,165 unique candidates. Exactly 1,066 meet the Wikipedia-only ≥20-edition threshold. Of these, 838 pass the coordinate and unique valid GMBA-region checks, including 227 volcanoes. Proposed tiers before editorial review/overrides: 62 Easy, 180 Medium, 596 Hard.

The 3 MB `data/processed/world-discovery.json` contains every candidate, including excluded/pending records, and `world-discovery-status.json` confirms completion. Identity uniqueness and counts were verified. All candidates remain `reviewed: false`; discovery and spatial eligibility are not a substitute for checking individual summit/volcano identity and recognizability. This was the retrieval-stage state; the subsequent review and activation are documented below.

## Expanded catalogue activation — 1 October 2026

The active worldwide catalogue is `mode-13d7445c720f`, with 771 targets: 62 Easy, 172 Medium and 537 Hard, including 215 volcanoes. Of the 838 candidates passing geographic/recognition checks, 67 are held after catalogue-level review of recorded names, classes and Wikipedia identities: regional/multi-summit identities, island reference points, passes, cultural sites, thermal fields and other unsuitable point targets. Every discovery identity has a recorded decision, including the candidates that already failed automated checks.

This review uses the retrieved records; it is not a field survey or independent verification of every summit coordinate. Recognition remains the versioned Wikipedia-edition proxy. The publisher checks the discovery SHA-256, complete status, unique decisions, recognition floor and original GMBA membership again before writing static assets and updating the mode index. A changed snapshot requires renewed review. Recorded English Wikipedia article titles replace ambiguous/malformed English labels (for example Cofre de Perote); localized recorded names remain available. The explicit Annapurna I tier override is retained.

Volcanoes remain point targets within Worldwide Peaks, using the same 250 km exponential scoring and 15% GMBA region bonus. `provenance.featureType` distinguishes mountain/volcano prompts in EN/DE/FR/IT. There is no extra mode or filter separating volcanoes. Country arrays in this worldwide release are empty because the discovery export does not contain normalized country claims; worldwide gameplay has no country filters and uses GMBA region hints. The source Wikidata links retain access to those records.

Earlier static versions are retained. Existing mode sessions continue to restore their pinned dataset; fresh challenges use the expanded catalogue. Deploy these static assets before the updated API index, following the existing deployment order.

Release validation: production build and typecheck pass; 54 unit/API tests and 19 data tests pass. Sixteen desktop/mobile mode checks pass, including the expanded catalogue, all four volcano prompt translations, progression, independent progress and restoration from the previous dataset. An offline rebuild reproduced `mode-13d7445c720f`.
