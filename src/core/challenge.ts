import { DAILY_DIFFICULTIES, GAME } from './config';
import { dateOrdinal, nextViennaRollover } from './date';
import type { Challenge, ChallengeMode, PeakIndex, RegionId } from './types';
export interface ChallengeInput { date: string; region: RegionId; difficulty: ChallengeMode; datasetVersion: string; roundCount?: number }
export type CuratedChallenges = Record<string, string[]>;
function random(seed: string) {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
  return () => { state += 0x6D2B79F5; let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function shuffle<T>(values: readonly T[], seed: string): T[] {
  const output = [...values], rng = random(seed);
  for (let i = output.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [output[i], output[j]] = [output[j], output[i]]; }
  return output;
}
export function generateChallenge(index: readonly PeakIndex[], input: ChallengeInput, curated: CuratedChallenges = {}): Challenge {
  if(input.difficulty==='mixed')return generateMixedChallenge(index,input,curated);
  const count = input.roundCount ?? GAME.roundCount;
  if (!Number.isInteger(count) || count < 1) throw new Error('Invalid round count');
  const day = dateOrdinal(input.date);
  const pool = index.filter(p => p.regionIds.includes(input.region) && p.difficulty === input.difficulty).map(p => p.id).sort();
  if (new Set(pool).size !== pool.length) throw new Error('Duplicate peak IDs');
  if (pool.length < 2 * count) throw new Error(`Insufficient pool: ${input.region}/${input.difficulty}`);
  const seed = `${GAME.algorithmVersion}|${input.datasetVersion}|${input.region}|${input.difficulty}|${count}`;
  const deck = shuffle(pool, seed);
  // A circular deck consumes count consecutive cards each day, including across
  // wraps. With >= 2*count cards, adjacent days never share peaks. No recursion.
  const offset = ((day * count) % deck.length + deck.length) % deck.length;
  const picked = Array.from({ length: count }, (_, i) => deck[(offset + i) % deck.length]);
  const key = `${input.date}|${input.region}|${input.difficulty}`;
  const override = curated[key];
  if (override && (override.length !== count || new Set(override).size !== count || override.some(id => !pool.includes(id)))) throw new Error('Invalid curated challenge');
  const peakIds = override ?? shuffle(picked, `${seed}|${input.date}`);
  return { id: `${seed}|${input.date}${override ? '|curated:' + peakIds.join(',') : ''}`, date: input.date, timezone: GAME.timezone, region: input.region, difficulty: input.difficulty, datasetVersion: input.datasetVersion, algorithmVersion: GAME.algorithmVersion, roundCount: count, peakIds, nextRollover: nextViennaRollover(input.date) };
}

function generateMixedChallenge(index:readonly PeakIndex[],input:ChallengeInput,curated:CuratedChallenges):Challenge {
  const count=DAILY_DIFFICULTIES.length;
  if(input.roundCount!==undefined && input.roundCount!==count)throw new Error('Mixed challenge requires one of each difficulty');
  const day=dateOrdinal(input.date);
  const eligible=index.filter(p=>p.regionIds.includes(input.region));
  if(new Set(eligible.map(p=>p.id)).size!==eligible.length)throw new Error('Duplicate peak IDs');
  const seed=`${GAME.mixedAlgorithmVersion}|${input.datasetVersion}|${input.region}|mixed|${count}`;
  const peakIds=DAILY_DIFFICULTIES.map(difficulty=>{
    const pool=eligible.filter(p=>p.difficulty===difficulty).map(p=>p.id).sort();
    if(pool.length<2)throw new Error(`Insufficient pool: ${input.region}/${difficulty}`);
    const deck=shuffle(pool,`${seed}|${difficulty}`);
    return deck[((day%deck.length)+deck.length)%deck.length];
  });
  const override=curated[`${input.date}|${input.region}|mixed`];
  if(override && (override.length!==count || new Set(override).size!==count || override.some((id,i)=>!eligible.some(p=>p.id===id && p.difficulty===DAILY_DIFFICULTIES[i]))))throw new Error('Invalid curated mixed challenge');
  const selected=override??peakIds;
  return {id:`${seed}|${input.date}${override?'|curated:'+selected.join(','):''}`,date:input.date,timezone:GAME.timezone,region:input.region,difficulty:'mixed',roundDifficulties:[...DAILY_DIFFICULTIES],datasetVersion:input.datasetVersion,algorithmVersion:GAME.mixedAlgorithmVersion,roundCount:count,peakIds:selected,nextRollover:nextViennaRollover(input.date)};
}
