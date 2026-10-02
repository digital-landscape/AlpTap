import {readFileSync} from 'node:fs';
import {afterEach,it,expect,vi} from 'vitest';
import {loadCatalog,type Catalog} from '../src/data/catalog';
import {preparePlay,customPool} from '../src/data/play';
import {generateChallenge} from '../src/core/challenge';
import {evaluateGuess} from '../src/core/scoring';
import {matchingSections} from '../src/core/geography';
import {loadSections} from '../src/data/sections';
import {targetGeometry} from '../src/data/modes';
import {generateModeChallenge,evaluateModeGuess} from '../src/core/modes';
import {encodePolygon,decodePolygon,type Ring} from '../src/core/custom';
import type {GameRoute} from '../src/core/game-url';
import {browserStorage,readJSON,saveJSON} from '../src/core/persistence';
const current=JSON.parse(readFileSync('public/data/catalogs/current.json','utf8'));
const catalog:Catalog=JSON.parse(readFileSync(`public/data/catalogs/${current.id}.json`,'utf8'));
const storage=()=>{const data=new Map<string,string>();return {getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};};
function serve(){vi.stubGlobal('fetch',vi.fn(async(url:string)=>{try{return new Response(readFileSync('public/'+url.replace(/^\//,''),'utf8'));}catch{return new Response('',{status:404});}}));}
afterEach(()=>vi.unstubAllGlobals());
it('keeps in-page progress if browser storage is unavailable while reporting the write failure',()=>{
  vi.stubGlobal('localStorage',{getItem:()=>{throw new Error('blocked');},setItem:()=>{throw new Error('blocked');}});
  expect(saveJSON(browserStorage,'test:blocked-progress',{round:1})).toBe(false);
  expect(readJSON(browserStorage,'test:blocked-progress')).toEqual({round:1});
});
it('preserves the existing standard daily picks in every released region and mode',async()=>{
  serve();
  for(const region of ['alps','western-alps','eastern-alps'] as const){
    const game=await preparePlay({mode:'alpine-peaks',region},catalog,'2026-10-02',storage());
    expect(game.session.challenge).toEqual(generateChallenge(catalog.alpine.peaks,{date:'2026-10-02',region,difficulty:'mixed',datasetVersion:catalog.alpine.version},catalog.curated));
  }
  expect((await preparePlay({mode:'world-peaks',region:'alps'},catalog,'2026-10-02',storage())).session.challenge).toEqual(generateModeChallenge(catalog.world,'2026-10-02'));
});
it('selects only Alpine peaks inside the decoded polygon, with separate daily progress',async()=>{
  serve();const polygon=decodePolygon(encodePolygon([[7,45],[12,45],[12,47.5],[7,47.5]]));
  const route:GameRoute={mode:'custom',region:'alps',catalog:catalog.id,polygon},s=storage();
  const a=await preparePlay(route,catalog,'2026-10-02',s),b=await preparePlay(route,catalog,'2026-10-02',storage());
  expect(a.kind).toBe('alpine-peaks');expect(b.session.challenge).toEqual(a.session.challenge);
  const candidates=customPool(catalog,polygon);expect(candidates.overlap).toBeGreaterThan(.5);
  if(a.kind!=='alpine-peaks')throw new Error('Expected Alpine game');
  expect(a.session.peaks.every(p=>candidates.pool.some(c=>c.id===p.id))).toBe(true);
  const guess={lon:8,lat:46};s.setItem(a.storageKey,JSON.stringify({...a.session,pendingGuess:guess}));
  expect((await preparePlay(route,catalog,'2026-10-02',s)).session.pendingGuess).toEqual(guess);
  const tomorrow=await preparePlay(route,catalog,'2026-10-03',s);expect(tomorrow.storageKey).not.toBe(a.storageKey);expect(tomorrow.session.pendingGuess).toBeNull();
  expect(s.getItem(a.storageKey)).not.toBeNull();expect(a.legacyKey).toBeUndefined();
  const different=await preparePlay({...route,polygon:[[8,45],[12,45],[12,47.5],[8,47.5]]},catalog,'2026-10-02',s);expect(different.storageKey).not.toBe(a.storageKey);expect(different.session.pendingGuess).toBeNull();
});
it('uses worldwide data outside the Alps and permits missing difficulty tiers',async()=>{
  serve();const polygon:Ring=[[-85,-60],[-65,-60],[-65,0],[-85,0]];
  const route:GameRoute={mode:'custom',region:'alps',polygon,catalog:catalog.id};
  const game=await preparePlay(route,catalog,'2026-10-02',storage());expect(game.kind).toBe('world-peaks');
  const subset=structuredClone(catalog);subset.world.targets=subset.world.targets.filter(p=>p.difficulty==='hard');
  const hard=await preparePlay(route,subset,'2026-10-02',storage());expect(hard.session.challenge.roundDifficulties).toEqual(['hard','hard','hard']);
});
it('does not fall back to the latest catalogue or another database',async()=>{
  serve();await expect(loadCatalog('catalog-0000000000000000')).rejects.toThrow('catalog');
  await expect(preparePlay({mode:'custom',region:'alps',polygon:[[0,0],[.01,0],[.01,.01],[0,.01]]},catalog,'2026-10-02',storage())).rejects.toThrow('few');
  await expect(preparePlay({mode:'world-peaks',region:'alps'},{...catalog,algorithms:{...catalog.algorithms,world:'unknown'}},'2026-10-02',storage())).rejects.toThrow('version');
});
it('pins old catalogue data even if the current release pointer changes',async()=>{
  serve();const old=await loadCatalog(catalog.id);const first=await preparePlay({mode:'world-peaks',region:'alps',catalog:old.id},old,'2026-10-02',storage());
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>url.endsWith('current.json')?new Response(JSON.stringify({id:'catalog-ffffffffffffffff'})):new Response(readFileSync('public/'+url.replace(/^\//,''),'utf8'))));
  const again=await preparePlay({mode:'world-peaks',region:'alps',catalog:old.id},await loadCatalog(old.id),'2026-10-02',storage());expect(again.session.challenge).toEqual(first.session.challenge);
});
it.each([
  {mode:'alpine-peaks',polygon:[[7,45],[8,45],[8,46],[7,46]]},
  {mode:'world-peaks',polygon:[[-72,-34],[-68,-34],[-68,-30],[-72,-30]]},
] as const)('restores $mode custom results with the same surface scale as live guesses',async({mode,polygon})=>{
  serve();const route:GameRoute={mode:'custom',region:'alps',catalog:catalog.id,polygon:polygon.map(([x,y])=>[x,y])};
  const s=storage(),game=await preparePlay(route,catalog,'2026-10-02',s);
  expect(game.kind).toBe(mode);expect(game.scoring).toBeDefined();
  const guess={lon:polygon[0][0],lat:polygon[0][1]};
  let live,standard;
  if(game.kind==='alpine-peaks'){
    const peak=game.session.peaks[0];const sections=await loadSections(game.session.challenge.datasetVersion,peak.soiusa.sectionIds);
    const matched=matchingSections(guess,sections);
    live=evaluateGuess(peak.id,guess,peak,matched,game.scoring);
    standard=evaluateGuess(peak.id,guess,peak,matched);
  }else{
    const target=game.session.targets[0],geometry=await targetGeometry(game.manifest,target,false);
    live=evaluateModeGuess('world-peaks',target,guess,geometry,game.scoring);
    standard=evaluateModeGuess('world-peaks',target,guess,geometry);
  }
  expect(live.score).toBeLessThan(standard.score);
  // Cached scores/profile are untrusted; only the polygon and recorded guess matter.
  s.setItem(game.storageKey,JSON.stringify({...game.session,scoring:{perfectRadiusKm:1000,farDistanceKm:10000},pendingGuess:guess,results:[{...live,score:999,distanceScore:999}]}));
  const restored=await preparePlay(route,catalog,'2026-10-02',s);
  expect(restored.session.results[0]).toEqual(live);
  expect(restored.scoring).toEqual(game.scoring);
});
