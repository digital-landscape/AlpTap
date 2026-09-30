import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { matchingSections, sectionCovers, type SectionFeature } from '../src/core/geography';
import { evaluateGuess, scoreWithSection } from '../src/core/scoring';
import { loadSession, saveJSON, sessionKey } from '../src/core/persistence';
import { generateChallenge } from '../src/core/challenge';
import type { Peak, GameSession } from '../src/core/types';
const section:SectionFeature={type:'Feature',properties:{id:'SZ.1',name:'Fixture'},geometry:{type:'Polygon',coordinates:[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[4,4],[6,4],[6,6],[4,6],[4,4]]]}};
describe('SOIUSA section coverage',()=>{
 it('covers interiors and exterior/hole boundaries, but excludes holes and outside points',()=>{
  expect(sectionCovers(section,{lon:2,lat:2})).toBe(true);expect(sectionCovers(section,{lon:0,lat:5})).toBe(true);expect(sectionCovers(section,{lon:4,lat:5})).toBe(true);
  expect(sectionCovers(section,{lon:5,lat:5})).toBe(false);expect(sectionCovers(section,{lon:11,lat:5})).toBe(false);
 });
 it('supports multipart sections without double bonus for shared boundaries',()=>{
  const multi:SectionFeature={...section,geometry:{type:'MultiPolygon',coordinates:[section.geometry.type==='Polygon'?section.geometry.coordinates:[],[[[20,20],[21,20],[21,21],[20,21],[20,20]]]]}};
  expect(sectionCovers(multi,{lon:20.5,lat:20.5})).toBe(true);expect(matchingSections({lon:0,lat:5},[section,{...section,properties:{id:'SZ.2',name:'Neighbour'}}])).toEqual(['SZ.1','SZ.2']);
  expect(evaluateGuess('id',{lon:1,lat:1},{lon:2,lat:2},['SZ.1','SZ.2']).score).toBe(evaluateGuess('id',{lon:1,lat:1},{lon:2,lat:2},['SZ.1']).score);
 });
 it('uses the actual supplied geometry for Matterhorn',()=>{
  const version=JSON.parse(readFileSync('public/data/manifest.json','utf8')).version;
  const actual=JSON.parse(readFileSync(`public/data/${version}/sections/SZ.9.json`,'utf8'));
  expect(sectionCovers(actual,{lon:7.6586024,lat:45.9764263})).toBe(true);
  expect(sectionCovers(actual,{lon:12.6939,lat:47.0745})).toBe(false);
 });
});
describe('distance + section score',()=>{
 it('preserves the maximum and awards 15% of missing points without a near-summit plateau',()=>{
  expect(scoreWithSection(0,true)).toEqual({score:1000,normalizedScore:1,distanceScore:1000,areaBonus:0});
  expect(scoreWithSection(50,false).score).toBe(368);expect(scoreWithSection(50,true).score).toBe(463);
  expect(scoreWithSection(100,true).score).toBe(265);
  expect(scoreWithSection(10,true).score).toBeLessThan(1000);
  expect(scoreWithSection(1000,true).score).toBe(150);
 });
 it('restores section bonuses and preserves old distance-only rounds',()=>{
  const storage={data:new Map<string,string>(),getItem(k:string){return this.data.get(k)??null;},setItem(k:string,v:string){this.data.set(k,v);}};
  const challenge=generateChallenge(Array.from({length:6},(_,i)=>({id:`osm:node/${i}`,regionIds:['alps'],difficulty:'medium' as const})),{date:'2026-09-29',region:'alps',difficulty:'medium',datasetVersion:'alps-123456abcdef'});
  const peaks=challenge.peakIds.map(id=>({id,name:'Peak',names:{},aliases:[],countries:[],lat:1,lon:1,elevation:1000,soiusa:{regionIds:['alps'],sectionIds:['SZ.1']}} as unknown as Peak));
  const result=evaluateGuess(peaks[0].id,{lat:2,lon:2},peaks[0],['SZ.1']);
  const state:GameSession={schemaVersion:1,interactionVersion:'instant-v2',challenge,peaks,results:[result],pendingGuess:result.guess,round:0,complete:false};
  const key=sessionKey('alps','medium');saveJSON(storage,key,state);expect(loadSession(storage,'alps','medium',challenge.date)?.results[0].score).toBe(result.score);
  saveJSON(storage,key,{...state,results:[]});expect(loadSession(storage,'alps','medium','2026-09-30')?.pendingGuess).toEqual(result.guess);
  const legacy=evaluateGuess(peaks[0].id,result.guess,peaks[0]);saveJSON(storage,key,{...state,results:[legacy]});expect(loadSession(storage,'alps','medium',challenge.date)?.results[0].areaBonus).toBe(0);
 });
});
