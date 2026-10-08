import { afterEach, describe, expect, it, vi } from 'vitest';
import { challengeLink, challengeToken, parseSharedGame, resultLink, scoreEmoji, shareText } from '../src/core/sharing';
import { generateChallenge } from '../src/core/challenge';
import { generateModeChallenge, type ModeIndex } from '../src/core/modes';
import { loadSession, saveJSON, sessionKey } from '../src/core/persistence';
import { modeSessionKey, restoreMode } from '../src/data/modes';
import { loadDataset } from '../src/data/provider';
import { readFileSync } from 'node:fs';
import index from '../data/processed/api-index.json';
import modes from '../data/processed/mode-index.json';
import type { GameSession, Peak, PeakIndex } from '../src/core/types';

const alpine = (region: 'alps' | 'western-alps' | 'eastern-alps' = 'alps', difficulty: 'mixed' | 'hard' = 'mixed') => generateChallenge(index.peaks as PeakIndex[], { date: '2026-09-29', datasetVersion: index.version, region, difficulty });
const world = () => generateModeChallenge(modes.find(m => m.mode === 'world-peaks') as ModeIndex, '2026-09-29');
const storage = () => { const data = new Map<string, string>(); return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } }; };
afterEach(() => vi.unstubAllGlobals());

describe('exact shared challenges', () => {
  it('shares only the daily mode and Alpine region, removing replay and release details', () => {
    const page = 'https://example.org/AlpTap/?play=old&catalog=catalog-0000000000000000#map';
    expect(resultLink(alpine(), page, '/AlpTap/')).toBe('https://example.org/AlpTap/?mode=alpine-peaks');
    for (const region of ['western-alps', 'eastern-alps'] as const) {
      expect(resultLink(alpine(region), page, '/AlpTap/')).toBe(`https://example.org/AlpTap/?mode=alpine-peaks&region=${region}`);
    }
    expect(resultLink(world(), page, '/')).toBe('https://example.org/?mode=world-peaks');
    expect(resultLink(alpine(), page, '/AlpTap/', {mode:'alpine-peaks',region:'alps',catalog:'catalog-0000000000000000'})).not.toContain('catalog');
    const text = shareText([1000,553,487], 'Toutes les Alpes', 'fr', resultLink(alpine(), page, '/AlpTap/'), true);
    expect(text).toContain('Jouer le défi du jour 👇\nhttps://example.org/AlpTap/?mode=alpine-peaks');
  });
  it('pins regional, single-tier, curated-order and worldwide selections without reselecting a date', () => {
    for (const challenge of [alpine(), alpine('western-alps'), alpine('eastern-alps', 'hard'), world()]) {
      const link = challengeLink(challenge, 'https://example.org/AlpTap/?other=1#old', '/AlpTap/');
      const replay = parseSharedGame(new URL(link).search)!;
      expect(replay.challenge).toMatchObject({ datasetVersion: challenge.datasetVersion, date: challenge.date, algorithmVersion: challenge.algorithmVersion });
      expect(replay.challenge).toMatchObject('peakIds' in challenge ? { peakIds: challenge.peakIds, region: challenge.region, difficulty: challenge.difficulty } : { targetIds: challenge.targetIds, mode: challenge.mode });
      expect(challengeLink(replay.challenge, link, '/AlpTap/')).toBe(link);
      expect(link).not.toContain('other='); expect(link).not.toContain('#');
    }
    const challenge = alpine('alps', 'hard');
    challenge.peakIds.reverse();
    expect(parseSharedGame('?play=' + challengeToken(challenge))?.challenge).toMatchObject({ peakIds: challenge.peakIds });
    expect(challengeLink(challenge, 'https://play.example/', '/')).toMatch(/^https:\/\/play.example\/\?play=/);
  });
  it('does not put guesses, scores, coordinates or summit names in share text', () => {
    const text = shareText([1000, 950, 760], 'Alps', 'en', 'https://example.org/?play=pinned');
    expect(text).toBe('AlpTap · Alps\n1000🏔️ 950🧗 760🥾\nFinal score: 2710 / 3000\nPlay these peaks 👇\nhttps://example.org/?play=pinned');
    expect([0, 699, 700, 899, 900, 999, 1000].map(scoreEmoji)).toEqual(['🚶','🚶','🥾','🥾','🧗','🧗','🏔️']);
    for (const locale of ['en','de','fr','it'] as const) expect(shareText([0,0,0], 'Alps', locale, 'link')).toContain('0 / 3000');
    expect(shareText([1000,950,760], 'Custom', 'en', 'https://example.org/?mode=custom', true)).toContain('Play today’s game 👇\nhttps://example.org/?mode=custom');
  });
  it('rejects malformed, oversized, unsupported and unsafe links explicitly', () => {
    expect(parseSharedGame('?utm_source=friend')).toBeNull();
    const payload = JSON.parse(atob(challengeToken(alpine()))) as unknown[];
    const encode = (value: unknown) => btoa(JSON.stringify(value)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
    const variants = [[], [2,...payload.slice(1)], payload.map((v,i) => i === 2 ? '../secret' : v), payload.map((v,i) => i === 3 ? '2026-02-30' : v), payload.map((v,i) => i === 5 ? ['wikidata:Q1','wikidata:Q1','wikidata:Q2'] : v), payload.map((v,i) => i === 5 ? ['https://evil.example/a','wikidata:Q2','wikidata:Q3'] : v)];
    for (const token of ['', '!', 'a'.repeat(4097), ...variants.map(encode)]) expect(() => parseSharedGame('?play=' + token)).toThrow('Invalid shared challenge');
    expect(() => parseSharedGame('?play=' + challengeToken(alpine()) + '&play=another')).toThrow();
  });
  it('restores old completed replays separately from daily progress and rejects a mismatched saved game', () => {
    const cache = storage(), replay = parseSharedGame('?play=' + challengeToken(alpine()))!;
    if (replay.kind !== 'alpine') throw new Error();
    const peaks = replay.challenge.peakIds.map((id,i) => ({ id, name: 'Peak', names: {}, aliases: [], countries: [], countryCandidates: [], elevation: null, lat: 46, lon: 8, soiusa: { sectionIds: [], regionIds: ['alps'] }, wikidata: null, prominence: null, isolation: null, provenance: {}, difficulty: { score: 0, version: 'fixture', level: (['easy','medium','hard'] as const)[i] } })) as Peak[];
    const session: GameSession = { schemaVersion: 1, interactionVersion: 'instant-v2', challenge: replay.challenge, peaks, round: 2, complete: true, pendingGuess: null, results: peaks.map(p => ({ peakId: p.id, guess: { lat: 46, lon: 8 }, distanceKm: 999, score: 0, normalizedScore: 0 })) };
    const dailyKey = sessionKey('alps','mixed'); cache.setItem(dailyKey, 'untouched daily progress');
    saveJSON(cache,replay.key,session);
    expect(loadSession(cache,'alps','mixed','2030-01-01',replay)?.results.map(r => r.score)).toEqual([1000,1000,1000]);
    expect(cache.getItem(dailyKey)).toBe('untouched daily progress');
    saveJSON(cache,replay.key,{...session,challenge:{...session.challenge,datasetVersion:'alps-123456abcdef'}});
    expect(loadSession(cache,'alps','mixed','2030-01-01',replay)).toBeNull();
  });
  it('loads a pinned historical Alpine dataset even when the current catalogue has changed', async () => {
    const historical = {...alpine(), datasetVersion: 'alps-dd9704cb2fc8'};
    expect(historical.datasetVersion).not.toBe(index.version);
    const manifest = JSON.parse(readFileSync(`public/data/${historical.datasetVersion}/manifest.json`, 'utf8'));
    // Take one real historic target per tier from the shards.
    const records = Array.from({length:64}, (_,i) => JSON.parse(readFileSync(`public/data/${historical.datasetVersion}/peaks-${String(i).padStart(2,'0')}.json`, 'utf8')));
    historical.peakIds = ['easy','medium','hard'].map(tier => Object.values(Object.assign({},...records)).find((p: any) => p.difficulty.level === tier)).map((p: any) => p.id);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(readFileSync('public' + url, 'utf8'))));
    const replay = parseSharedGame('?play=' + challengeToken(historical))!;
    if (replay.kind !== 'alpine') throw new Error();
    const loaded = await loadDataset(replay.challenge);
    expect(loaded.manifest.version).toBe(manifest.version);
    expect(loaded.peaks.map(p => p.id)).toEqual(historical.peakIds);
  });
  it('restores an old worldwide replay using its pinned manifest and recalculates results', async () => {
    const cache = storage(), replay = parseSharedGame('?play=' + challengeToken(world()))!;
    if (replay.kind !== 'world') throw new Error();
    const manifest = JSON.parse(readFileSync(`public/data/${replay.challenge.datasetVersion}/manifest.json`, 'utf8'));
    const targets = replay.challenge.targetIds.map(id => manifest.targets.find((t: any) => t.id === id));
    saveJSON(cache,replay.key,{schemaVersion:2,challenge:replay.challenge,round:2,complete:true,pendingGuess:null,results:targets.map((t: any) => ({guess:t.position,score:0,scoringRule:replay.challenge.scoringRule}))});
    cache.setItem(modeSessionKey('world-peaks'),'daily stays here');
    vi.stubGlobal('fetch',vi.fn(async (url: string) => new Response(readFileSync('public' + url, 'utf8'))));
    const restored = await restoreMode(cache,'world-peaks',undefined,replay);
    expect(restored?.session.targets.map(t => t.id)).toEqual(replay.challenge.targetIds);
    expect(restored?.session.results.map(r => r.score)).toEqual([1000,1000,1000]);
    expect(cache.getItem(modeSessionKey('world-peaks'))).toBe('daily stays here');
  });
});
