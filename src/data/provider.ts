import { generateChallenge } from '../core/challenge';
import { peakBucket } from '../core/peak-links';
import { validChallenge, validPeak, readJSON, saveJSON, type StorageLike } from '../core/persistence';
import { viennaDate } from '../core/date';
import type { Challenge, ChallengeMode, Manifest, Peak, RegionId } from '../core/types';
export interface ChallengeProvider { load(region: RegionId, difficulty: ChallengeMode, signal?: AbortSignal): Promise<Challenge> }
export function createChallengeProvider(storage: StorageLike, apiUrl = import.meta.env.VITE_API_URL ?? ''): ChallengeProvider {
  return { async load(region, difficulty, signal) {
    const key = `alptap:challenge:${region}:${difficulty}`;
    try {
      if (!apiUrl) {
        const [{ default: index }, { default: curated }] = await Promise.all([import('../../data/processed/api-index.json'), import('../../data/config/curated.json')]);
        signal?.throwIfAborted();
        const value = generateChallenge(index.peaks as import('../core/types').PeakIndex[], { date: viennaDate(), region, difficulty, datasetVersion: index.version }, curated);
        saveJSON(storage, key, value);
        return value;
      }
      const response = await fetch(`${apiUrl}/v1/challenge?region=${region}&difficulty=${difficulty}`, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error(`Challenge API: ${response.status}`);
      const value: unknown = await response.json();
      if (!validChallenge(value) || value.region !== region || value.difficulty !== difficulty) throw new Error('Invalid challenge response');
      saveJSON(storage, key, value);
      return value;
    } catch (error) {
      if (signal?.aborted) throw error;
      const cached = readJSON(storage, key);
      if (validChallenge(cached) && cached.date === viennaDate() && cached.region === region && cached.difficulty === difficulty) return cached;
      throw error;
    }
  } };
}
export async function loadDataset(challenge: Challenge, signal?: AbortSignal): Promise<{ peaks: Peak[]; manifest: Manifest }> {
  const prefix = `${import.meta.env.BASE_URL}data/${challenge.datasetVersion}`;
  const manifestResponse = await fetch(`${prefix}/manifest.json`, { signal });
  if (!manifestResponse.ok) throw new Error('Dataset unavailable');
  const manifest: Manifest = await manifestResponse.json();
  if (manifest.version !== challenge.datasetVersion || manifest.schemaVersion !== 1 || !Array.isArray(manifest.units)) throw new Error('Dataset version mismatch');
  const buckets = [...new Set(challenge.peakIds.map(id => peakBucket(id)))];
  const shards = await Promise.all(buckets.map(async bucket => {
    const response = await fetch(`${prefix}/peaks-${String(bucket).padStart(2,'0')}.json`, { signal });
    if (!response.ok) throw new Error('Peak data unavailable');
    return await response.json() as Record<string, Peak>;
  }));
  const records = Object.assign({}, ...shards) as Record<string, Peak>;
  const peaks = challenge.peakIds.map(id => records[id]);
  if (!peaks.every((p,i) => validPeak(p) && p.id === challenge.peakIds[i])) throw new Error('Invalid peak dataset');
  if(challenge.difficulty==='mixed' && peaks.some((p,i)=>p.difficulty.level!==challenge.roundDifficulties?.[i]))throw new Error('Mixed challenge tier mismatch');
  return { peaks, manifest };
}
