import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { generateChallenge } from '../src/core/challenge';
import { DIFFICULTIES, REGIONS } from '../src/core/config';
import { validPeak } from '../src/core/persistence';
import type { Manifest, Peak, PeakIndex } from '../src/core/types';
const manifest=JSON.parse(readFileSync('public/data/manifest.json','utf8')) as Manifest;
const index=JSON.parse(readFileSync('data/processed/api-index.json','utf8')) as {version:string;peaks:PeakIndex[]};
describe('production dataset',()=>{
 it('provides ordered mixed challenges in every production region',()=>{for(const region of REGIONS){const c=generateChallenge(index.peaks,{date:'2026-09-29',region,difficulty:'mixed',datasetVersion:index.version});expect(c.peakIds.map(id=>index.peaks.find(p=>p.id===id)!.difficulty)).toEqual(['easy','medium','hard']);}});

 it('has consistent hierarchy, index, immutable version, and loadable shards',()=>{
  expect(index.version).toBe(manifest.version);expect(index.peaks.length).toBe(manifest.peakCount);
  const unitIds=new Set(manifest.units.map(u=>u.id));expect(unitIds.size).toBe(manifest.units.length);for(const u of manifest.units)if(u.parentId)expect(unitIds.has(u.parentId)).toBe(true);
  expect(manifest.units.filter(u=>u.level==='section')).toHaveLength(36);
  const records:Record<string,Peak>={};for(let n=0;n<64;n++)Object.assign(records,JSON.parse(readFileSync(`public/data/${index.version}/peaks-${String(n).padStart(2,'0')}.json`,'utf8')));
  expect(Object.keys(records)).toHaveLength(manifest.peakCount);
  for(const p of Object.values(records)){expect(validPeak(p)).toBe(true);expect(p.id).toMatch(/^wikidata:Q\d+$/);expect(p.provenance.source).toBe('Wikidata');expect(p.soiusa.sectionIds.every(id=>unitIds.has(id))).toBe(true);}
  expect(records['wikidata:Q1374'].countries).toEqual(['CH','IT']);
 });
 it('serves three distinct eligible peaks for all nine combinations',()=>{for(const region of REGIONS)for(const difficulty of DIFFICULTIES){const challenge=generateChallenge(index.peaks,{date:'2026-09-29',region,difficulty,datasetVersion:index.version});expect(challenge.peakIds).toHaveLength(3);expect(new Set(challenge.peakIds).size).toBe(3);}});
});
