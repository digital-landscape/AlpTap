import type {Page} from '@playwright/test';
import {generateModeChallenge,type ModeManifest,type Target} from '../../src/core/modes';
import {viennaDate} from '../../src/core/date';
// Synthetic rectangles exercise the withheld mode without admitting artificial release data.
export async function fixtureValleys(page:Page){
 const version='mode-000000000001';
 const targets:Target[]=['easy','medium','hard'].flatMap((tier,i)=>Array.from({length:6},(_,j)=>({id:`wikidata:Q${9000+i*10+j}`,kind:'valley' as const,name:`Test valley ${i}-${j}`,names:{},position:{lon:8,lat:46},difficulty:tier as 'easy'|'medium'|'hard',countries:['CH','FR','IT','AT'],wikipedia:{en:'https://en.wikipedia.org/wiki/Valley'},regionIds:[],geometryRef:`valleys/Q${9000+i*10+j}.json`,displayGeometryRef:`valleys/Q${9000+i*10+j}-display.json`,provenance:{source:'Synthetic test fixture',url:'https://example.org',license:'CC0',reviewed:true}})));
 const manifest:ModeManifest={schemaVersion:2,version,mode:'alpine-valleys',targets,regions:[],bounds:[4,43,17,49],attribution:[]};
 await page.route('**/v2/modes',r=>r.fulfill({json:{modes:[{mode:'world-peaks',available:true},{mode:'alpine-valleys',available:true}]}}));
 await page.route('**/v2/challenge?mode=alpine-valleys',r=>r.fulfill({json:generateModeChallenge({version,mode:'alpine-valleys',validated:true,targets},viennaDate())}));
 await page.route(`**/data/${version}/**`,r=>{
  const url=r.request().url();if(url.endsWith('manifest.json'))return r.fulfill({json:manifest});
  const id=url.match(/Q\d+/)?.[0];return r.fulfill({json:{type:'Feature',properties:{id:`wikidata:${id}`,name:'Test valley'},geometry:{type:'Polygon',coordinates:[[[7.5,45.5],[8.5,45.5],[8.5,46.5],[7.5,46.5],[7.5,45.5]]]}}});
 });
}
