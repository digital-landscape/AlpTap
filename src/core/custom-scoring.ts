import { SCORING } from './config';
import { geographicArea, normalizePolygon, polygonGeometry, type Ring } from './custom';
import type { ScoringProfile } from './scoring';

export function customAreaKm2(polygon: Ring): number {
  return geographicArea([polygonGeometry(normalizePolygon(polygon)).coordinates]) * 6371.0088 ** 2;
}

export function customScoringProfile(areaKm2: number, mode: 'alpine-peaks' | 'world-peaks'): ScoringProfile {
  if (!Number.isFinite(areaKm2) || areaKm2 <= 0) throw new Error('Invalid custom area');
  const base = SCORING[mode === 'world-peaks' ? 'world' : 'alpine'];
  // Area becomes a length: a 100 km² polygon has a 10 km distance scale.
  // Keep tiny polygons playable and never make large areas easier than the base mode.
  const farDistanceKm = Math.max(1, Math.min(base.farDistanceKm, Math.sqrt(areaKm2)));
  const perfectRadiusKm = Math.max(0.025, base.perfectRadiusKm * farDistanceKm / base.farDistanceKm);
  return { perfectRadiusKm, farDistanceKm };
}
