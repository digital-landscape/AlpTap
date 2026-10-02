import {describe,it,expect} from 'vitest';
import {continuousPath,evaluateModeGuess,generateModeChallenge,polygonDistance,releaseReady,revealBounds,validV2,type ModeIndex,type Target} from '../src/core/modes';
import {scoreDistance} from '../src/core/scoring';
import {sectionCovers,type SectionFeature} from '../src/core/geography';
const polygon:SectionFeature={type:'Feature',properties:{id:'wikidata:Q1',name:'Valley'},geometry:{type:'Polygon',coordinates:[[[0,0],[2,0],[2,2],[0,2],[0,0]],[[.8,.8],[1.2,.8],[1.2,1.2],[.8,1.2],[.8,.8]]]}};
const valley:Target={id:'wikidata:Q1',kind:'valley',name:'Valley',names:{},position:{lon:.5,lat:.5},difficulty:'easy',countries:['FR'],wikipedia:{},regionIds:[],geometryRef:'valley.json',displayGeometryRef:'valley-display.json',provenance:{source:'fixture',url:'https://example.org',license:'CC0',reviewed:true}};
const index:ModeIndex={version:'mode-123456abcdef',mode:'world-peaks',validated:true,targets:['easy','medium','hard'].flatMap((tier,i)=>Array.from({length:6},(_,j)=>({id:`wikidata:Q${i*10+j}`,difficulty:tier as 'easy'|'medium'|'hard',countries:['FR','AT','IT','CH']})))};
describe('mode catalogues and challenges',()=>{
 it('enforces all tiers and all four valley countries',()=>{expect(releaseReady(index)).toBe(true);expect(releaseReady({...index,validated:false})).toBe(false);expect(releaseReady({...index,targets:index.targets.slice(1)})).toBe(false);expect(releaseReady({...index,mode:'alpine-valleys',targets:index.targets.map(t=>({...t,countries:['CH']}))})).toBe(false);});
 it('separates daily identities by mode and remains deterministic',()=>{const c=generateModeChallenge(index,'2026-09-30');expect(c).toEqual(generateModeChallenge(index,'2026-09-30'));expect(validV2(c)).toBe(true);expect(validV2({...c,scoringRule:'valley-area-v1'})).toBe(false);const next=generateModeChallenge(index,'2026-10-01');expect(c.targetIds.every(id=>!next.targetIds.includes(id))).toBe(true);expect(generateModeChallenge({...index,mode:'alpine-valleys'},c.date).id).not.toBe(c.id);});
});
describe('valley area scoring',()=>{
 it('awards full points inside and on the exterior and hole boundaries',()=>{for(const guess of [{lon:.5,lat:.5},{lon:0,lat:1},{lon:.8,lat:1}])expect(evaluateModeGuess('alpine-valleys',valley,guess,[polygon]).score).toBe(1000);});
 it('excludes holes and measures to the closest boundary, not reference point',()=>{expect(sectionCovers(polygon,{lon:1,lat:1})).toBe(false);expect(polygonDistance({lon:1,lat:1},polygon)).toBeCloseTo(22.23,1);const a=evaluateModeGuess('alpine-valleys',valley,{lon:3,lat:1},[polygon]);expect(a.distanceKm).toBeCloseTo(111.18,1);expect(a.areaBonus).toBe(0);expect(a.score).toBe(scoreDistance(a.distanceKm).score);});
 it('handles multipolygons and rejects absent or wrong geometry',()=>{const multi:SectionFeature={...polygon,geometry:{type:'MultiPolygon',coordinates:[polygon.geometry.type==='Polygon'?polygon.geometry.coordinates:[],[[[5,0],[6,0],[6,1],[5,1],[5,0]]]]}};expect(polygonDistance({lon:5.5,lat:.5},multi)).toBe(0);expect(()=>evaluateModeGuess('alpine-valleys',valley,{lon:1,lat:1},[])).toThrow();expect(()=>evaluateModeGuess('alpine-valleys',valley,{lon:1,lat:1},[{...polygon,properties:{id:'wrong',name:''}}])).toThrow();});
});
describe('world scoring and antimeridian',()=>{
 it('uses a forgiving world curve and the remaining-points region bonus',()=>{const summit={...valley,kind:'summit' as const,regionIds:[polygon.properties.id]};const r=evaluateModeGuess('world-peaks',summit,{lon:1.5,lat:1.5},[polygon]);const base=scoreDistance(r.distanceKm,'world').normalizedScore;expect(r.score).toBe(Math.round(1000*(base+.15*(1-base))));expect(r.areaBonus).toBe(r.score-r.distanceScore);});
 it('fits across the dateline and unwraps reveal paths',()=>{expect(revealBounds({lon:179,lat:10},{lon:-179,lat:12})).toEqual([179,10,181,12]);expect(continuousPath([[179,1],[-179,2],[-178,3]])).toEqual([[179,1],[181,2],[182,3]]);});
});

it('recognizes an unsplit dateline region without awarding the opposite hemisphere',()=>{
 const region:SectionFeature={...polygon,geometry:{type:'Polygon',coordinates:[[[179,0],[-179,0],[-179,2],[179,2],[179,0]]]}};
 expect(sectionCovers(region,{lon:-179.5,lat:1})).toBe(true);
 expect(sectionCovers(region,{lon:179.5,lat:1})).toBe(true);
 expect(sectionCovers(region,{lon:0,lat:1})).toBe(false);
});

it('preserves explicitly world-spanning polygons',()=>{expect(sectionCovers({...polygon,geometry:{type:'Polygon',coordinates:[[[-180,-85],[180,-85],[180,85],[-180,85],[-180,-85]]]}},{lon:8,lat:46})).toBe(true);});

it('keeps world points until genuinely far away and forgives pointer errors',()=>{
 expect(scoreDistance(10,'world').score).toBe(1000);
 expect(scoreDistance(250,'world').score).toBeGreaterThan(990);
 expect(scoreDistance(10000,'world').score).toBeGreaterThan(100);
 expect(scoreDistance(Math.PI*6371.0088,'world').score).toBe(10);
 for(const profile of ['world','alpine'] as const){
  let previous=1000;
  for(let d=0;d<=21000;d+=10){const score=scoreDistance(d,profile).score;expect(score).toBeLessThanOrEqual(previous);expect(score).toBeGreaterThanOrEqual(0);previous=score;}
 }
});
