export const GAME = { roundCount: 3, timezone: 'Europe/Vienna', algorithmVersion: 'circular-deck-v1', mixedAlgorithmVersion: 'mixed-tier-deck-v1', maxRoundScore: 1000, sectionBonusFraction: 0.15 } as const;
export const REGIONS = ['alps', 'western-alps', 'eastern-alps'] as const;
export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export const LOCALES = ['en', 'de', 'fr', 'it'] as const;

export const CHALLENGE_MODES = [...DIFFICULTIES, 'mixed'] as const;
export const DAILY_DIFFICULTIES = ['easy','medium','hard'] as const;

// Forgive small pointer errors; reach 1% at the mode's far-distance reference.
export const SCORING = {
  alpine: { perfectRadiusKm: 1, farDistanceKm: 1000 },
  world: { perfectRadiusKm: 10, farDistanceKm: Math.PI * 6371.0088 },
} as const;
