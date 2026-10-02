import type { StyleSpecification } from 'maplibre-gl';
import { hydrography, oceans, satellite, terrainConfig } from './config';

export type Basemap = 'satellite' | 'relief';
const preferenceKey = 'alptap:basemap:v1';
export function readBasemap(): Basemap {
  try { return localStorage.getItem(preferenceKey) === 'relief' ? 'relief' : 'satellite'; }
  catch { return 'satellite'; }
}
export function saveBasemap(value: Basemap) {
  try { localStorage.setItem(preferenceKey, value); } catch { /* Keep the current page usable without storage. */ }
}
export const basemapSources = (value: Basemap) => value === 'relief' ? ['relief-dem', 'oceans', 'hydrography'] : ['satellite'];
export const basemapLabels = {
  en: { satellite: 'Satellite', relief: 'Relief', loading: 'Loading relief and water…', error: 'Relief or water unavailable. Retry or switch to satellite.' },
  de: { satellite: 'Satellit', relief: 'Relief', loading: 'Relief und Gewässer werden geladen…', error: 'Relief oder Gewässer nicht verfügbar. Erneut laden oder zu Satellit wechseln.' },
  fr: { satellite: 'Satellite', relief: 'Relief', loading: 'Chargement du relief et des eaux…', error: 'Relief ou eaux indisponibles. Réessayez ou passez au satellite.' },
  it: { satellite: 'Satellite', relief: 'Rilievo', loading: 'Caricamento del rilievo e delle acque…', error: 'Rilievo o acque non disponibili. Riprova o passa al satellite.' },
};
export function basemapStyle(value: Basemap): StyleSpecification {
  const visibility = (selected: Basemap) => value === selected ? 'visible' as const : 'none' as const;
  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    // Hillshade is computed in the browser from elevation, not fetched as rendered imagery.
    // Separate DEM source instances improve hillshade quality when terrain is enabled.
    sources: { satellite, 'relief-dem': terrainConfig.source, oceans, hydrography },
    layers: [
      { id: 'relief-background', type: 'background', layout: { visibility: visibility('relief') }, paint: { 'background-color': '#eeede7' } },
      { id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: visibility('satellite') }, paint: { 'raster-fade-duration': 300, 'raster-saturation': -.1 } },
      { id: 'relief-hillshade', type: 'hillshade', source: 'relief-dem', layout: { visibility: visibility('relief') }, paint: { 'hillshade-illumination-anchor': 'map', 'hillshade-illumination-direction': 315, 'hillshade-exaggeration': .65, 'hillshade-shadow-color': '#535c61', 'hillshade-highlight-color': '#ffffff', 'hillshade-accent-color': '#777e7d' } },
      { id: 'oceans', type: 'fill', source: 'oceans', 'source-layer': 'water', filter: ['==', ['get', 'class'], 'ocean'], layout: { visibility: visibility('relief') }, paint: { 'fill-color': '#93a5b1', 'fill-antialias': false } },
      { id: 'hydrography', type: 'raster', source: 'hydrography', layout: { visibility: visibility('relief') }, paint: { 'raster-fade-duration': 150 } },
    ],
  };
}
