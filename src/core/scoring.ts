import { GAME } from './config';
import type { Position, Result } from './types';
export function validPosition(p: unknown): p is Position {
  if (!p || typeof p !== 'object') return false;
  const q = p as Position;
  return Number.isFinite(q.lat) && Number.isFinite(q.lon) && Math.abs(q.lat) <= 90 && Math.abs(q.lon) <= 180;
}
export function distanceKm(a: Position, b: Position): number {
  if (!validPosition(a) || !validPosition(b)) throw new Error('Invalid geographic position');
  const rad = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lon - a.lon) * rad / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h)));
}
export function scoreDistance(distance: number) {
  if (!Number.isFinite(distance) || distance < 0) throw new Error('Invalid distance');
  const normalizedScore = Math.exp(-distance / GAME.scoreScaleKm);
  return { normalizedScore, score: Math.round(GAME.maxRoundScore * normalizedScore) };
}
export function scoreWithSection(distance: number, correctSection: boolean) {
  const base = scoreDistance(distance);
  const normalizedScore = base.normalizedScore + (correctSection ? GAME.sectionBonusFraction * (1 - base.normalizedScore) : 0);
  const score = Math.round(GAME.maxRoundScore * normalizedScore);
  return { normalizedScore, score, distanceScore: base.score, areaBonus: score - base.score };
}
export function evaluateGuess(peakId: string, guess: Position, actual: Position, matchedSectionIds?: string[]): Result {
  const distance = distanceKm(guess, actual);
  return { peakId, guess, distanceKm: distance, ...scoreWithSection(distance, !!matchedSectionIds?.length), matchedSectionIds: matchedSectionIds ?? [], scoringVersion: matchedSectionIds === undefined ? 'distance-v1' : 'section-v2' };
}
