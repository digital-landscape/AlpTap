import type {MultiPolygon,Polygon} from 'geojson';
import {catalogPattern} from '../core/game-url';
import type {Candidate} from '../core/custom';
import type {PeakIndex} from '../core/types';
import type {ModeIndex} from '../core/modes';
import type {CuratedChallenges} from '../core/challenge';
export interface Catalog {
  id:string;schemaVersion:1;
  algorithms:{alpine:string;world:string;custom:string};
  alpine:{version:string;peaks:(PeakIndex&Candidate)[]};
  world:Omit<ModeIndex,'targets'>&{targets:(ModeIndex['targets'][number]&Candidate)[]};
  boundary:Polygon|MultiPolygon;curated:CuratedChallenges;
}
async function json(path:string,signal?:AbortSignal){
  const r=await fetch(`${import.meta.env.BASE_URL}data/catalogs/${path}`,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)});
  if(!r.ok)throw new Error('catalog');return r.json();
}
const cache=new Map<string,Catalog>();
export async function loadCatalog(id?:string,signal?:AbortSignal):Promise<Catalog>{
  const resolved=id??(await json('current.json',signal)).id;
  if(typeof resolved!=='string'||!catalogPattern.test(resolved))throw new Error('catalog');
  if(cache.has(resolved))return cache.get(resolved)!;
  const c=await json(`${resolved}.json`,signal) as Catalog;
  const candidates=(items:Candidate[])=>Array.isArray(items)&&items.length>0&&new Set(items.map(p=>p.id)).size===items.length&&items.every(p=>typeof p.id==='string'&&['easy','medium','hard'].includes(p.difficulty)&&Number.isFinite(p.position?.lat)&&Math.abs(p.position.lat)<=90&&Number.isFinite(p.position?.lon)&&Math.abs(p.position.lon)<=180);
  if(c.id!==resolved||c.schemaVersion!==1||!/^alps-[a-f0-9]{12}$/.test(c.alpine?.version)||!/^mode-[a-f0-9]{12}$/.test(c.world?.version)||!candidates(c.alpine?.peaks)||!candidates(c.world?.targets)||!['Polygon','MultiPolygon'].includes(c.boundary?.type)||!Array.isArray(c.boundary.coordinates)||!c.curated||!c.algorithms)throw new Error('catalog');
  cache.set(resolved,c);return c;
}
