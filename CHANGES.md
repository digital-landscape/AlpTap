## 2026-10-01 — Preserve original branding and defer Valleys

- Removed Valleys from the selector while retaining preparation work and saved data.
- Shared the original AlpTap mountain mark and typography across Alpine and Worldwide headers.
- Prepared the feature branch for integration into the primary `master` branch.

## 2026-10-01 — Group game choices by geography

- Grouped Alpine peaks, regional Alpine games and valleys together, with Worldwide Peaks in a separate group; translated group labels in all four languages.

## 2026-10-01 — Restore visible Alpine region choices

- Added direct Western Alps and Eastern Alps entries to the main selector in all four languages, preserving existing regional games and progress.

## 2026-10-01 — Expanded Worldwide Peaks enabled

- Replaced the initial shortlist with the reviewed full-discovery catalogue: 771 mountains/volcanoes, including 215 volcanoes (62 Easy, 172 Medium, 537 Hard).
- Added snapshot-pinned inclusion/exclusion decisions for every retrieved identity; held 67 ambiguous or unsuitable point targets from the geographically eligible pool.
- Preserved GMBA polygons/scoring and older versioned datasets; added volcano-specific prompts in all four languages.
- Publisher now requires complete discovery and matching review evidence before activating a new release.

## 2026-10-01 — Complete worldwide discovery retrieval

- Resumed cached requests and finished the GMBA matching/export: 1,165 unique mountain/volcano candidates, including 362 volcanoes.
- 1,066 pass the Wikipedia edition threshold; 838 also pass coordinate and region checks. Retained failed checks and unreviewed status for catalogue review.
- Verified unique identities, completion status and tier counts without changing the active game dataset.

## Repository checks

- Documented `master` as the primary Git branch and removed a duplicate ignore rule.
- Fixed the scoring-curve browser test to select its named slider when terrain controls are visible.

## Worldwide mountain and volcano discovery

- Added unbounded worldwide Wikidata discovery for mountain and volcano classes, replacing manual candidate enumeration for the retrieval stage.
- Added batched identity/coordinate/name/Wikipedia enrichment, Wikipedia-only recognition checks and original GMBA region assignments.
- Added resumable raw response caches, persistent Retry-After handling, explicit completion status and an unreviewed candidate export separate from published game data.

# Worldwide peaks and valley mode infrastructure — 2026-09-30

- Added localized mode selection, independent daily progress and versioned `/v2/challenge`; retained legacy Alpine sessions and `/v1` compatibility.
- Published 107 reviewed worldwide peaks with exact GMBA Standard 300 scoring regions, 250 km distance scoring and remaining-points bonuses.
- Added world overview, antimeridian reveal handling and bold current difficulty; preserved satellite/terrain exploration and free Mont Blanc practice.
- Implemented polygon-based valley scoring, outlines, holes/multipolygons and saved-guess retry handling.
- Inspected Swiss, French, Piedmont and Austrian source downloads. Kept valley release disabled: 19 candidates pass in CH/FR/IT; Austria's matched unit combines Enns/Gaflenz valleys and also lacks Wikidata coordinates.
- Added reproducible data preparation, documented source definitions/attribution, release gates and inclusion/exclusion reports; kept exact and display geometry separate.
- Added mode API/scoring/persistence/data checks and desktop/mobile regressions, with synthetic valley fixtures isolated from production catalogues.

# Changes

## 0.2.0 — 2026-09-29

- Replaced guess confirmation with immediate click/tap submission and first-click locking.
- Added animated marker landings, reveal rings, delayed summit reveal, line drawing, and counting scores.
- Added exact SOIUSA section outlines and names after the guess, with a 15%-of-remaining-points section bonus.
- Added an interactive scoring curve in About; preserved legacy scores and pending-click recovery.
- Kept the peak database and daily selection unchanged pending a better source.

## 0.1.0 — 2026-09-29

- Inspected and documented supplied SOIUSA sections before implementing geography.
- Added reproducible cached geographic processing, multilingual peak data, country attribution, difficulty diagnostics, and versioned production shards.
- Added a separately deployable deterministic daily API using Europe/Vienna dates and three configurable rounds.
- Added responsive satellite/terrain gameplay, movable guesses, animated reveals, smooth distance scoring, and daily summary.
- Added four interface languages, recorded mountain-name resolution, local preferences/progress, and graceful service failure states.
- Added automated core/API/geography and desktop/mobile browser tests.
- Preserved original SIOUSA files; no site published or Git repository initialized.

## Wikidata-primary catalogue

- Default peak discovery is now independent of OSM, using Wikidata mountain classes and coordinates with an exact SOIUSA join.
- Q-ID identities, recorded multilingual names and Wikipedia links; source-aware frontend shards and legacy-session compatibility.
- SOIUSA section names appear with the question before guessing.

## Static area localization

- All 40 geographic units have persistent EN/DE/FR/IT names with provenance.
- Questions, reveals and recap cards show the original area name followed by the selected-language name in parentheses.
- Existing daily selections stay unchanged; no runtime name lookup or translation.

## Mixed daily recognition challenge
- Ranked the Wikidata catalogue into explainable recognition bands with a CSV export.
- Daily games draw Easy, Medium, Hard in order, labeled during play and recap.
- Preserved single-tier API compatibility and stored progress; added classification and selection tests.

## First-visit instructions
- Added localized welcome instructions with an immediate language selector and an isolated Mont Blanc example.
- Highlighted the daily game mode and difficulty sequence in the welcome screen and game toolbar.
- Remembered dismissal locally and made instructions reopenable from About AlpTap.

## Playable first-shot practice
- Replaced the illustrative Mont Blanc button with a real map guess and distance reveal, separate from daily progress.
- Added an explicit transition from practice results to the daily challenge; paused daily advancement during practice.
- Bolded the current Easy, Medium, or Hard stage in the toolbar.
## Current-time solar cast shadows — 2026-09-30

- Replaced fixed hillshade with original WebGL 2 light-space depth shadows, using the technique inspected in Vector Vario's deployed renderer.
- Calculate sunlight from the viewed location and current UTC time; refresh every minute, after view changes and when returning to the tab.
- Added filtered ridge occlusion, ambient night lighting, terrain-height synchronization, bounded DEM caching and GPU cleanup.
- Added solar-position tests, synthetic GPU ridge checks and desktop/mobile live refresh checks.

## Shadow controls — 2026-10-01

- Added an independent, localized Sun shadows toggle beside the terrain button on desktop and mobile.
- Default shadows to off below the viewed location's solar horizon; follow daylight until manually overridden for the page session.

## Institutional logo placement prototype — 2026-10-01

- Added an isolated `/logos-prototype.html` preview with the live game above a white institutional strip.
- Preserved the supplied ÖAW and IGF SVG animations; matched image heights and placed IGF to the right of ÖAW, with responsive sizing.

## Finished institutional footer — 2026-10-01

- Integrated a compact white ÖAW / IGF signature row into every game mode; the map occupies the remaining height.
- Logos link to the German institution pages for German and English pages for English, French and Italian, opening in new tabs with accessible localized labels.
- The earlier prototype URL now leads to the finished app.

## Compact institutional signatures — 2026-10-01

- Removed the separate institutional strip, restoring its full height to the map.
- Reused the center of the desktop header and the left of the existing mobile footer for the animated, linked logo pair.

- Added a localized “Designed by” caption to the compact institutional signatures.

- Centered the institutional credit over its divider by using equal-width logo slots, preserving equal logo heights.

## Cropped institutional logos — 2026-10-01

- Switched the signature pair to the supplied cropped animated SVGs so equal image heights correspond to equal artwork heights.
- Retuned spacing and centered equal-width slots; retained localized external links and animations.
- Kept mobile saved-progress text from overlapping the compact logo badge on narrow screens.

- Removed equal-width logo slots to give each cropped logo the same gap from the divider; the credit remains centered over the whole pair.

## Welcome institutional credit — 2026-10-01

- Added the animated ÖAW / IGF pair and localized “Designed by” credit beneath the welcome popup's practice button, reusing the existing language-aware links.
