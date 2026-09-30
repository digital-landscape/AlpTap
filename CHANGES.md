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
