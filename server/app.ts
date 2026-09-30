import { MODES, releaseReady, generateModeChallenge, type ModeIndex, type GameMode } from '../src/core/modes';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { CHALLENGE_MODES, REGIONS } from '../src/core/config';
import { generateChallenge, type CuratedChallenges } from '../src/core/challenge';
import { viennaDate } from '../src/core/date';
import type { ChallengeMode, PeakIndex, RegionId } from '../src/core/types';
export interface ApiOptions { index: { version: string; peaks: PeakIndex[] }; origins: string[]; curated?: CuratedChallenges; now?: () => Date; modes?: ModeIndex[] }
export function createApi(options: ApiOptions) {
  return createServer((req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Vary', 'Origin');
    const origin = req.headers.origin;
    const send = (status: number, data: unknown) => { res.statusCode = status; res.end(JSON.stringify(data)); };
    if (origin && !options.origins.includes(origin)) return send(403, { error: 'Origin not allowed' });
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS'); res.statusCode = 204; return res.end(); }
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET, OPTIONS'); return send(405, { error: 'Method not allowed' }); }
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/health') return send(200, { status: 'ok', datasetVersion: options.index.version });
    if (url.pathname === '/v2/modes') {
      res.setHeader('Cache-Control','no-cache');
      return send(200,{modes:MODES.map(mode=>({mode,available:mode==='alpine-peaks'||!!options.modes?.some(i=>i.mode===mode&&releaseReady(i))}))});
    }
    if (url.pathname === '/v2/challenge') {
      const mode=url.searchParams.get('mode')??'alpine-peaks', region=url.searchParams.get('region')??(mode==='world-peaks'?'world':'alps');
      if(!MODES.includes(mode as GameMode)||[...url.searchParams.keys()].some(k=>!['mode','region'].includes(k))||url.searchParams.getAll('mode').length>1||url.searchParams.getAll('region').length>1||(mode==='alpine-peaks'?!REGIONS.includes(region as RegionId):region!==(mode==='world-peaks'?'world':'alps')))return send(400,{error:'Invalid challenge parameters'});
      const now=options.now?.()??new Date();
      try {
        let challenge;
        if(mode==='alpine-peaks') {
          const legacy=generateChallenge(options.index.peaks,{date:viennaDate(now),region:region as RegionId,difficulty:'mixed',datasetVersion:options.index.version},options.curated);
          challenge={schemaVersion:2,id:legacy.id,mode,region,date:legacy.date,timezone:legacy.timezone,datasetVersion:legacy.datasetVersion,algorithmVersion:legacy.algorithmVersion,scoringRule:'alpine-section-v2',targetIds:legacy.peakIds,roundDifficulties:legacy.roundDifficulties,nextRollover:legacy.nextRollover};
        } else {
          const index=options.modes?.find(i=>i.mode===mode);
          if(!index||!releaseReady(index)){res.setHeader('Cache-Control','no-store');return send(503,{error:'Catalogue not ready',code:'MODE_UNAVAILABLE'});}
          challenge=generateModeChallenge(index,viennaDate(now));
        }
        const ttl=Math.max(0,Math.min(300,Math.floor((Date.parse(challenge.nextRollover)-now.getTime())/1000)));
        res.setHeader('Cache-Control',`public, max-age=${ttl}, must-revalidate`);return send(200,challenge);
      }catch {res.setHeader('Cache-Control','no-store');return send(503,{error:'Challenge unavailable'});}
    }
    if (url.pathname !== '/v1/challenge') return send(404, { error: 'Not found' });
    const region = url.searchParams.get('region') ?? 'alps', difficulty = url.searchParams.get('difficulty') ?? 'mixed';
    if (!REGIONS.includes(region as RegionId) || !CHALLENGE_MODES.includes(difficulty as ChallengeMode) || [...url.searchParams.keys()].some(k => !['region','difficulty'].includes(k)) || url.searchParams.getAll('region').length > 1 || url.searchParams.getAll('difficulty').length > 1) return send(400, { error: 'Invalid challenge parameters' });
    const now = options.now?.() ?? new Date();
    try {
      const challenge = generateChallenge(options.index.peaks, { date: viennaDate(now), region: region as RegionId, difficulty: difficulty as ChallengeMode, datasetVersion: options.index.version }, options.curated);
      const ttl = Math.max(0, Math.min(300, Math.floor((Date.parse(challenge.nextRollover) - now.getTime()) / 1000)));
      res.setHeader('Cache-Control', `public, max-age=${ttl}, must-revalidate`);
      send(200, challenge);
    } catch (error) { console.error(error); res.setHeader('Cache-Control','no-store'); send(503, { error: 'Challenge unavailable' }); }
  });
}
