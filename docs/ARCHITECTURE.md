# Architecture

## Boundaries

- `src/core`: platform-independent types, configuration, Vienna date, deterministic selection, scoring, name resolution, localization, and persistence validation.
- `src/data`: replaceable challenge-provider contract and versioned static dataset loader. No global browser point-in-polygon joins. Exact geometry for the current peak’s sections is loaded individually to test the single submitted guess and draw the post-guess outline.
- `src/map`: MapLibre rendering, markers, satellite/DEM configuration, camera and reveal animation. Game logic never depends on elevation tiles.
- `src/App.tsx`: round state, presentation, preferences, summary, and accessibility. A map click immediately submits and locks the guess; results are immutable through the interface.
- `server`: a small Node HTTP service. It loads an immutable index at startup, validates all pools, enforces query/CORS rules, and returns daily IDs.
- `scripts`: pinned Python preprocessing and TypeScript diagnostics.

## Deterministic daily deck

Selection uses a seeded Fisher–Yates permutation of a sorted candidate pool. The seed includes algorithm version, dataset version, region, difficulty, and round count. The UTC ordinal of the explicit Vienna calendar date advances the circular deck by `roundCount` cards. The date also seeds the within-day order. Any pool with at least twice the round count guarantees zero same-day duplicates and no overlap between adjacent automatic challenges, including wraps. No prior-day recursion, runtime randomness, machine timezone, or live geographic API is involved.

`data/config/curated.json` maps `YYYY-MM-DD|region|difficulty` to an ordered ID array. Overrides must have the expected count and distinct eligible IDs; campaign overrides intentionally may repeat peaks across days. They receive distinct challenge identities. Do not change published overrides during an active day.

Scoring uses a haversine great-circle distance on a sphere with mean Earth radius 6371.0088 km, not map pixels or terrain slope length. The distance component is `exp(-distanceKm / 50)`. For a guess covered by any of the target summit’s SOIUSA sections, add `0.15 × (1 − distanceComponent)` before rounding to 0–1000. Multiple matching sections do not stack bonuses. This is a geographic approximation rather than an ellipsoidal surveying calculation.

## Storage and rollover

Preferences override browser-language defaults. Region defaults to All Alps and daily mode to mixed (Easy, Medium, Hard). Former single-tier sessions remain separately stored. Per-region/difficulty session keys store the complete challenge, selected peak snapshots, submitted marker, scored results, round index, and completion state. Scores are recomputed when restoring valid saved results. Invalid/corrupt state is discarded safely; quota/private-mode failures show a visible notice.

An unfinished game with confirmed progress may continue after Vienna midnight. A fresh challenge uses the server's date. A completed prior-day game refreshes on next load, or offers the new day's challenge if the page remained open. Successful API responses are cached; only today's cached list is used when the API fails. A machine with a wrong clock may have misleading fallback eligibility, but online challenge dates come from the server.

The API has no anti-cheat guarantee: all peak coordinates are public static assets and results are local. It does not identify users or track guesses. Network requests at play time are the daily API, static assets, satellite/DEM tiles, and typography from Google Fonts. No analytics or location permission requests are implemented.

## Extension points

Peak country arrays support future country filters. Generic geographic units retain parent/level IDs, enabling finer SOIUSA inputs without changing point assignment semantics. Region IDs are distinct from labels. New supported UI/API selectors can share the same filter/generator contract. Curated challenge overrides and optional scientific-content references on peaks, units, and challenges support institute campaigns without a CMS. A future answer-hiding API can replace the provider and scoring boundary if needed.


## Interaction and scoring migration

`interactionVersion: instant-v2` distinguishes a submitted marker from an old unconfirmed marker. Old unconfirmed markers are cleared on restore; new submitted guesses resume after section-loading failures. `section-v2` results store matching section IDs, distance points, and area bonus; restores recompute their score without losing the bonus. Legacy `distance-v1` rounds stay distance-only. Section geometry fetch failures do not silently remove the bonus. The boundary-inclusive point test supports MultiPolygon islands and interior holes.

## Primary peak catalogue

The default importer is `scripts/wikidata_peaks.py`; it discovers mountains from Wikidata directly, independently of OSM. `wikidata:Q…` IDs are accepted alongside legacy `osm:node/…` IDs so old saved challenges continue working. Shards use the final numeric ID modulo 64. Wikipedia article URLs are supplied by cached sitelinks, resolved by interface language with an explicit language fallback. The question shows the recorded SOIUSA section name before guessing.

Mixed selection uses mixed-tier-deck-v1: independent seeded sorted-ID decks per tier, advancing one card per Vienna calendar day. Output order is Easy, Medium, Hard. Each tier needs at least two peaks to avoid adjacent-day repeats across wraps; production validation retains six per region/tier. Mixed curated overrides must follow tier order. Dataset and algorithm versions are included in identity.

## Additional daily modes

See [mode datasets, scoring, API, release gates and deployment](MODES.md) for Worldwide Peaks and Alpine Valleys. Existing Alpine data and session formats remain supported.
