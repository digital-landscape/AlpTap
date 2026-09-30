export type Locale = 'en' | 'de' | 'fr' | 'it';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type ChallengeMode = Difficulty | 'mixed';
export type RegionId = 'alps' | 'western-alps' | 'eastern-alps';
export type Position = { lon: number; lat: number };
export type ScientificContent = { id: string; topic: string; title: Partial<Record<Locale, string>>; url?: string };
export interface Peak extends Position {
  id: string; name: string; names: Record<string, string>; aliases: string[]; elevation: number | null;
  countries: string[]; countryCandidates: string[]; wikidata: string | null; wikipedia?: Record<string,string>;
  soiusa: { sectionIds: string[]; regionIds: string[] };
  prominence: number | null; isolation: number | null;
  difficulty: { score: number; level: Difficulty; version: string; features?: Record<string, number | null>; rank?: number; reasons?: string[]; wikipediaEditions?: number };
  provenance: Record<string, unknown>; content?: ScientificContent[];
}
export interface GeographicUnit {
  id: string; parentId: string | null; level: string; name: string; names: Record<string, string>;
  bounds?: [number, number, number, number]; geometryRef: string; provenance: Record<string, unknown>; content?: ScientificContent[];
}
export interface Manifest { version: string; schemaVersion: number; peakCount: number; units: GeographicUnit[]; generatedAt: string; attribution: Record<string, string> }
export interface PeakIndex { id: string; regionIds: string[]; difficulty: Difficulty }
export interface Challenge {
  id: string; date: string; timezone: 'Europe/Vienna'; region: RegionId; difficulty: ChallengeMode; roundDifficulties?: Difficulty[];
  datasetVersion: string; algorithmVersion: string; roundCount: number; peakIds: string[]; nextRollover: string; content?: ScientificContent[];
}
export interface Result { peakId: string; guess: Position; distanceKm: number; normalizedScore: number; score: number; distanceScore?: number; areaBonus?: number; matchedSectionIds?: string[]; scoringVersion?: 'distance-v1' | 'section-v2' }
export interface GameSession { schemaVersion: 1; interactionVersion?: 'instant-v2'; challenge: Challenge; peaks: Peak[]; results: Result[]; pendingGuess: Position | null; round: number; complete: boolean }
export interface Preferences { locale: Locale; region: RegionId; difficulty: ChallengeMode }
