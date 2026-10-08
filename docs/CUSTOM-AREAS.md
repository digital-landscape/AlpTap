# Custom areas and daily game links

## Player flow

The Custom button opens a separate drawing view. Tap to place corners, drag to pan, or use the map-center button with keyboard navigation. Undo removes the last corner; Clear starts again; Cancel or Escape returns to saved game progress. Drawing clicks never submit game guesses. Finish closes the polygon and previews its source database, Alpine overlap, and eligible mountain count. Edit returns to drawing; Play starts a three-round daily challenge.

The editor accepts one simple ring with 3–64 distinct vertices and no holes. Coordinates are rounded to five decimal places before preview, filtering, selection, or sharing. Edges crossing the date line are unwrapped continuously; rings winding around a pole and exactly 180-degree ambiguous edges are unsupported and rejected. Self-intersections, backtracking edges, degenerate polygons, and invalid coordinates are rejected. Peaks on the polygon boundary qualify.

Overlap uses the union of the published dataset's SOIUSA section geometries, not a rectangular Alpine extent. Polygon clipping is done on continuous longitudes. Spherical area is measured by integrating longitude differences against sine of latitude, subtracting holes. More than half the polygon's geographic area must overlap the Alps to select Alpine data; 50% or less selects world data. No source blending or automatic source fallback occurs. Worldwide data remains the reviewed catalogue, so many small areas have insufficient peaks.

Selection requires at least three distinct eligible IDs. Each available tier supplies one daily pick from a seeded circular deck. Missing tiers are filled from a separate deterministic shuffle of remaining candidates. Picks are shown in difficulty order, with ID order as the tie breaker. A polygon with only three eligible peaks necessarily repeats those peaks on subsequent days. Standard regional and worldwide selection algorithms and curated overrides remain unchanged.

The map frames the custom polygon and retains its outline independently of scoring/reveal outlines. Alpine games keep Alpine scoring and section bonuses; world games keep worldwide scoring and GMBA bonuses. Custom valley games are not supported.

## URL contract, version 1

```text
?mode=alpine-peaks&region=western-alps
?mode=world-peaks
?mode=custom&v=1&catalog=catalog-<16 hex digits>&poly=<base64url>
```

Standard modes may omit the region (`alps`) and catalogue (current release). A supplied mode overrides saved mode/region preferences; a URL without game settings uses those preferences. Copy link adds `v=1` and `catalog` to standard links and updates the address without restarting the game. Custom URLs require all three version, catalogue, and polygon parameters. Unsupported versions/modes, duplicate settings, malformed polygons, or unavailable releases produce an error with retry and a separate action to open today's default game. They never substitute different picks silently.

The polygon encoding uses integer coordinates at 1e-5 degrees, alternating longitude and latitude deltas, zigzag unsigned varints, and unpadded URL-safe base64. Both traversal directions and starting vertices normalize to the same representation. Decoder input is bounded to 1,400 characters and 64 vertices. The URL version freezes this encoding, geometry interpretation, and `custom-v1` selection policy. Future algorithm changes require a new version and continued support for existing versions.

There is no date parameter. The browser's date in `Europe/Vienna` determines the daily challenge. The shell checks every ten seconds and on focus/visibility changes; all players with the same link and Alpine date obtain the same ordered IDs, regardless of interface language or local preferences. Device clocks must be correct. A shared link pins the catalogue across midnight and future deployments, but its selection changes daily. New links without a catalogue use the current release.

Game links never include player guesses, results, or explicit answer IDs. Completed custom games offer Share results and Copy results: the message includes scores and a daily link containing the polygon and pinned catalogue. Both Alpine and worldwide custom areas retain their polygon-based scoring when opened. The link follows the same daily rollover rules as Copy link; it does not freeze the completed day. This remains a casual client-side game: public data and deterministic selection can be inspected. No backend, account, or short-link service is required. Deployment base paths are preserved.

## Release and persistence contracts

`scripts/prepare-catalog.mjs` derives a release from versioned peak shards, manifests, SOIUSA sections, selection indexes, and curated overrides. It includes minimal candidate positions and difficulties for polygon filtering. The release ID is the first 16 hex digits of its SHA-256 content hash. The builder refuses to overwrite an existing release with different bytes. `current.json` identifies the release to use for unpinned links.

Dev and build commands regenerate the current catalogue. Commit `public/data/catalogs/current.json` and newly created immutable JSON files. Deploy the complete static output; retain all historical catalogue and referenced `alps-*` / `mode-*` files. Serve the current pointer with revalidation, and catalogue-ID files with immutable caching. Never replace a pinned dataset with new content under its old name. Public URL games use these static releases even when a legacy API is configured; the existing API endpoints and provider functions remain available.

Progress keys include the catalogue ID and canonical challenge ID. Custom IDs include polygon encoding, selection version, and Alpine date. Matching legacy standard sessions are imported. Existing legacy entries belonging to another challenge are retained. Restore validates progress structure and recomputes results using authoritative targets and scoring geometry; cached coordinates and scores are ignored. Missing geometry causes a retryable error without deleting progress. If browser storage is blocked or full, a shared in-memory store preserves progress while this page remains open and the existing storage warning is shown. Switching polygons, regions, dates, or catalogue releases keeps sessions separate.

## Verification

`tests/custom.test.ts` covers canonical encoding, boundaries, invalid rings and payloads, date-line continuity, geographic overlap and holes, 50% source choice, deterministic tiers/fallbacks, and URL parsing. `tests/shared-play.test.ts` exercises the published catalogue, unchanged standard selections, independent progress, pinned releases, unsupported versions, and failure without fallback. Existing browser tests cover gameplay, restoration, onboarding, navigation, and failure states. Browser review captures are disposable files under ignored `output/playwright/`.

## Surface-based scoring

Custom Alpine and worldwide games measure the canonical polygon with the same spherical area integration used for overlap, multiplied by the mean Earth radius squared (6,371.0088 km). Longitude unwrapping keeps date-line polygons local; concave areas use their actual surface, not the bounding rectangle. Surface is an approximation on a sphere, not terrain slope area.

The distance at which the base score reaches 10 points is `clamp(sqrt(areaKm2), 1, standardFarDistanceKm)`, capped at 300 km for Alpine data and 2,000 km worldwide. The full-score radius scales by `customFarDistanceKm / standardFarDistanceKm`, with a minimum 25-metre click buffer. Thus 100 km² gives a 10 km distance reference, and 400 km² gives 20 km. The 1 km minimum distance reference keeps exceptionally tiny polygons playable. Long, narrow polygons can be more demanding than compact polygons with the same area.

The existing smooth distance curve, maximum of 1,000 points and 15% remaining-points section/region bonus are preserved. Ordinary daily games, practice and exact challenge replays retain their existing scoring. The polygon determines the scale for both live evaluation and restoration; cached scores or profiles are never trusted. Older custom progress is recalculated under this curve without changing selected peaks or progress keys.

The preview and About dialog explain the scaling in all four languages and display the actual full-score and 10-point distances. The Alpine scoring chart adapts its curve, formula, axis and slider to the custom scale. Regression coverage in `tests/custom-scoring.test.ts` and `tests/shared-play.test.ts` checks area measurement, proportional precision, limits, bonuses and reload consistency for both databases.
