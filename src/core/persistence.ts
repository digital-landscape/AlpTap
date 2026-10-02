import { CHALLENGE_MODES, DAILY_DIFFICULTIES, LOCALES, REGIONS } from './config';
import { viennaDate } from './date';
import { validPosition, evaluateGuess } from './scoring';
import type { Challenge, GameSession, Peak, Preferences } from './types';
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }
// Keep this page's progress when browser storage is blocked or full. The write
// still throws so saveJSON reports the existing non-persistent-storage warning.
const pageStorage = new Map<string,string>();
export const browserStorage:StorageLike = {
  getItem: key => pageStorage.get(key) ?? localStorage.getItem(key),
  setItem: (key,value) => {pageStorage.set(key,value);localStorage.setItem(key,value);},
};
export function readJSON(storage: StorageLike, key: string): unknown { try { return JSON.parse(storage.getItem(key) ?? 'null'); } catch { return null; } }
export function saveJSON(storage: StorageLike, key: string, value: unknown): boolean { try { storage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
export function initialPreferences(storage: StorageLike, languages: readonly string[]): Preferences {
  const saved = readJSON(storage, 'alptap:preferences') as Partial<Preferences> | null;
  const browserLanguage = languages.map(l => l.toLowerCase().split('-')[0]).find(l => LOCALES.includes(l as Preferences['locale']));
  return { locale: saved?.locale && LOCALES.includes(saved.locale) ? saved.locale : (browserLanguage ?? 'en') as Preferences['locale'], region: saved?.region && REGIONS.includes(saved.region) ? saved.region : 'alps', difficulty: 'mixed' };
}
export function validChallenge(value: unknown): value is Challenge {
  if (!value || typeof value !== 'object') return false;
  const c = value as Challenge;
  return typeof c.id === 'string' && typeof c.datasetVersion === 'string' && /^alps-[a-f0-9]{12}$/.test(c.datasetVersion) && typeof c.algorithmVersion === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.date) && Number.isFinite(Date.parse(c.nextRollover)) && c.timezone === 'Europe/Vienna' && REGIONS.includes(c.region) && CHALLENGE_MODES.includes(c.difficulty) && (c.difficulty!=='mixed' || (c.roundCount===3 && JSON.stringify(c.roundDifficulties)===JSON.stringify(DAILY_DIFFICULTIES))) && Number.isInteger(c.roundCount) && c.roundCount > 0 && c.roundCount <= 50 && Array.isArray(c.peakIds) && c.peakIds.length === c.roundCount && new Set(c.peakIds).size === c.roundCount && c.peakIds.every(id => /^(?:osm:node\/\d+|wikidata:Q\d+)$/.test(id));
}
export function validPeak(p: unknown): p is Peak {
  if (!p || typeof p !== 'object') return false;
  const peak = p as Peak;
  return validPosition(peak) && typeof peak.id === 'string' && typeof peak.name === 'string' && !!peak.names && Object.values(peak.names).every(v => typeof v === 'string') && Array.isArray(peak.aliases) && peak.aliases.every(v => typeof v === 'string') && Array.isArray(peak.countries) && peak.countries.every(c => typeof c === 'string') && (peak.elevation === null || Number.isFinite(peak.elevation)) && Array.isArray(peak.soiusa?.sectionIds) && Array.isArray(peak.soiusa?.regionIds);
}
export const sessionKey = (region: string, difficulty: string) => `alptap:session:v1:${region}:${difficulty}`;
export function loadSession(storage: StorageLike, region: string, difficulty: string, today = viennaDate(), replay?: { key: string; challenge: Challenge }): GameSession | null {
  const session = readJSON(storage, replay?.key ?? sessionKey(region, difficulty)) as GameSession | null;
  if (!session || session.schemaVersion !== 1 || !validChallenge(session.challenge) || session.challenge.region !== region || session.challenge.difficulty !== difficulty) return null;
  if (replay && JSON.stringify(session.challenge) !== JSON.stringify(replay.challenge)) return null;
  if (!replay && (session.challenge.date > today || (session.challenge.date !== today && (session.complete || (session.results?.length === 0 && (session.interactionVersion !== 'instant-v2' || !validPosition(session.pendingGuess))))))) return null;
  if (!Array.isArray(session.peaks) || session.peaks.length !== session.challenge.roundCount || !session.peaks.every((p,i) => validPeak(p) && p.id === session.challenge.peakIds[i])) return null;
  if (session.challenge.difficulty==='mixed' && session.peaks.some((p,i)=>p.difficulty?.level!==DAILY_DIFFICULTIES[i])) return null;
  if (!Array.isArray(session.results) || session.results.length > session.peaks.length || typeof session.complete !== 'boolean') return null;
  if (!Number.isInteger(session.round) || session.round < 0 || session.round >= session.peaks.length || ![session.round, session.round + 1].includes(session.results.length) || (session.complete && session.results.length !== session.peaks.length)) return null;
  if (session.pendingGuess !== null && !validPosition(session.pendingGuess)) return null;
  if (!session.results.every((r,i) => r && typeof r === 'object' && r.peakId === session.peaks[i].id && validPosition(r.guess))) return null;
  // Recompute scores on restore, rather than trusting malformed cached numbers.
  session.results = session.results.map((r,i) => evaluateGuess(r.peakId, r.guess, session.peaks[i], r.scoringVersion === 'section-v2' && Array.isArray(r.matchedSectionIds) ? r.matchedSectionIds.filter(id => session.peaks[i].soiusa.sectionIds.includes(id)) : undefined));
  if (session.interactionVersion !== 'instant-v2' && session.results.length === session.round) session.pendingGuess = null;
  return session;
}
