import {customAreaKm2,customScoringProfile} from '../core/custom-scoring';
import type {ScoringProfile} from '../core/scoring';
import type {Catalog} from './catalog';
import type {GameRoute} from '../core/game-url';
import {alpineOverlap,databaseForOverlap,insidePolygon,customPicks,encodePolygon,polygonBounds,type Candidate,type Ring} from '../core/custom';
import {generateChallenge} from '../core/challenge';
import {generateModeChallenge,evaluateModeGuess,type ModeSession,type ModeManifest} from '../core/modes';
import {GAME} from '../core/config';
import {nextViennaRollover} from '../core/date';
import {readJSON,sessionKey,type StorageLike} from '../core/persistence';
import {validPosition,evaluateGuess} from '../core/scoring';
import {matchingSections} from '../core/geography';
import {loadDataset} from './provider';
import {loadSections} from './sections';
import {modeManifest,modeSessionKey,targetGeometry} from './modes';
import type {Challenge,GameSession,Manifest} from '../core/types';

interface SetupBase {shareRoute?:GameRoute;scoring?:ScoringProfile;storageKey:string;legacyKey?:string;polygon?:Ring;bounds?:[number,number,number,number]}
export interface AlpineSetup extends SetupBase {kind:'alpine-peaks';session:GameSession;manifest:Manifest}
export interface WorldSetup extends SetupBase {kind:'world-peaks';session:ModeSession;manifest:ModeManifest}
export type PlaySetup=AlpineSetup|WorldSetup;
function legacyKeyFor(storage:StorageLike,key:string,id:string):string|undefined {
  const saved=readJSON(storage,key) as {challenge?:{id?:string}}|null;
  // Keep older progress intact when a URL explicitly selects another challenge.
  return !saved||saved.challenge?.id===id?key:undefined;
}
export function customPool(catalog:Catalog,polygon:Ring){
  const overlap=alpineOverlap(polygon,catalog.boundary),mode=databaseForOverlap(overlap);
  const candidates:Candidate[]=mode==='alpine-peaks'?catalog.alpine.peaks:catalog.world.targets;
  const pool=candidates.filter(p=>insidePolygon(polygon,p.position));
  const areaKm2=customAreaKm2(polygon);
  return {overlap,mode,pool,areaKm2,scoring:customScoringProfile(areaKm2,mode)};
}
// Restore only progress. Challenge definitions, coordinates, and scores come from
// the pinned catalogue and its authoritative geometry, never cached target data.
async function restore(setup:PlaySetup,storage:StorageLike,signal?:AbortSignal):Promise<PlaySetup>{
  const expected=setup.session.challenge;
  const raw=(readJSON(storage,setup.storageKey)??(setup.legacyKey?readJSON(storage,setup.legacyKey):null)) as GameSession|ModeSession|null;
  if(!raw||raw.challenge?.id!==expected.id||!Array.isArray(raw.results)||raw.results.length>3||!Number.isInteger(raw.round)||raw.round<0||raw.round>2||![raw.round,raw.round+1].includes(raw.results.length)||typeof raw.complete!=='boolean'||(raw.complete&&raw.results.length!==3)||(raw.pendingGuess!==null&&!validPosition(raw.pendingGuess))||raw.results.some(r=>!r||!validPosition(r.guess)))return setup;
  const state={round:raw.round,complete:raw.complete,pendingGuess:raw.pendingGuess};
  if(setup.kind==='alpine-peaks'){
    const results=await Promise.all(raw.results.map(async(r,i)=>{const p=setup.session.peaks[i];const sections=await loadSections(expected.datasetVersion,p.soiusa.sectionIds);return evaluateGuess(p.id,r.guess,p,matchingSections(r.guess,sections),setup.scoring);}));
    signal?.throwIfAborted();return {...setup,session:{...setup.session,...state,results}};
  }
  const results=await Promise.all(raw.results.map(async(r,i)=>{const t=setup.session.targets[i];return evaluateModeGuess('world-peaks',t,r.guess,await targetGeometry(setup.manifest,t,false,signal),setup.scoring);}));
  return {...setup,session:{...setup.session,...state,results}};
}
export async function preparePlay(route:GameRoute,catalog:Catalog,date:string,storage:StorageLike,signal?:AbortSignal):Promise<PlaySetup>{
  if(catalog.algorithms.alpine!==GAME.mixedAlgorithmVersion||catalog.algorithms.world!=='daily-modes-v1'||catalog.algorithms.custom!=='custom-v1')throw new Error('version');
  const custom=route.mode==='custom';
  const selection=custom?customPool(catalog,route.polygon!):null;
  const mode=selection?.mode??route.mode;
  const identity=custom?`${catalog.id}|${encodePolygon(route.polygon!)}`:'';
  const picks=selection?customPicks(selection.pool,identity,date):null;
  const id=`custom-v1|${identity}|${date}`;
  const common={shareRoute:custom?{...route,catalog:catalog.id}:undefined,scoring:selection?.scoring,polygon:route.polygon,bounds:route.polygon?polygonBounds(route.polygon):undefined};
  if(mode==='alpine-peaks'){
    const challenge:Challenge=picks?{id,date,timezone:'Europe/Vienna',region:'alps',difficulty:'mixed',datasetVersion:catalog.alpine.version,algorithmVersion:'custom-v1',roundCount:3,peakIds:picks.map(p=>p.id),roundDifficulties:picks.map(p=>p.difficulty),nextRollover:nextViennaRollover(date)}:
      generateChallenge(catalog.alpine.peaks,{date,region:route.region,difficulty:'mixed',datasetVersion:catalog.alpine.version},catalog.curated);
    const data=await loadDataset(challenge,signal);
    return restore({kind:'alpine-peaks',...common,storageKey:`alptap:play:v1:${catalog.id}:${challenge.id}`,legacyKey:custom?undefined:legacyKeyFor(storage,sessionKey(route.region,'mixed'),challenge.id),manifest:data.manifest,session:{schemaVersion:1,interactionVersion:'instant-v2',challenge,peaks:data.peaks,results:[],pendingGuess:null,round:0,complete:false}},storage,signal);
  }
  const challenge=picks?{schemaVersion:2 as const,id,mode:'world-peaks' as const,region:'world',date,timezone:'Europe/Vienna' as const,datasetVersion:catalog.world.version,algorithmVersion:'custom-v1',scoringRule:'world-region-v1' as const,targetIds:picks.map(p=>p.id),roundDifficulties:picks.map(p=>p.difficulty),nextRollover:nextViennaRollover(date)}:generateModeChallenge(catalog.world,date);
  const manifest=await modeManifest(challenge,signal);
  return restore({kind:'world-peaks',...common,storageKey:`alptap:play:v1:${catalog.id}:${challenge.id}`,legacyKey:custom?undefined:legacyKeyFor(storage,modeSessionKey('world-peaks'),challenge.id),manifest,session:{schemaVersion:2,challenge,targets:challenge.targetIds.map(id=>manifest.targets.find(t=>t.id===id)!),round:0,results:[],pendingGuess:null,complete:false}},storage,signal);
}
