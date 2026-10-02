import {readFileSync} from 'node:fs';
import {test, expect} from '@playwright/test';
import type {ModeIndex, ModeManifest} from '../../src/core/modes';

test('Patagonia search shows the full region and respects difficulty filters', async ({page}) => {
 const indexes=JSON.parse(readFileSync('data/processed/mode-index.json','utf8')) as ModeIndex[];
 const index=indexes.find(i=>i.mode==='world-peaks')!;
 const manifest=JSON.parse(readFileSync(`public/data/${index.version}/manifest.json`,'utf8')) as ModeManifest;
 const patagonia=manifest.targets.filter(t=>t.regionIds.includes('gmba:13064'));
 await page.goto('/explore/?mode=world-peaks');
 const search=page.getByRole('searchbox');
 await search.fill('Patagonia');
 await expect(page.locator('.catalogue-filter [role=status]')).toHaveText(`${patagonia.length} peaks`);
 await page.getByRole('combobox',{name:'All difficulties',exact:true}).selectOption('hard');
 await expect(page.locator('.catalogue-filter [role=status]')).toHaveText(`${patagonia.filter(t=>t.difficulty==='hard').length} peaks`);
 await page.getByRole('combobox',{name:'All difficulties',exact:true}).selectOption('');
 await search.fill('Poincenot');
 await page.locator('.peak-list button').first().click();
 await expect(page.locator('.peak-detail h2')).toHaveText('Aguja Poincenot');
 await expect(page.locator('.explore-source')).toHaveAttribute('href',/wikipedia\.org\/wiki\//);
 expect(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('alptap:session:')))).toBe(false);
});

test('a peak with only a Spanish article keeps its Wikipedia source link', async ({page}) => {
 await page.route('**/explore/world-peaks.json', route=>route.fulfill({json:{version:'fixture',regions:{'gmba:13064':'Patagonian Andes'},peaks:[{
  id:'wikidata:Q1',name:'Cerro de prueba',names:{es:'Cerro de prueba'},aliases:[],elevation:null,countries:[],difficulty:'hard',
  position:{lon:-73,lat:-49},regions:['gmba:13064'],wikipedia:{es:'https://es.wikipedia.org/wiki/Cerro_de_prueba'}
 }]}}));
 await page.goto('/explore/?mode=world-peaks&peak=wikidata:Q1');
 await expect(page.locator('.explore-source')).toHaveText('Wikipedia · ES ↗');
 await expect(page.locator('.explore-source')).toHaveAttribute('href','https://es.wikipedia.org/wiki/Cerro_de_prueba');
});

test('global additions include a Medium summit with only local-language articles', async ({page}) => {
 await page.goto('/explore/?mode=world-peaks&peak=wikidata:Q1895254');
 await expect(page.locator('.peak-detail h2')).toHaveText('Margherita Peak (Mount Stanley)');
 await expect(page.locator('.peak-detail .peak-tier')).toHaveText('Medium');
 await expect(page.locator('.explore-source')).toHaveAttribute('href','https://de.wikipedia.org/wiki/Margherita_Peak');
 const catalogue=await page.request.get('/explore/world-peaks.json').then(r=>r.json());
 expect(Object.keys(catalogue.peaks.find((p:{id:string})=>p.id==='wikidata:Q1895254').wikipedia)).toHaveLength(2);
});
