import { afterEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApi } from '../server/app';
import { DIFFICULTIES } from '../src/core/config';
const servers:ReturnType<typeof createApi>[]=[];
afterEach(async()=>{await Promise.all(servers.splice(0).map(server=>new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()))));});
async function start(date='2026-09-29T10:00:00Z'){
 const server=createApi({index:{version:'alps-123456abcdef',peaks:DIFFICULTIES.flatMap((difficulty,d)=>Array.from({length:8},(_,i)=>({id:`osm:node/${d*10+i}`,regionIds:['alps','western-alps'],difficulty})))},origins:['https://play.example.org'],now:()=>new Date(date)});
 servers.push(server);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
describe('daily API',()=>{
 it('defaults to the mixed daily challenge',async()=>{const url=await start();const c=await (await fetch(url+'/v1/challenge')).json();expect(c.difficulty).toBe('mixed');expect(c.roundDifficulties).toEqual(['easy','medium','hard']);expect(c.peakIds.map((id:string)=>Math.floor(Number(id.split('/')[1])/10))).toEqual([0,1,2]);});

 it('returns the server’s Vienna date, IDs, versions, and explicit CORS',async()=>{const url=await start('2026-09-28T22:00:01Z');const response=await fetch(`${url}/v1/challenge?region=alps&difficulty=easy`,{headers:{Origin:'https://play.example.org'}});expect(response.status).toBe(200);expect(response.headers.get('access-control-allow-origin')).toBe('https://play.example.org');const challenge=await response.json();expect(challenge.date).toBe('2026-09-29');expect(challenge.peakIds).toHaveLength(3);expect(challenge).not.toHaveProperty('peaks');});
 it('rejects invalid filters, client dates, disallowed origins, and mutations',async()=>{const url=await start();expect((await fetch(`${url}/v1/challenge?difficulty=extreme`)).status).toBe(400);expect((await fetch(`${url}/v1/challenge?date=2027-01-01`)).status).toBe(400);expect((await fetch(`${url}/v1/challenge`,{headers:{Origin:'https://other.example'}})).status).toBe(403);expect((await fetch(`${url}/v1/challenge`,{method:'POST'})).status).toBe(405);expect((await fetch(`${url}/v1/challenge`,{method:'OPTIONS',headers:{Origin:'https://play.example.org'}})).status).toBe(204);});
 it('never caches past Vienna midnight',async()=>{const url=await start('2026-09-29T21:59:59Z');const response=await fetch(`${url}/v1/challenge`);expect(response.headers.get('cache-control')).toContain('max-age=1');});
});
