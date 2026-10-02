import { describe, expect, it } from 'vitest';
import { generateChallenge } from '../src/core/challenge';
import { nextViennaRollover, viennaDate } from '../src/core/date';
import { distanceKm, scoreDistance } from '../src/core/scoring';
import { getPeakName } from '../src/core/names';
import { DIFFICULTIES, REGIONS } from '../src/core/config';
import { initialPreferences, loadSession, saveJSON, sessionKey } from '../src/core/persistence';
import type { PeakIndex, GameSession, Peak } from '../src/core/types';
const index: PeakIndex[] = ['western-alps','eastern-alps'].flatMap((region,r)=>DIFFICULTIES.flatMap((difficulty,d)=>Array.from({length:13},(_,i)=>({id:`osm:node/${r*100+d*20+i}`,regionIds:['alps',region],difficulty}))));
const input = {date:'2026-09-29',region:'alps',difficulty:'medium',datasetVersion:'alps-123456abcdef'} as const;
class MemoryStorage { data=new Map<string,string>();getItem(k:string){return this.data.get(k)??null;}setItem(k:string,v:string){this.data.set(k,v);} }
const peak = {id:'osm:node/21',name:'Matterhorn',names:{de:'Matterhorn',it:'Cervino'},aliases:['Mont Cervin'],lat:45.9763,lon:7.6586,elevation:4478,countries:['CH','IT'],countryCandidates:[],soiusa:{sectionIds:['SZ.9'],regionIds:['alps','western-alps']}} as unknown as Peak;
describe('daily selection',()=>{
  it('is independent of input ordering and identical for equal inputs',()=>{expect(generateChallenge(index,input)).toEqual(generateChallenge([...index].reverse(),input));});
  it('filters every region and difficulty combination',()=>{for(const region of REGIONS)for(const difficulty of DIFFICULTIES){const c=generateChallenge(index,{...input,region,difficulty});expect(c.peakIds).toHaveLength(3);expect(new Set(c.peakIds).size).toBe(3);for(const id of c.peakIds){const p=index.find(p=>p.id===id)!;expect(p.regionIds).toContain(region);expect(p.difficulty).toBe(difficulty);}}});
  it('changes days without repetitions, including deck wraps',()=>{for(const size of [6,7,8,9,13,26]){const pool=Array.from({length:size},(_,i)=>({id:`osm:node/${i}`,regionIds:['alps'],difficulty:'medium' as const}));let previous:string[]=[];for(let day=0;day<90;day++){const date=new Date(Date.UTC(2026,0,1+day)).toISOString().slice(0,10);const c=generateChallenge(pool,{...input,date});expect(c.peakIds.some(p=>previous.includes(p))).toBe(false);previous=c.peakIds;}}});
  it('rejects undersized and duplicate pools',()=>{expect(()=>generateChallenge(index.slice(0,5),{...input,difficulty:'easy'})).toThrow('Insufficient');expect(()=>generateChallenge([...index,...index],input)).toThrow('Duplicate');});
  it('validates curated selection and configurable round count',()=>{const base=generateChallenge(index,input);const key=`${input.date}|${input.region}|${input.difficulty}`;expect(generateChallenge(index,input,{[key]:[...base.peakIds].reverse()}).peakIds).toEqual([...base.peakIds].reverse());expect(()=>generateChallenge(index,input,{[key]:['unknown']})).toThrow();expect(generateChallenge(index,{...input,roundCount:5}).peakIds).toHaveLength(5);});
});
describe('Vienna calendar',()=>{
  it('rolls over with Central European time, independent of process timezone',()=>{expect(viennaDate(new Date('2026-09-28T21:59:59Z'))).toBe('2026-09-28');expect(viennaDate(new Date('2026-09-28T22:00:00Z'))).toBe('2026-09-29');expect(viennaDate(new Date('2026-12-01T23:00:00Z'))).toBe('2026-12-02');});
  it('handles 23 and 25 hour DST days',()=>{expect(nextViennaRollover('2026-03-29')).toBe('2026-03-29T22:00:00.000Z');expect(nextViennaRollover('2026-10-25')).toBe('2026-10-25T23:00:00.000Z');expect(Date.parse(nextViennaRollover('2026-03-29'))-Date.parse(nextViennaRollover('2026-03-28'))).toBe(23*3600000);expect(Date.parse(nextViennaRollover('2026-10-25'))-Date.parse(nextViennaRollover('2026-10-24'))).toBe(25*3600000);});
  it('rejects impossible dates',()=>expect(()=>generateChallenge(index,{...input,date:'2026-02-30'})).toThrow());
});
describe('names, distance and scoring',()=>{
  it('uses recorded local names and ordered fallbacks',()=>{expect(getPeakName(peak,'it-IT')).toBe('Cervino');expect(getPeakName(peak,'fr')).toBe('Matterhorn');expect(getPeakName({...peak,name:'',names:{fr:'Mont Cervin'}},'en')).toBe('Mont Cervin');expect(getPeakName({...peak,name:'',names:{},aliases:[]},'en')).toBe(peak.id);});
  it('measures geographic distance at equator, across dateline, and at identical points',()=>{expect(distanceKm({lat:0,lon:0},{lat:0,lon:1})).toBeCloseTo(111.195,2);expect(distanceKm({lat:0,lon:179},{lat:0,lon:-179})).toBeCloseTo(222.39,2);expect(distanceKm(peak,peak)).toBe(0);expect(distanceKm({lat:0,lon:0},{lat:0,lon:180})).toBeCloseTo(20015.114,2);expect(()=>distanceKm({lat:100,lon:0},peak)).toThrow();});
  it('smoothly decreases scores without discontinuous thresholds',()=>{expect(scoreDistance(0)).toEqual({normalizedScore:1,score:1000});expect(scoreDistance(1).score).toBe(1000);expect(scoreDistance(50).score).toBe(737);expect(scoreDistance(300).score).toBe(10);expect(scoreDistance(1000).score).toBe(0);expect(scoreDistance(10).score).toBeGreaterThan(scoreDistance(20).score);expect(()=>scoreDistance(-1)).toThrow();});
});
describe('persistence',()=>{
  it('uses locale preferences without inferring geography',()=>{const s=new MemoryStorage();expect(initialPreferences(s,['fr-CH'])).toEqual({locale:'fr',region:'alps',difficulty:'mixed'});saveJSON(s,'alptap:preferences',{locale:'it',region:'eastern-alps',difficulty:'hard'});expect(initialPreferences(s,['de-AT']).locale).toBe('it');s.setItem('alptap:preferences','bad');expect(initialPreferences(s,['pl-PL']).locale).toBe('en');});
  it('restores pending guesses and locked results, rejects corruption, and keeps unfinished prior days',()=>{const s=new MemoryStorage(),challenge=generateChallenge(index,input);const peaks=challenge.peakIds.map(id=>({...peak,id}));const state:GameSession={schemaVersion:1,challenge,peaks,results:[{peakId:peaks[0].id,guess:peak,distanceKm:99,score:0,normalizedScore:0}],pendingGuess:peak,round:0,complete:false};const key=sessionKey(input.region,input.difficulty);saveJSON(s,key,state);expect(loadSession(s,input.region,input.difficulty,'2026-09-30')?.results[0].score).toBe(1000);saveJSON(s,key,{...state,results:[],pendingGuess:{lat:999,lon:0}});expect(loadSession(s,input.region,input.difficulty,input.date)).toBeNull();saveJSON(s,key,{...state,complete:true});expect(loadSession(s,input.region,input.difficulty,'2026-09-30')).toBeNull();});
  it('handles unavailable storage',()=>expect(saveJSON({getItem:()=>null,setItem:()=>{throw new Error('quota');}},'key',{})).toBe(false));
});

describe('mixed daily challenge',()=>{
 it('draws one of each tier in order for every region, deterministically',()=>{
  for(const region of REGIONS){
   const args={...input,region,difficulty:'mixed' as const};
   const c=generateChallenge(index,args);
   expect(c).toEqual(generateChallenge([...index].reverse(),args));
   expect(c.roundDifficulties).toEqual(['easy','medium','hard']);
   expect(c.peakIds.map(id=>index.find(p=>p.id===id)!.difficulty)).toEqual(c.roundDifficulties);
   expect(c.peakIds.every(id=>index.find(p=>p.id===id)!.regionIds.includes(region))).toBe(true);
  }
 });
 it('avoids adjacent-day repeats across many deck wraps',()=>{
  let previous:string[]=[];
  for(let d=0;d<100;d++){
   const date=new Date(Date.UTC(2026,0,1+d)).toISOString().slice(0,10);
   const c=generateChallenge(index,{...input,date,difficulty:'mixed'});
   expect(new Set(c.peakIds).size).toBe(3);
   expect(c.peakIds.some(id=>previous.includes(id))).toBe(false);
   previous=c.peakIds;
  }
 });
 it('rejects missing tiers and incorrectly ordered curated challenges',()=>{
  const args={...input,difficulty:'mixed' as const};
  expect(()=>generateChallenge(index.filter(p=>p.difficulty!=='hard'),args)).toThrow('Insufficient');
  const c=generateChallenge(index,args),key=input.date+'|alps|mixed';
  expect(generateChallenge(index,args,{[key]:c.peakIds}).peakIds).toEqual(c.peakIds);
  expect(()=>generateChallenge(index,args,{[key]:[...c.peakIds].reverse()})).toThrow('Invalid curated');
 });
});
