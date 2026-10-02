import {describe, it, expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {peakInfoLink} from '../src/core/peak-links';
import type {ModeIndex, ModeManifest} from '../src/core/modes';

describe('generated worldwide explorer catalogue', () => {
 it('uses the active gameplay version and retains all article languages', () => {
  execFileSync(process.execPath, ['scripts/prepare-explore.mjs']);
  const index = (JSON.parse(readFileSync('data/processed/mode-index.json','utf8')) as ModeIndex[]).find(i=>i.mode==='world-peaks')!;
  const manifest = JSON.parse(readFileSync(`public/data/${index.version}/manifest.json`,'utf8')) as ModeManifest;
  const explorer = JSON.parse(readFileSync('public/explore/world-peaks.json','utf8'));
  expect(explorer.version).toBe(index.version);
  expect(explorer.peaks.map((p:{id:string})=>p.id)).toEqual(manifest.targets.map(t=>t.id));
  for (const [i, target] of manifest.targets.entries()) {
   expect(explorer.peaks[i].wikipedia).toEqual(target.wikipedia);
   expect(peakInfoLink({...explorer.peaks[i],wikidata:target.id.slice(9)},'en').url).toContain('.wikipedia.org/wiki/');
  }
 });
});
