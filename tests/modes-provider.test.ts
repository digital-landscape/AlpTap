import {afterEach,expect,it,vi} from 'vitest';
import {modeChallenge,modeSessionKey,restoreMode,targetGeometry} from '../src/data/modes';
import {generateModeChallenge,type ModeManifest,type Target} from '../src/core/modes';
import {viennaDate} from '../src/core/date';
const targets:Target[]=['easy','medium','hard'].flatMap((tier,i)=>Array.from({length:6},(_,j)=>({id:`wikidata:Q${i*10+j}`,kind:'valley',name:'Valley',names:{},position:{lon:1,lat:1},difficulty:tier,countries:['CH','FR','AT','IT'],wikipedia:{},regionIds:[],geometryRef:`valleys/${i*10+j}.json`,displayGeometryRef:`valleys/${i*10+j}-display.json`,provenance:{source:'fixture',url:'https://example.org',license:'CC0',reviewed:true}} as Target)));
const challenge=()=>generateModeChallenge({version:'mode-123456abcdef',mode:'alpine-valleys',validated:true,targets},viennaDate());
const manifest:ModeManifest={schemaVersion:2,version:'mode-123456abcdef',mode:'alpine-valleys',targets,regions:[],bounds:[0,0,2,2],attribution:[]};
const storage=()=>{const data=new Map<string,string>();return {getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};};
afterEach(()=>vi.unstubAllGlobals());
it('namespaces daily caches and refuses a cross-mode response',async()=>{
 const cache=storage();vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify(challenge()))));
 await modeChallenge('alpine-valleys',cache);
 vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));
 expect((await modeChallenge('alpine-valleys',cache)).mode).toBe('alpine-valleys');
 await expect(modeChallenge('world-peaks',cache)).rejects.toThrow();
});
it('recalculates restored scores from pinned geometry and keeps submitted guesses on failure',async()=>{
 const cache=storage(),c=challenge(),target=targets.find(t=>t.id===c.targetIds[0])!;
 const saved={schemaVersion:2,challenge:c,round:0,results:[{guess:{lon:1,lat:1},score:0,scoringRule:'valley-area-v1'}],pendingGuess:{lon:1,lat:1},complete:false};
 cache.setItem(modeSessionKey('alpine-valleys'),JSON.stringify(saved));
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(JSON.stringify(url.endsWith('manifest.json')?manifest:{type:'Feature',properties:{id:target.id,name:'Valley'},geometry:{type:'Polygon',coordinates:[[[0,0],[2,0],[2,2],[0,2],[0,0]]]}}))));
 expect((await restoreMode(cache,'alpine-valleys'))?.session.results[0].score).toBe(1000);
 vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('missing geometry')));
 await expect(restoreMode(cache,'alpine-valleys')).rejects.toThrow();
 expect(JSON.parse(cache.getItem(modeSessionKey('alpine-valleys'))!).results[0].guess).toEqual({lon:1,lat:1});
});
it('rejects empty and non-closed scoring rings',async()=>{
 for(const coordinates of [[[]],[[[0,0],[1,0],[1,1],[0,1]]]]){
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({type:'Feature',properties:{id:targets[0].id},geometry:{type:'Polygon',coordinates}}))));
  await expect(targetGeometry(manifest,targets[0])).rejects.toThrow('Invalid geometry');
 }
});
