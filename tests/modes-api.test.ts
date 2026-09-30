import {it,expect} from 'vitest';
import {createApi} from '../server/app';
import type {AddressInfo} from 'node:net';
import type {ModeIndex} from '../src/core/modes';
it('serves v2 independently, preserves v1, rejects invalid parameters and gates unreleased modes',async()=>{
 const targets=['easy','medium','hard'].flatMap((difficulty,i)=>Array.from({length:6},(_,j)=>({id:`wikidata:Q${i*10+j}`,difficulty:difficulty as 'easy'|'medium'|'hard',countries:['CH']})));
 const modes:ModeIndex[]=[{mode:'world-peaks',version:'mode-123456abcdef',validated:true,targets}];
 const server=createApi({index:{version:'alps-123456abcdef',peaks:targets.map(t=>({...t,regionIds:['alps']}))},modes,origins:[],now:()=>new Date('2026-09-29T21:59:59Z')});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
 try{
  const response=await fetch(base+'/v2/challenge?mode=world-peaks');expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toContain('max-age=1');expect((await response.json()).scoringRule).toBe('world-region-v1');
  const a=await(await fetch(base+'/v1/challenge')).json(),b=await(await fetch(base+'/v2/challenge?mode=alpine-peaks')).json();expect(b.targetIds).toEqual(a.peakIds);
  for(const query of ['mode=unknown','mode=world-peaks&region=alps','mode=world-peaks&date=2026-10-01','mode=world-peaks&mode=world-peaks'])expect((await fetch(base+'/v2/challenge?'+query)).status).toBe(400);
  expect((await fetch(base+'/v2/challenge?mode=alpine-valleys')).status).toBe(503);
  expect((await(await fetch(base+'/v2/modes')).json()).modes).toContainEqual({mode:'alpine-valleys',available:false});
 }finally{await new Promise<void>(r=>server.close(()=>r()));}
});
