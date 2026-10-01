# AlpTap

Daily mountain geography games with satellite imagery: Alpine Peaks, Worldwide Peaks, and a data-gated Alpine Valleys mode.

The prototype includes a static React/TypeScript frontend, a separately deployable Node daily-selection API, MapLibre terrain, English/German/French/Italian interfaces, one-click guesses, animated reveals, SOIUSA section bonuses, local progress, and a prepared **Wikidata-primary database of 18,777 Alpine peaks**.

## Run locally

Requires Node 22.12+ (tested with Node 26), npm, and a browser with WebGL.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173** on this computer, or **http://<this-computer-network-IP>:5173** from another device on the network. The frontend listens on all network interfaces; restart `npm run dev` after changing this setting. The development command starts both Vite and the API on port 8787; Vite proxies `/v1` and `/v2`. The prepared dataset is included, so no geographic download or Python setup is required to play.

```sh
npm test                 # pure logic, persistence, provider, and live HTTP API tests
npm run test:data        # Python geographic tests; requires uv
npx playwright install chromium
npm run test:e2e         # desktop/mobile gameplay, settings, failure states
npm run build           # static dist/ and standalone dist-api/server.mjs
```

Browser tests use real imagery for visual checks and therefore need network access. Browser captures go to ignored `output/playwright/`.

## Two independent deployments

1. Set `VITE_API_URL=https://api.example.org` when building the frontend. Upload `dist/` to any static host with HTTPS and gzip/Brotli enabled.
2. Deploy `dist-api/server.mjs`, `data/processed/api-index.json`, and `data/config/curated.json` to a Node host. Run from their common root:

```sh
HOST=0.0.0.0 PORT=8787 CORS_ORIGINS=https://play.example.org node dist-api/server.mjs
```

Terminate HTTPS at your hosting provider or reverse proxy. `DATA_INDEX` and `CURATED_FILE` can point to absolute paths. `/health` reports the loaded dataset version. CORS is an explicit allowlist, not authentication. No cookies or account database are used.

The API accepts `GET /v1/challenge?region=alps&difficulty=mixed`. It determines today in `Europe/Vienna`, returns only ordered IDs and challenge metadata, and never accepts a client-supplied date. The static frontend downloads the matching versioned peak shards and performs reveal/scoring locally. **Coordinates are inspectable in public data; this prototype does not prevent cheating.**

Deploy new versioned data assets **before** updating the API index. Keep previous version directories for in-progress challenges. Switch an API's dataset only at Vienna midnight to keep the same challenge for all players on a given day. Existing sessions persist their peak records, IDs, guesses, and results. Do not overwrite an existing dataset version with changed content.

For a production preview locally, run the built API with `npm run start:api` and build with `VITE_API_URL=http://127.0.0.1:8787 npm run build`, then `npm run preview`. Alternatively use the normal development command.

## Data preparation

Install [uv](https://docs.astral.sh/uv/), then:

```sh
npm run data:peaks                  # download/cache sources, enrich, process, validate
npm run data:peaks -- --offline     # rebuild from the same cached source snapshot
npm run data:peaks:legacy           # optional historical OSM-first importer
npm run data:peaks -- --geography-only
npm run data:inspect                # counts, gaps, distributions, today's list
npm run data:inspect -- Matterhorn  # recorded names, countries, section, difficulty explanation
```

Raw source caches live in `.cache/data/`; dependency/cache files are ignored. Python dependencies are pinned in `scripts/uv.lock`. Successful downloads are reused; interrupted geographic downloads resume. Wikidata discovery and metadata queries are cached in resumable batches. A failed required query stops publication; the previous playable dataset remains available. Archive `.cache/data/` with each release for reproducibility; downloaded raw data is not needed at runtime. To refresh sources, archive the cache and run against a new empty cache directory at the same path.

Wikidata supplies primary IDs, coordinates, multilingual labels, aliases, country claims, elevations and Wikipedia links. OSM is secondary and is not required by the default catalogue builder. Missing information is never fabricated. Dataset-wide Easy/Medium/Hard classes are an initial reproducible identification heuristic, not a scientifically validated public-familiarity ranking or climbing difficulty.

See [geographic inventory](docs/GEOGRAPHY.md), [pipeline and difficulty details](docs/DATA.md), and [architecture](docs/ARCHITECTURE.md).

## Configuration

Terrain mode uses custom WebGL 2 terrain cast shadows driven by the current date/time and viewed map location. Sunlight updates every minute and when returning to the tab or changing the view. The terrain height slider also changes the shadow geometry. Flat mode and zero height hide shadows; shadow failure leaves the satellite map usable. Manually enabling shadows at night uses readable ambient dimming. No device location is requested. See [solar shadow notes](docs/TERRAIN-SHADING.md) for the renderer, precision limits and fallback behavior.

Copy `.env.example` to `.env` for Vite's build-time settings. Change satellite URL/attribution, native zoom, DEM URL/encoding, terrain enablement, or exaggeration independently in `src/map/config.ts` or through the environment. Default terrain uses Mapzen Terrarium with exaggeration 1.5 and falls back to 2D on failure. The MapLibre example DEM was inspected but is a small JAXA sample; it was not used for all-Alps coverage.

Round count, score decay, and algorithm version are centralized in `src/core/config.ts`. Changing the round count changes challenge identities; dataset validation must continue to require at least twice that many peaks in each pool. UI progress and summary derive their count from the challenge. Update the four introductory/help messages if changing the default three-round game.

## Attribution and release considerations

- Historical OSM dataset only: peaks and administrative country boundaries: [© OpenStreetMap contributors, ODbL](https://www.openstreetmap.org/copyright). Country geometries are cached from [polygons.openstreetmap.fr](https://polygons.openstreetmap.fr/).
- Primary peak data and names: Wikidata, [CC0](https://www.wikidata.org/wiki/Wikidata:Licensing).
- Satellite: [EOX Maps](https://maps.eox.at/), Sentinel-2 cloudless 2024, modified Copernicus Sentinel data; the WMTS metadata declares CC BY-NC-SA 4.0. The service is rate-limited; coordinate broader public use and terms with EOX as planned.
- Terrain: [Mapzen terrain tiles and contributor attribution](https://github.com/tilezen/joerd/blob/master/docs/attribution.md). Includes Copernicus EU-DEM, Austrian open elevation data, and USGS SRTM/GMTED; applicable source credits are linked in the map and About dialog.
- Supplied SOIUSA boundaries: Capleymar / [Homoalpinus](https://www.homoalpinus.com/alpes/subdivisions/soiusa/). Source files do not specify a redistribution license; confirm rights before public release. Only the current summit’s section polygons are loaded on demand for the area bonus and reveal outline; the complete hierarchy geometry is not downloaded at startup.

This milestone does not publish a site, add accounts, or provide leaderboards, streaks, a CMS, or a global peak dataset.

## One-click play and section points

Explore the map, then click/tap once to submit. There is no confirmation step and no repositioning after the click. A keyboard-accessible map-center button submits the same way. The guess marker lands immediately; the summit, connecting line, and score follow in an animated sequence. Reduced-motion preferences disable the animations.

The question names the SOIUSA section before the guess; the reveal also outlines its boundary. A point inside that section (including its boundary, excluding hole interiors) earns an area bonus. The dataset contains sections, not finer groups; the UI does not invent finer subdivisions. Section files are fetched individually, keeping the browser independent of the full polygon dataset. If a section cannot load, the submitted guess is retained and a retry is offered before final scoring.

Distance-only score is `1000 × exp(-distanceKm / 50)`. Correct-section score is `1000 × [0.15 + 0.85 × exp(-distanceKm / 50)]`: 15% of the remaining points are awarded, capped naturally at 1,000 with no flat perfect-score zone. The reveal separates distance points and bonus. About contains an interactive comparison curve. Confirmed legacy rounds keep their original distance-only score after refresh; new rounds record `section-v2` scoring. The current primary catalogue uses Wikidata identities. Older OSM dataset versions remain available for saved challenges.

Results remain visible for six seconds before advancing automatically, without a Next summit button. The final three result cards appear side by side on desktop and stacked on mobile. The final recap retains every submitted round with distance, points, elevation, SOIUSA section, and section bonus; it survives refresh.

The final recap reuses the full summit reveal content in three cards, including recorded names, distance/score breakdown, SOIUSA section, elevation, countries and source links. Public rollover copy uses “Alpine time (CET/CEST)”; scheduling remains Europe/Vienna for daylight-saving handling.

The pre-guess SOIUSA area hint is placed directly below the summit name, before any map submission, in a highlighted panel.

## Static area names

All 36 SOIUSA sections, the three parent regions and the auxiliary basin have permanent EN/DE/FR/IT labels in `data/config/area-names.json`, with original names and source metadata. The app shows `original (localized name)` in the question, reveal and recap; identical names are not repeated. Names follow the multilingual SOIUSA reference, with display spelling/casing normalized. The auxiliary basin translations are marked editorial.

No runtime translation, external lookup or repeated name-generation step is needed. The same file is used by preprocessing and the frontend, including saved challenges with older manifests. Future dataset builds incorporate its checksum into the dataset version; existing challenges and published versions are not rewritten merely to translate the UI.


### Mixed daily challenge
Every new daily game draws **one Easy, one Medium, and one Hard summit**, in that order. The API defaults to mixed; explicit single-tier requests remain compatible. Old single-tier progress stays stored separately.

The 18,777 peaks are ranked into **205 Easy, 3,262 Medium, 15,310 Hard**. See [the complete ranking](data/processed/difficulty-ranking.csv) and [classification rules](data/config/difficulty.json). Rebuild with `npm run data:peaks -- --offline`.

## First visit

New visitors see instructions in their browser’s supported language (English fallback), with a language selector using native language names. The welcome screen highlights the daily Easy → Medium → Hard mode and includes a Mont Blanc example that does not affect progress. Continuing from the practice result to the daily challenge dismisses it for this browser; reopen it via **About AlpTap → How to play**. Completion is stored as `alptap:onboarding:v1`; when storage is unavailable, instructions appear again on the next visit.

The welcome screen now starts a real, free Mont Blanc practice round on the satellite map. Tap to commit one guess and see the actual summit and your measured distance, then explicitly start the daily challenge. Practice has no time limit, never changes daily progress or points, and remains available through How to play. The toolbar bolds the current daily difficulty as rounds advance; no daily difficulty is marked during practice or after completion.

Press **Escape** from the welcome screen or at any point in Mont Blanc practice to skip directly to the daily challenge. Skipping is remembered just like completing practice. Desktop clicks submit on release only when the gesture began in the same active round. Dragging pans without guessing, and releasing a press begun during a result cannot submit the next round. Touch continues to submit on a tap with the same round guard.

Starting the next summit preserves the map position and zoom. The map frames the region on initial load or a region change; the reset control remains available to return to the regional view.

A vertical slider on the right, below the map controls (beside them on narrow screens), adjusts terrain exaggeration live from 0× to 3× in 0.1 steps (default 1.5×). It supports mouse, touch and keyboard arrows, and is disabled in 2D or when terrain is unavailable. Adjusting height preserves the camera view.

The initial Git snapshot includes the application, tests, documentation, and prepared datasets. Local caches, dependencies, build output, and browser captures are excluded.

## Worldwide peaks and Alpine valleys

The mode selector keeps each daily game's progress separate. Worldwide Peaks includes **771 reviewed mountains and volcanoes (62 Easy, 172 Medium, 537 Hard; including 215 volcanoes)**, original GMBA Standard 300 regions, a 250 km scoring scale, and region bonuses. Each worldwide round starts from a world overview.

Alpine Valleys gameplay and its multi-source preparation pipeline are implemented, but **release remains disabled**: 19 candidates pass review (7 Easy, 6 Medium, 6 Hard) across France, Italy and Switzerland; Austria has no fully verified entry yet. The app shows this mode as unavailable rather than releasing partial country coverage. Details, source definitions, exclusions, licenses and deployment instructions are in [mode documentation](docs/MODES.md).

Run `npm run data:modes` to prepare catalogues, or add `-- --offline` to reuse cached source snapshots. Deploy `public/data/mode-*` static assets before enabling `data/processed/mode-index.json` on the API host. `/v2/challenge` adds mode-aware target IDs; `/v1/challenge` and existing Alpine progress remain compatible. English, German, French and Italian instructions, the free Mont Blanc practice, and bold current difficulty are preserved.

### Full worldwide candidate retrieval

Run `npm run data:world:discover` to query worldwide Wikidata mountains **and volcanoes**, including subclasses, without a title shortlist or result limit. A safe ≥20 total-sitelink prefilter is followed by exact Wikipedia-edition counts and unchanged GMBA Standard 300 polygon checks. This downloads candidates to `data/processed/world-discovery.json`; `world-discovery-status.json` records completion or failure. It does not label unreviewed candidates as reviewed or silently replace the playable catalogue. Raw API responses and rate-limit cooldowns are cached; `-- --offline` reuses complete cached responses. The playable catalogue is prepared from this complete discovery snapshot and the pinned decisions in `data/config/world-review.json`; it no longer uses the initial 107-entry shortlist.

## Git workflow

The repository uses `master` as its primary branch. Commit application code, tests, documentation and prepared public datasets; local caches, secrets, dependencies and build output stay ignored.

The **Sun shadows** button beside **3D terrain** independently turns solar shading on or off. Its default follows daylight at the viewed map center: shadows are off when the sun is below the horizon, including nighttime visits. The automatic default is rechecked every minute and after map movement. Clicking the button overrides that default for the current page session, so night shading can still be enabled manually. The control is disabled in 2D, at zero terrain height or when elevation is unavailable.

Worldwide discovery completed on **1 October 2026**: 1,165 unique candidates, including 362 volcanoes. Of these, 1,066 have at least 20 Wikipedia editions; 838 also pass coordinate and GMBA membership checks (62 Easy, 180 Medium, 596 Hard, before editorial overrides). The [full discovery export](data/processed/world-discovery.json) retains all candidates and failed checks. These are unreviewed candidates, not automatically activated game targets.

## Institutional logos

The ÖAW / IGF signatures share existing interface space in every mode: centered in the desktop header and in a small white badge at the left of the existing mobile footer. A localized “Designed by” caption identifies the credit. No additional row reduces the map height. ÖAW remains left of IGF, using the supplied cropped SVGs with equal visible image heights (32 px desktop, 18 px mobile) and original animations and aspect ratios. Links open in a new tab: German selects the German ÖAW and IGF pages; English, French and Italian select their English pages. Assets are in `public/logos/`; the shared component is `src/ui/InstitutionFooter.tsx`. The earlier `/logos-prototype.html` URL redirects to the finished game.

Institutional logo links use their natural widths with equal spacing on either side of the divider. The desktop credit centers over the complete logo pair.

The welcome popup repeats the same linked logo pair and localized “Designed by” credit below its practice button. It shares the cropped assets and link logic with the main interface and remains in normal dialog flow for small-screen scrolling.

### Expanded worldwide game enabled

Worldwide Peaks now uses `mode-13d7445c720f`: **771 targets including 215 volcanoes**. The catalogue review admits 771 of the 838 geographically eligible candidates and records 67 holds for ambiguous regional, island, pass, cultural-site or non-mountain identities. The 250 km scoring scale and original GMBA polygons are unchanged. Volcano prompts are translated in all four interface languages. Older versioned assets remain available so saved games keep their original targets.

Rebuild with `npm run data:modes -- --mode world --offline`. Preparation requires a complete discovery snapshot whose SHA-256 matches `data/config/world-review.json`; changed or unreviewed input cannot silently enter the game. No new geographic downloads are needed for this release.

Western Alps and Eastern Alps are also direct choices in the main game selector, including from Worldwide Peaks. They open the existing regional Alpine games with their separate saved progress.

The game selector groups all Alpine choices (peaks, Western Alps, Eastern Alps and valleys) under **Alps**, with **Worldwide** in its own group. Group labels follow the selected interface language. Valley availability still depends on its data release checks.
