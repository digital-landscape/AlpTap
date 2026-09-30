import { afterEach, expect, it, vi } from 'vitest';
import { createChallengeProvider, loadDataset } from '../src/data/provider';
import { generateChallenge } from '../src/core/challenge';
import { viennaDate } from '../src/core/date';
const index=Array.from({length:6},(_,i)=>({id:`osm:node/${i}`,regionIds:['alps'],difficulty:'medium' as const}));
const challenge=()=>generateChallenge(index,{date:viennaDate(),region:'alps',difficulty:'medium',datasetVersion:'alps-123456abcdef'});
function storage(){const data=new Map<string,string>();return {getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};}
afterEach(()=>vi.unstubAllGlobals());
it('caches the server list and resumes it during API failure',async()=>{const cache=storage();vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify(challenge()),{status:200})));const provider=createChallengeProvider(cache,'https://api.example');const first=await provider.load('alps','medium');vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));expect(await provider.load('alps','medium')).toEqual(first);});
it('does not reuse yesterday’s cached challenge on failure',async()=>{const cache=storage();cache.setItem('alptap:challenge:alps:medium',JSON.stringify({...challenge(),date:'2020-01-01'}));vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));await expect(createChallengeProvider(cache).load('alps','medium')).rejects.toThrow();});
it('rejects manifest version mismatches',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({version:'wrong',schemaVersion:1,units:[]}))));await expect(loadDataset(challenge())).rejects.toThrow('version mismatch');});
