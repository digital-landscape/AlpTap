import {describe,it,expect} from 'vitest';
import {peakInfoLink,peakBucket} from '../src/core/peak-links';
import {validChallenge} from '../src/core/persistence';
describe('Wikidata primary identities and article links',()=>{
 const peak={id:'wikidata:Q1374',wikidata:'Q1374',wikipedia:{it:'https://it.wikipedia.org/wiki/Cervino',en:'https://en.wikipedia.org/wiki/Matterhorn'}};
 it('resolves an existing localized article and an explicit fallback',()=>{
  expect(peakInfoLink(peak,'it').url).toContain('/Cervino');
  expect(peakInfoLink(peak,'fr').label).toBe('Wikipedia · EN');
  expect(peakInfoLink({...peak,wikipedia:{}},'de').url).toBe('https://www.wikidata.org/wiki/Q1374');
 });
 it('rejects unsafe article URLs',()=>expect(peakInfoLink({...peak,wikipedia:{it:'javascript:alert(1)'}},'it').label).toBe('Wikidata'));
 it('loads stable Wikidata shards while preserving old OSM datasets',()=>{
  expect(peakBucket('wikidata:Q1374')).toBe(1374%64);
  expect(peakBucket('osm:node/1374')).toBe(1374%64);
  expect(validChallenge({id:'daily',date:'2026-09-29',timezone:'Europe/Vienna',region:'alps',difficulty:'medium',datasetVersion:'alps-123456abcdef',algorithmVersion:'v1',roundCount:1,peakIds:['wikidata:Q1374'],nextRollover:'2026-09-29T22:00:00Z'})).toBe(true);
 });
});
