import {describe,it,expect} from 'vitest';
import {alpineOverlap,customPicks,databaseForOverlap,decodePolygon,encodePolygon,insidePolygon,normalizePolygon,polygonBounds,type Candidate,type Ring} from '../src/core/custom';
import {gameURL,readGameRoute} from '../src/core/game-url';
import type {Polygon} from 'geojson';
const square:Ring=[[0,0],[2,0],[2,2],[0,2]];
const boundary:Polygon={type:'Polygon',coordinates:[[[0,0],[2,0],[2,2],[0,2],[0,0]]]};
describe('custom geometry',()=>{
  it('normalizes winding, first vertex, closure and rounded coordinates before encoding',()=>{
    const encoded=encodePolygon(square);
    expect(encodePolygon([...square].reverse())).toBe(encoded);
    expect(encodePolygon([...square.slice(2),...square.slice(0,2),square[2]])).toBe(encoded);
    expect(encodePolygon([[0.000001,0],...square.slice(1)])).toBe(encoded);
    expect(encodePolygon(decodePolygon(encoded))).toBe(encoded);
    const nearDateline:Ring=[[179.999999,0],[-179,0],[-179,1]];
    expect(encodePolygon(decodePolygon(encodePolygon(nearDateline)))).toBe(encodePolygon(nearDateline));
  });
  it('includes edges and corners and excludes exterior points',()=>{
    for(const position of [{lon:0,lat:0},{lon:1,lat:0},{lon:1,lat:1}])expect(insidePolygon(square,position)).toBe(true);
    expect(insidePolygon(square,{lon:3,lat:1})).toBe(false);
  });
  it('measures full, zero, and half overlap using geographical area',()=>{
    expect(alpineOverlap(square,boundary)).toBeCloseTo(1);
    expect(alpineOverlap([[5,0],[6,0],[6,1],[5,1]],boundary)).toBe(0);
    expect(alpineOverlap([[1,0],[3,0],[3,2],[1,2]],boundary)).toBeCloseTo(.5);
    expect(databaseForOverlap(alpineOverlap([[1,0],[3,0],[3,2],[1,2]],boundary))).toBe('world-peaks');
    expect(databaseForOverlap(.5)).toBe('world-peaks');
    expect(databaseForOverlap(.50001)).toBe('alpine-peaks');
    // A northern half occupies less spherical area than the southern half.
    const north:Polygon={type:'Polygon',coordinates:[[[0,40],[10,40],[10,80],[0,80],[0,40]]]};
    expect(alpineOverlap([[0,0],[10,0],[10,80],[0,80]],north)).toBeLessThan(.5);
  });
  it('subtracts holes in Alpine coverage',()=>{
    const hole:Polygon={type:'Polygon',coordinates:[boundary.coordinates[0],[[.5,.5],[1.5,.5],[1.5,1.5],[.5,1.5],[.5,.5]]]};
    expect(alpineOverlap([[.6,.6],[1.4,.6],[1.4,1.4],[.6,1.4]],hole)).toBe(0);
  });
  it('uses the small date-line-crossing area, with canonical round trips',()=>{
    const ring:Ring=[[179,-10],[-179,-10],[-179,10],[179,10]];
    const decoded=decodePolygon(encodePolygon(ring));
    expect(insidePolygon(decoded,{lon:180,lat:0})).toBe(true);
    expect(insidePolygon(decoded,{lon:-179.5,lat:0})).toBe(true);
    expect(insidePolygon(decoded,{lon:0,lat:0})).toBe(false);
    const bounds=polygonBounds(decoded);expect(bounds[2]-bounds[0]).toBe(2);
    expect(alpineOverlap(decoded,boundary)).toBe(0);
    const dateline:Polygon={type:'Polygon',coordinates:[[...ring,ring[0]]]};
    expect(alpineOverlap(decoded,dateline)).toBeCloseTo(1);
  });
  it.each([
    [[0,0],[1,1],[0,1],[1,0]], [[0,0],[1,0],[2,0]], [[0,0],[1,0],[1,1],[1,0]],
    [[0,0],[181,1],[0,2]], [[0,91],[1,0],[0,2]], [[0,0],[NaN,1],[1,1]],
    [[0,0],[2,0],[1,0],[2,2],[0,2]],
  ].map(ring=>({ring})))('rejects invalid geometry $ring',({ring})=>expect(()=>normalizePolygon(ring as Ring)).toThrow('polygon'));
  it('rejects malformed, truncated, overlong and oversized encodings',()=>{
    for(const s of ['','%%','gA','A'.repeat(1401),'AA','gICAgICA'])expect(()=>decodePolygon(s)).toThrow();
    const ring=Array.from({length:65},(_,i)=>[Math.cos(i*2*Math.PI/65),Math.sin(i*2*Math.PI/65)] as [number,number]);
    expect(()=>encodePolygon(ring)).toThrow();
  });
  it('round-trips the maximum number of vertices within the URL budget',()=>{
    const ring=Array.from({length:64},(_,i)=>[Math.cos(i*2*Math.PI/64),Math.sin(i*2*Math.PI/64)] as [number,number]);
    expect(decodePolygon(encodePolygon(ring))).toHaveLength(64);expect(encodePolygon(ring).length).toBeLessThan(1400);
  });
});
describe('custom daily selection',()=>{
  const pool:Candidate[]=Array.from({length:12},(_,i)=>({id:`wikidata:Q${i}`,difficulty:(['easy','medium','hard'] as const)[i%3],position:{lon:1,lat:1}}));
  it('is independent of candidate order and rotates daily',()=>{
    const picks=customPicks(pool,'catalog|polygon','2026-10-02');
    expect(customPicks([...pool].reverse(),'catalog|polygon','2026-10-02')).toEqual(picks);
    expect(picks.map(p=>p.difficulty)).toEqual(['easy','medium','hard']);
    expect(customPicks(pool,'catalog|polygon','2026-10-03').every(p=>!picks.some(q=>p.id===q.id))).toBe(true);
  });
  it('fills missing tiers without duplicates and requires three distinct peaks',()=>{
    const hard=pool.filter(p=>p.difficulty==='hard');
    const picks=customPicks(hard,'catalog|polygon','2026-10-02');
    expect(new Set(picks.map(p=>p.id)).size).toBe(3);expect(picks.every(p=>p.difficulty==='hard')).toBe(true);
    expect(()=>customPicks(hard.slice(0,2),'x','2026-10-02')).toThrow('few');
    expect(()=>customPicks([hard[0],hard[0],hard[1]],'x','2026-10-02')).toThrow();
  });
});
describe('game URLs',()=>{
  const defaults={mode:'alpine-peaks' as const,region:'eastern-alps' as const};
  const catalog='catalog-1234567890abcdef';
  it('honors explicit modes and regions ahead of preferences',()=>{
    expect(readGameRoute('?mode=alpine-peaks',defaults).region).toBe('alps');
    expect(readGameRoute('?mode=world-peaks',defaults).mode).toBe('world-peaks');
    expect(readGameRoute('',defaults).region).toBe('eastern-alps');
  });
  it('preserves deployment paths and pins a custom region without a date or answers',()=>{
    const url=new URL(gameURL('https://example.com/AlpTap/?date=old&score=10#answer',{mode:'custom',region:'alps',catalog,polygon:square}));
    expect(url.pathname).toBe('/AlpTap/');expect([...url.searchParams.keys()]).toEqual(['mode','v','catalog','poly']);
    expect(readGameRoute(url.search,defaults)).toEqual({mode:'custom',region:'alps',catalog,polygon:normalizePolygon(square)});
  });
  it.each(['?mode=bogus','?v=2','?mode=alpine-valleys','?mode=custom','?region=bogus','?mode=world-peaks&region=alps','?mode=world-peaks&mode=alpine-peaks','?catalog=','?catalog=../unsafe','?poly=abc'])('fails clearly for %s',query=>{
    expect(()=>readGameRoute(query,defaults)).toThrow();
  });
});
