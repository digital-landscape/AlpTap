# Current-time solar terrain shadows

## Reference inspected on 2026-09-30

The public [Vector Vario viewer](https://vectorvario.com/viewer/) loads `assets/app.RSCZE7BU.js` and `assets/chunk.FDMFGSZR.js`. Its deployed renderer builds a light-space terrain depth map, tests a receiving surface against it, and filters the shadow mask. It also calculates solar position and atmosphere colors; its synchronized sun follows a flight timeline. A separate MapLibre hillshade layer is present.

AlpTap uses the same **light-space depth-map shadow technique**, implemented with original TypeScript and GLSL. It does not import the reference's bundled implementation or claim identical rendering. The reference's full atmospheric model, Gaussian filter and flight timeline are not included.

## Implementation

- `solar.ts` implements [NOAA's fractional-year solar position equations](https://gml.noaa.gov/grad/solcalc/solareqns.PDF). Input is the current UTC instant and the viewed scene's latitude/longitude, independent of browser timezone. No device geolocation is needed.
- `SolarShadows.ts` chooses a bounded elevation scene covering the viewport plus neighboring terrain. It fetches the configured Terrarium or Mapbox RGB tiles, decodes a 256×256 height grid and retains 64 cached tile bitmaps after each successful scene (up to 25 additional tiles can be in flight during a rebuild). Up to four downloads run concurrently. Obsolete requests are cancelled.
- `SolarShadowRenderer.ts` uses a separate WebGL 2 context, a 1024×1024 depth texture and a triangulated terrain mesh. An orthographic sun-facing depth pass records occluding ridges. A second pass compares each receiving terrain point against that depth, with a precision bias, a 3×3 filter and local slope lighting. The receiving interpolation matches the mesh diagonal to reduce self-shadow artifacts.
- A 384×384 RGBA mask is fed to a [MapLibre ImageSource](https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/) and raster layer below gameplay overlays. MapLibre drapes the layer over its terrain. The GPU code does not access private MapLibre internals or change its GL state.

Refresh occurs on load, after map movement, every minute while visible, after the tab becomes visible, and after terrain-height changes. A scene's height data is reused for time-only changes. Geometry and shadows use the same height exaggeration. Flat mode and zero height disable the mask. Shadow errors or unsupported WebGL 2 hide it and preserve gameplay; subsequent updates retry. Teardown aborts requests, removes listeners/timers, closes bitmaps and releases GPU resources.

When manually enabled at night, the renderer removes direct sunlight and applies restrained ambient dimming so the geography game remains readable. Large world overviews omit the mask; regional views enable it automatically.

## Precision and limits

This is actual ridge-to-valley occlusion, rather than fixed directional hillshade. It is a bounded, approximate rendering: sun position is evaluated at the scene center, elevation is downsampled, very long low-sun shadows can originate beyond the padded scene, and the bias can suppress very small shadows. Native MapLibre terrain and the shadow grid have different triangulations/resolutions. The outer scene edge fades to avoid a hard mask boundary. Very wide views, high latitudes and antimeridian crossings warrant additional visual validation before claiming photorealistic global accuracy. DEM downloads add traffic but use the configured provider and a bounded in-memory cache.

## Validation

Unit checks cover equinox noon, morning/evening direction, night and longitude at a fixed UTC instant. Browser tests render a synthetic ridge to verify shadows change sides with the sun, disappear as height becomes zero, and retain ambient lighting at night. Desktop/mobile integration checks cover initial rendering, minute updates, 2D/3D switching and zero-height disabling. Existing elevation-failure checks verify that gameplay falls back to 2D.

## Daylight default and manual control

The adjacent Sun shadows button uses an accessible pressed state and localized EN/DE/FR/IT text. Without a manual choice, the current sun altitude at the map center determines the default; below-horizon sunlight disables the shadow mask and skips shadow DEM/GPU work. Minute updates, view changes and tab visibility reevaluate that choice. Clicking the toggle sets a session-only override, including allowing ambient night shading. Terrain off, zero height and DEM failure still prevent rendering regardless of that choice.
