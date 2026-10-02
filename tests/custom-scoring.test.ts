import {describe,expect,it} from 'vitest';
import {customAreaKm2,customScoringProfile} from '../src/core/custom-scoring';
import {scoreDistance,scoreWithSection} from '../src/core/scoring';
import {SCORING} from '../src/core/config';
import type {Ring} from '../src/core/custom';

describe('custom surface scoring',()=>{
  it('measures spherical surface, latitude, concavity and date-line crossings',()=>{
    const square:Ring=[[0,0],[1,0],[1,1],[0,1]];
    const area=customAreaKm2(square);
    expect(area).toBeCloseTo(12363.718,2);
    expect(customAreaKm2([...square].reverse())).toBeCloseTo(area);
    expect(customAreaKm2([[179.5,0],[-179.5,0],[-179.5,1],[179.5,1]])).toBeCloseTo(area);
    expect(customAreaKm2([[0,60],[1,60],[1,61],[0,61]])).toBeLessThan(area/2);
    expect(customAreaKm2([[0,0],[1,0],[1,.5],[.5,.5],[.5,1],[0,1]])).toBeCloseTo(area*.75,0);
  });
  it.each(['alpine-peaks','world-peaks'] as const)('requires proportionate precision in %s',mode=>{
    const small=customScoringProfile(100,mode),large=customScoringProfile(400,mode);
    expect(large.farDistanceKm).toBe(small.farDistanceKm*2);
    expect(scoreDistance(2,small).score).toBe(scoreDistance(4,large).score);
    expect(scoreDistance(2,small).score).toBeLessThan(scoreDistance(2,large).score);
    expect(scoreDistance(2,small).score).toBeLessThan(scoreDistance(2,mode==='world-peaks'?'world':'alpine').score);
    expect(scoreDistance(small.perfectRadiusKm,small).score).toBe(1000);
    expect(scoreDistance(small.farDistanceKm,small).score).toBe(10);
    expect(scoreWithSection(small.farDistanceKm,true,small).score).toBe(158);
    expect(scoreWithSection(0,true,small).score).toBe(1000);
  });
  it('caps large surfaces at standard scoring and retains a tiny-area click tolerance',()=>{
    expect(customScoringProfile(1e9,'alpine-peaks')).toEqual(SCORING.alpine);
    expect(customScoringProfile(1e9,'world-peaks')).toEqual(SCORING.world);
    const tiny=customScoringProfile(.0001,'alpine-peaks');
    expect(tiny).toEqual({perfectRadiusKm:.025,farDistanceKm:1});
    const scores=[0,.025,.05,.5,1,10,20000].map(d=>scoreWithSection(d,true,tiny).score);
    expect(scores.every(s=>Number.isFinite(s)&&s>=0&&s<=1000)).toBe(true);
    expect(scores).toEqual([...scores].sort((a,b)=>b-a));
  });
  it.each([0,-1,NaN,Infinity])('rejects invalid surface %s',area=>{
    expect(()=>customScoringProfile(area,'world-peaks')).toThrow('Invalid custom area');
  });
});
