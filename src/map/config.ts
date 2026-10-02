import type { RasterDEMSourceSpecification, RasterSourceSpecification, VectorSourceSpecification } from 'maplibre-gl';
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
export const hydrography: RasterSourceSpecification = {
  type: 'raster',
  tiles: [env.VITE_HYDROGRAPHY_URL ?? 'https://tiles.maps.eox.at/wmts/1.0.0/hydrography_3857/default/g/{z}/{y}/{x}.png'],
  tileSize: 256,
  maxzoom: Number(env.VITE_HYDROGRAPHY_MAX_ZOOM ?? 14),
  attribution: env.VITE_HYDROGRAPHY_ATTRIBUTION ?? 'Hydrography: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> · Rendering © <a href="https://maps.eox.at/" target="_blank" rel="noopener">EOX</a> and <a href="https://github.com/mapserver/basemaps" target="_blank" rel="noopener">MapServer</a>',
};
// EOX hydrography covers inland water; OpenMapTiles water/class=ocean fills seas.
export const oceans: VectorSourceSpecification = {
  type: 'vector',
  url: env.VITE_OCEAN_URL ?? 'https://tiles.openfreemap.org/planet',
  attribution: '© <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> · <a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a>',
};
