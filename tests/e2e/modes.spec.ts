import {readFileSync} from 'node:fs';
import {generateModeChallenge,type ModeManifest} from '../../src/core/modes';
import {viennaDate} from '../../src/core/date';
import {test,expect} from '@playwright/test';
import {fixtureValleys} from './valley-fixture';

test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('alptap:onboarding:v1','true'));});
// Deferred while Valleys is removed from the public selector pending source data.
test.skip('world and valleys have independent progress and mode-specific geometry',async({page},info)=>{
 await fixtureValleys(page);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.locator('.game-card')).toBeVisible();
 const alpine=await page.evaluate(()=>localStorage.getItem('alptap:session:v1:alps:mixed'));
 await page.locator('.mode-select select').selectOption('world-peaks');
 await expect(page.locator('.game-card')).toHaveAttribute('data-difficulty','easy');
 await expect(page.locator('.question-area')).toContainText('MOUNTAIN REGION');
 await expect(page.getByTestId('map')).toHaveAttribute('data-settled','true');
 await page.getByRole('button',{name:'Guess at map center'}).click();await expect(page.locator('.result-stats')).toBeVisible();
 await page.getByRole('button',{name:'About AlpTap'}).click();await expect(page.locator('.about-dialog')).toContainText('250 km');
 const worldGuess=await page.evaluate(()=>JSON.parse(localStorage.getItem('alptap:session:v2:world-peaks')!).results[0].guess);
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.locator('.mode-select select').selectOption('alpine-valleys');
 await expect(page.locator('.game-card')).toHaveAttribute('data-difficulty','easy');
 await expect(page.locator('.game-card')).toContainText('Where is this valley?');
 await page.getByRole('button',{name:'Guess at map center'}).click();await expect(page.locator('.result-stats')).toBeVisible();
 await expect(page.locator('.summit-pin')).toHaveCount(0);
 await page.getByRole('button',{name:'About AlpTap'}).click();await expect(page.locator('.about-dialog')).toContainText('boundary');
 expect(await page.evaluate(()=>localStorage.getItem('alptap:session:v1:alps:mixed'))).toBe(alpine);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('alptap:session:v2:world-peaks')!).results[0].guess)).toEqual(worldGuess);
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.reload();await expect(page.locator('.mode-select select')).toHaveValue('alpine-valleys');await expect(page.locator('.result-stats')).toBeVisible();
 await page.screenshot({path:`output/modes/${info.project.name}-valley.png`});
 await page.locator('.mode-select select').selectOption('world-peaks');await expect(page.locator('.result-stats')).toBeVisible();
 await page.screenshot({path:`output/modes/${info.project.name}-world.png`});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 expect(errors).toEqual([]);
});
// Deferred while Valleys is removed from the public selector pending source data.
test.skip('retains a guess when a valley boundary fails and can retry',async({page})=>{
 await fixtureValleys(page);
 await page.route('**/valleys/*.json',r=>r.abort());await page.goto('/');await page.locator('.mode-select select').selectOption('alpine-valleys');
 await expect(page.locator('.game-card')).toBeVisible();await page.getByRole('button',{name:'Guess at map center'}).click();
 await expect(page.locator('.section-error')).toBeVisible();const guess=await page.evaluate(()=>JSON.parse(localStorage.getItem('alptap:session:v2:alpine-valleys')!).pendingGuess);
 await page.unroute('**/valleys/*.json');await page.locator('.section-error button').click();await expect(page.locator('.result-stats')).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('alptap:session:v2:alpine-valleys')!).results[0].guess)).toEqual(guess);
});
test('new mode labels and instructions follow all interface languages',async({page})=>{
 await page.goto('/');await page.locator('.mode-select select').selectOption('world-peaks');await expect(page.locator('.game-card')).toBeVisible();
 for(const locale of ['fr','de','it','en']){await page.locator('.language-select select').selectOption(locale);await expect(page.locator('html')).toHaveAttribute('lang',locale);await expect(page.locator('.mode-select select')).toHaveValue('world-peaks');}
});

test('hides valleys and preserves the original brand in both available modes',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('alptap:mode',JSON.stringify('alpine-valleys')));
 await page.goto('/');
 await expect(page.locator('.mode-select select')).toHaveValue('alpine-peaks');
 await expect(page.locator('.mode-select option[value="alpine-valleys"]')).toHaveCount(0);
 const brand=await page.locator('.brand').innerHTML();
 await page.locator('.mode-select select').selectOption('world-peaks');
 await expect(page.locator('.game-card')).toBeVisible();
 expect(await page.locator('.brand').innerHTML()).toBe(brand);
 expect(await page.evaluate(()=>localStorage.getItem('alptap:session:v2:alpine-valleys'))).toBeNull();
});

test('world rounds advance Easy to Medium to Hard with a bold current tier and persisted summary',async({page})=>{
 test.setTimeout(60000);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/');await page.locator('.mode-select select').selectOption('world-peaks');
 for(const [index,tier] of ['Easy','Medium','Hard'].entries()){
  const step=page.locator('.daily-order [aria-current="step"]');
  await expect(step).toHaveText(tier);expect(await step.evaluate(el=>Number(getComputedStyle(el).fontWeight))).toBeGreaterThanOrEqual(700);
  await page.getByRole('button',{name:'Guess at map center'}).click();await expect(page.locator('.result-stats')).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('alptap:session:v2:world-peaks')!).results.length)).toBe(index+1);
  await page.getByRole('button',{name:index<2?'Next round':'See results',exact:true}).click();
 }
 await expect(page.locator('.summary-card')).toBeVisible();
 await expect(page.locator('.summary-scrim')).toHaveClass(/scores-aside/);
 await expect(page.locator('.guess-pin')).toHaveCount(3);
 await expect(page.locator('.guess-pin').first()).toBeVisible();
 await expect(page.locator('.summit-pin')).toHaveCount(3);
 await expect(page.locator('.summit-pin').first()).toBeVisible();
 await page.reload();await expect(page.locator('.summary-card')).toBeVisible();
 await expect(page.locator('.summary-scrim')).toHaveClass(/scores-aside/);
 await expect(page.locator('.daily-order [aria-current="step"]')).toHaveCount(0);
});

// Deferred while Valleys is removed from the public selector pending source data.
test.skip('reveals a valley outline on the map without a summit pin',async({page},info)=>{
 await fixtureValleys(page);await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/');await page.locator('.mode-select select').selectOption('alpine-valleys');
 await expect(page.getByTestId('map')).toHaveAttribute('data-settled','true');
 await page.getByRole('button',{name:'Guess at map center'}).click();
 await expect(page.locator('.result-stats')).toBeVisible();
 await expect(page.getByTestId('map')).toHaveAttribute('data-settled','true');
 await expect(page.locator('.summit-pin')).toHaveCount(0);
 await page.screenshot({path:`output/modes/${info.project.name}-valley-outline.png`});
});

test('serves the expanded catalogue and translates a volcano target',async({page})=>{
 const indexes=JSON.parse(readFileSync('data/processed/mode-index.json','utf8'));
 const index=indexes.find((i:{mode:string})=>i.mode==='world-peaks');
 const manifest=JSON.parse(readFileSync(`public/data/${index.version}/manifest.json`,'utf8')) as ModeManifest;
 const challenge=generateModeChallenge(index,viennaDate());
 challenge.targetIds[0]='wikidata:Q16990'; // Real Easy volcano, restored through the static manifest.
 await page.addInitScript(challenge=>{
  localStorage.setItem('alptap:mode',JSON.stringify('world-peaks'));
  localStorage.setItem('alptap:session:v2:world-peaks',JSON.stringify({schemaVersion:2,challenge,targets:[],round:0,results:[],pendingGuess:null,complete:false}));
 },challenge);
 await page.goto('/');
 expect(manifest.targets.length).toBeGreaterThan(700);
 expect(manifest.targets.filter(t=>t.provenance.featureType==='volcano').length).toBeGreaterThan(200);
 for(const [locale,prompt] of Object.entries({en:'Where is this volcano?',fr:'Où se trouve ce volcan ?',de:'Wo liegt dieser Vulkan?',it:'Dove si trova questo vulcano?'})){
  await page.locator('.language-select select').selectOption(locale);await expect(page.locator('.peak-heading .prompt')).toHaveText(prompt);
 }
});

test('restores a saved worldwide challenge from the previous dataset',async({page})=>{
 const manifest=JSON.parse(readFileSync('public/data/mode-c21e681de816/manifest.json','utf8')) as ModeManifest;
 const challenge=generateModeChallenge({version:manifest.version,mode:'world-peaks',validated:true,targets:manifest.targets},viennaDate());
 await page.addInitScript(challenge=>{
  localStorage.setItem('alptap:mode',JSON.stringify('world-peaks'));
  localStorage.setItem('alptap:session:v2:world-peaks',JSON.stringify({schemaVersion:2,challenge,targets:[],round:0,results:[],pendingGuess:null,complete:false}));
 },challenge);
 await page.goto('/');await expect(page.locator('.game-card')).toBeVisible();
 await expect(page.locator('.peak-heading h1')).toHaveText(manifest.targets.find(t=>t.id===challenge.targetIds[0])!.name);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('alptap:session:v2:world-peaks')!).challenge.datasetVersion)).toBe(manifest.version);
});

test('Western and Eastern Alps are reachable directly from the worldwide mode selector',async({page})=>{
 await page.goto('/');await page.locator('.mode-select select').selectOption('world-peaks');
 for(const region of ['western-alps','eastern-alps']){
  await page.locator('.mode-select select').selectOption(region);
  await expect(page.locator('.filterbar>label:not(.mode-select) select')).toHaveValue(region);
  await expect(page.locator('.game-card')).toBeVisible();
  const saved=await page.evaluate(region=>JSON.parse(localStorage.getItem(`alptap:session:v1:${region}:mixed`)!).challenge.id,region);
  await page.locator('.mode-select select').selectOption('world-peaks');
  await page.locator('.mode-select select').selectOption(region);
  await expect(page.locator('.game-card')).toBeVisible();
  expect(await page.evaluate(region=>JSON.parse(localStorage.getItem(`alptap:session:v1:${region}:mixed`)!).challenge.id,region)).toBe(saved);
 }
 await page.reload();await expect(page.locator('.filterbar>label:not(.mode-select) select')).toHaveValue('eastern-alps');
});
