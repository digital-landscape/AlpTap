import type { RasterDEMSourceSpecification, RasterSourceSpecification } from 'maplibre-gl';
const env = import.meta.env;
export const satellite: RasterSourceSpecification = {
  type: 'raster', tiles: [env.VITE_SATELLITE_URL ?? 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg'], tileSize: 256,
  maxzoom: Number(env.VITE_SATELLITE_MAX_ZOOM ?? 14),
  attribution: env.VITE_SATELLITE_ATTRIBUTION ?? '© <a href="https://maps.eox.at/" target="_blank" rel="noopener">EOX</a> · Contains modified Copernicus Sentinel data 2024 · <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener">CC BY-NC-SA</a>',
};
export const terrainConfig = {
  enabled: env.VITE_TERRAIN_ENABLED !== 'false', exaggeration: Number(env.VITE_TERRAIN_EXAGGERATION ?? 1.5),
  source: { type: 'raster-dem', tiles: [env.VITE_DEM_URL ?? 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], encoding: env.VITE_DEM_ENCODING === 'mapbox' ? 'mapbox' : 'terrarium', tileSize: 256, maxzoom: Number(env.VITE_DEM_MAX_ZOOM ?? 14), attribution: env.VITE_DEM_ATTRIBUTION ?? '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener">Terrain: Mapzen / contributors</a>' } satisfies RasterDEMSourceSpecification,
};
