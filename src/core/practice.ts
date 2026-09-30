import type { Position } from './types';

// Mont Blanc (Wikidata Q583), from the bundled data/processed/peaks.json.
// Practice stays separate from the daily session and never contributes points.
export const practiceSummit: Position = { lat: 45.832777777, lon: 6.865 };
export const practiceBounds: [number, number, number, number] = [5.8, 45, 8, 46.5];
