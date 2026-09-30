import {readJSON, saveJSON, type StorageLike} from '../core/persistence';
import {validV2, validTarget, evaluateModeGuess, type ModeManifest, type ModeSession, type NewMode, type ChallengeV2, type Target} from '../core/modes';
import {validPosition} from '../core/scoring';
import {viennaDate} from '../core/date';
import type {SectionFeature} from '../core/geography';
const api=import.meta.env.VITE_API_URL??'';
export const modeSessionKey=(mode:NewMode)=>`alptap:session:v2:${mode}`;
async function json(url:string,signal?:AbortSignal){const r=await fetch(url,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();}
export async function modeChallenge(mode:NewMode,storage:StorageLike,signal?:AbortSignal):Promise<ChallengeV2>{
 const key=`alptap:challenge:v2:${mode}`;
 try{const c=await json(`${api}/v2/challenge?mode=${mode}`,signal);if(!validV2(c)||c.mode!==mode||c.date!==viennaDate())throw new Error('Invalid challenge');saveJSON(storage,key,c);return c;}
 catch(e){if(signal?.aborted)throw e;const cached=readJSON(storage,key);if(validV2(cached)&&cached.mode===mode&&cached.date===viennaDate())return cached;throw e;}
}
export function dataUrl(version:string,path:string){if(!/^mode-[a-f0-9]{12}$/.test(version)||!/^([a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.json$/.test(path)||path.includes('..'))throw new Error('Invalid data reference');return `${import.meta.env.BASE_URL}data/${version}/${path}`;}
export async function modeManifest(c:ChallengeV2,signal?:AbortSignal):Promise<ModeManifest>{
 const m=await json(dataUrl(c.datasetVersion,'manifest.json'),signal) as ModeManifest;
 if(m.schemaVersion!==2||m.version!==c.datasetVersion||m.mode!==c.mode||!Array.isArray(m.targets)||!m.targets.every(t=>validTarget(t,m.mode))||new Set(m.targets.map(t=>t.id)).size!==m.targets.length||!Array.isArray(m.regions)||!Array.isArray(m.attribution)||!Array.isArray(m.bounds)||m.bounds.length!==4||!m.bounds.every(Number.isFinite))throw new Error('Invalid manifest');
 if(!c.targetIds.every((id,i)=>m.targets.some(t=>t.id===id&&t.difficulty===c.roundDifficulties[i])))throw new Error('Missing challenge targets');
 return m;
}
export async function targetGeometry(m:ModeManifest,t:Target,display=false,signal?:AbortSignal):Promise<SectionFeature[]>{
 const refs=t.kind==='valley'?[{id:t.id,ref:display?t.displayGeometryRef:t.geometryRef}]:t.regionIds.map(id=>{const r=m.regions.find(r=>r.id===id);return {id,ref:display?r?.displayGeometryRef:r?.geometryRef};});
 return Promise.all(refs.map(async({id,ref})=>{if(!ref)throw new Error('Missing geometry reference');const g=await json(dataUrl(m.version,ref),signal);if(g.type!=='Feature'||g.properties?.id!==id||!['Polygon','MultiPolygon'].includes(g.geometry?.type)||!validPolygonCoordinates(g.geometry))throw new Error('Invalid geometry');return g as SectionFeature;}));
}
export async function restoreMode(storage:StorageLike,mode:NewMode,signal?:AbortSignal):Promise<{session:ModeSession;manifest:ModeManifest}|null>{
 const raw=readJSON(storage,modeSessionKey(mode)) as ModeSession|null;
 if(!raw||raw.schemaVersion!==2||!validV2(raw.challenge)||raw.challenge.mode!==mode||raw.challenge.date>viennaDate()||!Number.isInteger(raw.round)||raw.round<0||raw.round>2||!Array.isArray(raw.results)||![raw.round,raw.round+1].includes(raw.results.length)||typeof raw.complete!=='boolean'||(raw.complete&&raw.results.length!==3)||(raw.pendingGuess!==null&&!validPosition(raw.pendingGuess))||raw.results.some(r=>!r||!validPosition(r.guess)||r.scoringRule!==raw.challenge.scoringRule))return null;
 if(raw.challenge.date!==viennaDate()&&(raw.complete||(!raw.results.length&&!raw.pendingGuess)))return null;
 // Retrieve the pinned dataset, never trust cached target coordinates, polygons or scores.
 const manifest=await modeManifest(raw.challenge,signal),targets=raw.challenge.targetIds.map(id=>manifest.targets.find(t=>t.id===id)!);
 const results=await Promise.all(raw.results.map(async(r,i)=>evaluateModeGuess(mode,targets[i],r.guess,await targetGeometry(manifest,targets[i],false,signal))));
 return {session:{...raw,targets,results},manifest};
}

function validPolygonCoordinates(g:{type:string;coordinates:unknown}):boolean {
 const polygons=g.type==='Polygon'?[g.coordinates]:g.coordinates;
 return Array.isArray(polygons)&&polygons.length>0&&polygons.every(p=>Array.isArray(p)&&p.length>0&&p.every(r=>Array.isArray(r)&&r.length>=4&&r.every(c=>Array.isArray(c)&&c.length>=2&&Number.isFinite(c[0])&&Number.isFinite(c[1])&&Math.abs(c[0])<=180&&Math.abs(c[1])<=90)&&r[0][0]===r[r.length-1][0]&&r[0][1]===r[r.length-1][1]));
}
