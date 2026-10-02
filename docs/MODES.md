# Daily modes and release evidence

## Release status — 1 October 2026

| Mode | Easy | Medium | Hard | Status |
| --- | ---: | ---: | ---: | --- |
| Alpine Peaks | Existing catalogue | Existing catalogue | Existing catalogue | Preserved |
| Worldwide Peaks | 62 | 174 | 849 | Enabled, `mode-37dabf082c4a`, 1,085 targets |
| Alpine Valleys | 7 | 6 | 6 | Withheld: verified candidates cover CH, FR and IT, but not AT |

The selector exposes Alpine Peaks (including its regional choices) and Worldwide Peaks. Alpine Valleys is hidden pending suitable source data; a previously selected valley mode falls back to Alpine Peaks without deleting saved sessions. No Swiss-only or three-country fallback is allowed. Valley gameplay is implemented and exercised with explicitly synthetic test fixtures; those fixtures are never production data.

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

`data/config/world-candidates.json` preserves the historical shortlist. Current releases use all candidates from the completed worldwide discovery export and explicit per-identity decisions in `data/config/world-review.json`. The review pins the source SHA-256 and records inclusion or a reason for holding each candidate. The historical `world-recognition-v1` rules used Wikipedia language-edition counts: Easy ≥60, Medium 35–59, Hard 20–34; below 20 was excluded. Policy v2 initially kept those tier thresholds. Current `world-admission-v3` and `world-recognition-v3` remove translation counts from both new admissions and new tier assignments, as described in the global expansion section. Historical tiers are preserved rather than automatically recalculated. Documented overrides disambiguate Gasherbrum I's name and classify Annapurna I as Easy: splitting the famous massif and summit into separate articles undercounts the individual summit's coverage. Overrides cannot bypass admission evidence or geometry checks. The prepared report lists inclusion/exclusion decisions; each admitted record carries count, review rationale and any override.

`data/config/valley-candidates.json` contains source keys, exact Wikipedia titles, reviewed tiers and individual recognition reasons. Valley tiers do not use summit elevation or prominence. Each mode requires at least six targets per tier; valleys also require FR, AT, IT and CH. Failed release checks remove that mode from the API index, while retaining older static assets for existing sessions.

## Interfaces, scoring and persistence

- `GET /v2/modes` reports availability.
- `GET /v2/challenge?mode=world-peaks` and `?mode=alpine-valleys` return generic target IDs, mode, dataset version, ordered tiers, scoring rule and Vienna rollover time. They have no geographical filters.
- `GET /v2/challenge?mode=alpine-peaks&region=alps` adapts the existing mixed challenge without changing its selected mountains. `/v1/challenge` remains compatible.
- New challenge seeds include mode and dataset version. Each daily tier uses an independently shuffled, deterministic deck. Browser caches and sessions are namespaced by mode. Legacy Alpine storage is unchanged.
- `world-region-v1`: distance scoring uses the current worldwide curve (full points within 10 km, decreasing smoothly to 10 distance points at 2,000 km). Inside the target’s GMBA unit or within 10 km of its boundary, add 15% of the remaining points, then round. The region tolerance uses spherical segment distances in kilometres, includes hole boundaries and all multipart components, and handles the antimeridian. Display outlines and catalogue membership retain the original GMBA geometry. Daily, replay, custom and restored worldwide guesses share this rule; Alpine and valley region membership is unchanged.
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

## Historical baseline discovery — 1 October 2026

The original `npm run data:world:discover` implementation queried both `P31/P279* Q8502` (mountains) and `P31/P279* Q8072` (volcanoes). Queries have no result `LIMIT` or geographic bounding box. The ≥20 total Wikimedia-sitelink prefilter cannot exclude a candidate with ≥20 Wikipedia editions; exact Wikipedia counts are applied after batched `wbgetentities` retrieval. Discovery membership is retained so volcanoes can be distinguished and deduplicated.

The export `data/processed/world-discovery.json` includes every returned candidate, original names and Wikipedia links, coordinates when unambiguous, proposed difficulty, original GMBA IDs, and failed checks. `reviewed: false` is intentional: query membership does not establish that every entity is a suitable individual mountain/volcano target. GMBA source polygons remain unchanged; gameplay adds the 10 km region-bonus tolerance described above. Review and publication remain separate; the initial 107-entry game is not described as the complete catalogue.

`world-discovery-status.json` must say `complete: true` before treating a retrieval as complete. Missing batches, empty query responses, service outages, and unresolved HTTP errors stop completion. Rate-limit `Retry-After` deadlines persist in the ignored cache and survive restarts. Scope is complete within the recorded Wikidata classes and recognition prefilter, not an inventory of every physical mountain on Earth.

### Completed retrieval — 1 October 2026

The resumed offline run used all cached query and entity responses and completed the GMBA checks. The mountain query returned 1,165 entities; the volcano query returned 362, all already present in the mountain result. Deduplication therefore yields 1,165 unique candidates. Exactly 1,066 meet the Wikipedia-only ≥20-edition threshold. Of these, 838 pass the coordinate and unique valid GMBA-region checks, including 227 volcanoes. Proposed tiers before editorial review/overrides: 62 Easy, 180 Medium, 596 Hard.

The 3 MB `data/processed/world-discovery.json` contains every candidate, including excluded/pending records, and `world-discovery-status.json` confirms completion. Identity uniqueness and counts were verified. All candidates remain `reviewed: false`; discovery and spatial eligibility are not a substitute for checking individual summit/volcano identity and recognizability. This was the retrieval-stage state; the subsequent review and activation are documented below.

## Expanded catalogue activation — 1 October 2026

The 1 October baseline catalogue was `mode-13d7445c720f`, with 771 targets: 62 Easy, 172 Medium and 537 Hard, including 215 volcanoes. Of the 838 candidates passing geographic/recognition checks, 67 are held after catalogue-level review of recorded names, classes and Wikipedia identities: regional/multi-summit identities, island reference points, passes, cultural sites, thermal fields and other unsuitable point targets. Every discovery identity has a recorded decision, including the candidates that already failed automated checks.

This review uses the retrieved records; it is not a field survey or independent verification of every summit coordinate. Recognition remains the versioned Wikipedia-edition proxy. The publisher checks the discovery SHA-256, complete status, unique decisions, recognition floor and original GMBA membership again before writing static assets and updating the mode index. A changed snapshot requires renewed review. Recorded English Wikipedia article titles replace ambiguous/malformed English labels (for example Cofre de Perote); localized recorded names remain available. The explicit Annapurna I tier override is retained.

Volcanoes remain point targets within Worldwide Peaks, using the same 250 km exponential scoring and 15% GMBA region bonus. `provenance.featureType` distinguishes mountain/volcano prompts in EN/DE/FR/IT. There is no extra mode or filter separating volcanoes. Country arrays in this worldwide release are empty because the discovery export does not contain normalized country claims; worldwide gameplay has no country filters and uses GMBA region hints. The source Wikidata links retain access to those records.

Earlier static versions are retained. Existing mode sessions continue to restore their pinned dataset; fresh challenges use the expanded catalogue. Deploy these static assets before the updated API index, following the existing deployment order.

Release validation: production build and typecheck pass; 54 unit/API tests and 19 data tests pass. Sixteen desktop/mobile mode checks pass, including the expanded catalogue, all four volcano prompt translations, progression, independent progress and restoration from the previous dataset. An offline rebuild reproduced `mode-13d7445c720f`.

## First regional policy — 2 October 2026 (superseded by v3)

`world-admission-v2` separates admission from difficulty. The international-recognition route retains the 20-Wikipedia-edition minimum. The regional-significance route requires at least one recorded Wikipedia article in any language, an individually identified summit, unambiguous Earth coordinates, unique membership in an original valid GMBA Standard 300 polygon, and an explicit review decision. Evidence contains a significance category (`regional-high-point`, `climbing-objective`, or `landmark`), a concise rationale, named authoritative/specialist source URLs, and coordinate-verification notes tied to the exact published position. Sources are references, not republished guidebook text. Coordinate comparisons are desk checks, not independent field surveys. Conflicting summit coordinates and unresolved multi-summit identities remain held.

The existing 771-target baseline is retained. Easy remains ≥60 editions, Medium 35–59, and Hard covers other admitted peaks; existing documented overrides remain. A new tier override requires an explicit reason. The daily selection algorithm, scoring and original regional polygons are unchanged. The public target schema remains version 2; admission policy, route and evidence live in provenance. Saved games continue to resolve their original versioned assets.

### Repeatable expansion workflow

```sh
# Geographic discovery: fixed, cached 10-degree boxes, no sitelink floor or result LIMIT.
npm run data:world:discover -- --region gmba:13064
# After reviewing/publishing a batch, select the next unexpanded low-coverage unit(s).
npm run data:world:discover -- --next-regions 1
# Complete cached requests can be reused offline.
npm run data:world:discover -- --region gmba:13064 --offline
# After recording review decisions and pinning the new discovery SHA-256:
npm run data:modes -- --mode world --offline
npm run data:explore
```

The source query covers mountain and volcano subclasses and deduplicates IDs across classes and boxes. Boxes can also retrieve neighboring regions; exact GMBA membership is checked separately. A missing batch or metadata record prevents snapshot replacement. Geographic discovery preserves existing records and never admits new candidates automatically. `world-regional-discovery-status.json` records completion; raw responses, transient retrieval status and cooldowns are cached under `.cache/modes/discovery/`. Baseline-only discovery is refused once regional expansions exist, preventing accidental loss of additions.

Every candidate must have exactly one include/hold decision in `data/config/world-review.json`. Keep unverified candidates on hold with a reason; never mark a batch reviewed merely because its query completed. Set `admissionPolicy`, pin the complete snapshot's SHA-256, and provide evidence before including a regional candidate. Any changed snapshot requires renewed review. The pinned `baselineVersion` makes before/after reporting reproducible across offline rebuilds.

Publication generates [the complete coverage table](WORLD_COVERAGE.md) and `data/processed/world-coverage.json`: all 291 source units, invalid polygons, zero-target regions, tier counts, held reasons, unassigned candidates, baseline comparisons, and a review queue ordered by included count then stable ID, restricted to valid units with fewer than 20 targets. Geographic discovery completion does not imply that every candidate is reviewed or that every physical mountain was found.

### Explorer count investigation

The public explorer at `https://digital-landscape.at/AlpTap/explore/world-peaks.json` was checked on 2 October 2026: it served 771 targets and 16 in GMBA `13064`, matching the repository baseline. Between 49°S and 52°S, that baseline contained only Fitz Roy and Cerro Torre. The broader GMBA Patagonian Andes unit extends north to about 35.6°S and south to about 55.9°S, so its count differs from a southern Patagonia map view. Map clusters and difficulty/search filters also affect visible markers. The exact reason for the reported three-marker view cannot be established without its viewport/filter state; it was not a stale deployed catalogue.

Region-name search now makes regional totals directly inspectable: select Worldwide Peaks and search `Patagonia`, with All difficulties selected. The explorer export records its source version and retains all Wikipedia editions, including local-language-only articles, so its source links and target IDs agree with the game catalogue.

### First regional batch: 2 October 2026

Release `mode-570154372ed8` contains **785 targets (62 Easy, 172 Medium, 551 Hard)**. The original 771 identities, names, positions, difficulties and GMBA assignments are retained. Patagonia increases **16 → 30**, while Alpine coverage stays at 119 and its worldwide share decreases **15.4% → 15.2%**. The number of represented regions remains 149; this batch deepens coverage rather than filling new regions.

The 14 additions are Aguja Poincenot, Aguja Saint Exupery, Monte San Lorenzo, Cerro Castillo, Cerro Arenales, Lautaro, Melimoyu, Michinmahuida, Cerro Standhardt, Aguja Guillaumet, Aguja Mermoz, Cerro Pollone, Aguja Rafael Juárez and Cerro Solo (Los Glaciares). PATAclimb and Andeshandbook descriptions establish individual climbing objectives, landmarks or high points. Review records retain the source URLs, rationale, reference coordinates and measured coordinate differences. No points were relocated to qualify for a region. All additions have 1–19 Wikipedia editions and default to Hard.

Cerro Piergiorgio and Cerro Domo Blanco remain held because the article and Wikidata summit reference points differ; Torre Egger and Yate have ambiguous Wikidata coordinates. Murallón and Mount Tarn have larger source-position discrepancies; Monte Sarmiento needs its east/west summit identity resolved. These gaps are not filled to meet a quota. Southern climbing destinations now have broader representation, but Patagonia is not claimed to be exhaustive.

The next zero-target region by stable ID, Aldan Mountains (`gmba:11117`), was geographically searched as the first worldwide queue batch. Its two boxes returned 503 additional discovery identities, of which seven fall inside that original polygon; none yet has the complete significance and coordinate evidence required for admission. The combined snapshot contains 6,943 identities with explicit include/hold decisions. Neighboring-region results remain available for later review. Continue the ordered queue with `--next-regions`, and revisit held regions when stronger evidence becomes available.

Validation: production build and typecheck pass; 58 unit/API tests, 29 Python data tests and 10 targeted desktop/mobile browser checks pass. Browser checks cover regional counts, difficulty filters, a Spanish-only source link, the active catalogue and saved sessions from both `mode-c21e681de816` and `mode-13d7445c720f`. Offline geographic replay preserved the reviewed snapshot hash, and a second offline publication reproduced `mode-570154372ed8`. All 298 original scoring/display geometry assets match the previous release byte for byte. These assets are prepared locally; production deployment is a separate step.

## Global language-independent expansion

The regional strategy now applies worldwide. `world-admission-v3` retains one Wikipedia article in any language as a usable information-link requirement, but **does not use translation count to decide inclusion or difficulty**. `legacy-reviewed` is restricted to identities in the pinned previous release; it cannot admit a new identity. All new targets need regional-significance evidence. Regional high points, climbing objectives and landmarks remain valid alongside a new `topographic-prominence` category (a sourced value of at least 1,500 m). Prominence is an additional route, not a replacement universal threshold; Mount Bogong qualifies as a regional high point below it.

`world-recognition-v3` preserves all prior reviewed tiers and requires an explicit `difficultyReview` for every new target. A new Easy or Medium assessment must cite recognition or a clear geographic anchor; numbers of articles, languages or countries never set its tier. Hard is provisional where broader recognition has not been established, and can be revisited using recognition evidence or player success rates. Difficulty is about locating a summit, not technical climbing grade or physical prominence. This phase does not claim that the inherited tiers have been globally recalibrated. Daily selection remains unchanged.

The global Wikidata P2660 search returned 1,541 unique candidates without a sitelink or language-count floor. Metadata enrichment merged 1,149 new identities into the existing snapshot. The complete research snapshot now has 8,092 identities. The default discovery command runs this global search at 1,500 m; geographic discovery and the underrepresented-region queue remain available for areas or landmarks absent from prominence data.

```bash
npm run data:world:discover -- --prominence-min 1500
npm run data:world:discover -- --prominence-min 1500 --offline
python scripts/review_world_inventory.py --source .cache/modes/review/global/world-ultras.kmz
# Inspect suggestions, then record explicit include/hold decisions, evidence and difficulty reviews.
npm run data:modes -- --mode world --offline
npm run data:explore
```

The source comparison uses the [Peaklist world inventory](http://www.peaklist.org/ultras.html), compiled by Aaron Maizlish, Jonathan de Ferranti and regional contributors, and its linked [2007 KMZ](http://peaklist.org/misc/ultrasgoogle052007.KMZ). Record names, alternative names, prominence and coordinates are checked against individual Wikidata identities and original GMBA membership. The source archive SHA-256 and exact source point are stored in each reviewed evidence record. Some original source IDs are reused or blank, so record ordinal plus archive hash identifies the reference. The comparison tool produces suggestions only: proximity is never automatic approval. The 300 m comparison window limits this batch's desk review; it is not a claim of survey accuracy or a tolerance that can repair conflicting identities.

Source mismatches are explicitly held: for example, Telescope Peak is labelled White Mountain Peak in the old inventory; range references such as Dena, Nun-Kun and Lefka Ori cannot be admitted as individual summits. Batian would duplicate the published Mount Kenya identity, whose coarse legacy point needs a separate coordinate review. The previously reviewed point is preserved for this expansion. Original sources are historical and not a complete, current inventory; no source text is reproduced and factual references retain attribution.

The reviewed batch adds **300 targets across 93 GMBA regions**, making **1,085 targets: 62 Easy, 174 Medium and 849 Hard**. Margherita Peak and Mount Bogong receive sourced Medium assessments; the remaining 298 are provisionally Hard. All 785 previously reviewed targets and their names, points, regions and tiers are unchanged. The represented-region count grows **149 → 175**. Relative to the original baseline, Alpine share falls **15.4% → 12.8%**, even though the Alps gain 20 qualifying targets themselves. This is a global expansion, not a Patagonia-only quota.

See [the complete global batch](WORLD_GLOBAL_BATCH.md) for names, domains and remaining gaps, and [the coverage audit](WORLD_COVERAGE.md) for all 291 source units. `data/config/world-global-batch.json` records the explicit batch identities and source-match holds; `world-review.json` retains each full decision and evidence. Geographic-search completion is separate from global-prominence-search completion; a worldwide prominence query does not mean every GMBA region received an exhaustive geographic search. Antarctica remains unassigned because the preserved source has no Antarctic scoring units. Raw downloads and suggestions are ignored; reviewed evidence, reports and versioned assets are tracked.

Current global release: `mode-37dabf082c4a`. Original assets, including `mode-570154372ed8`, remain available for saved sessions.

Global release validation: production build/typecheck, 58 unit/API tests, 37 Python data tests and 14 targeted desktop/mobile browser checks pass. Checks include all six inhabited world domains gaining targets, exact game/explorer identity parity, held range/duplicate identities, a Medium target with two article editions, and restoration from all three previous worldwide releases. Two offline publications reproduced `mode-37dabf082c4a`; previous geometry files remain byte-identical. The release is prepared locally and has not been deployed.
