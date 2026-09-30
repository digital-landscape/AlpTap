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
