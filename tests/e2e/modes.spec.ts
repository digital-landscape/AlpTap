import {test,expect} from '@playwright/test';
import {fixtureValleys} from './valley-fixture';

test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('alptap:onboarding:v1','true'));});
test('world and valleys have independent progress and mode-specific geometry',async({page},info)=>{
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
test('retains a guess when a valley boundary fails and can retry',async({page})=>{
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

test('withholds the real valley catalogue until all countries pass review',async({page})=>{
 await page.goto('/');await page.locator('.mode-select select').selectOption('alpine-valleys');
 await expect(page.locator('.loading-card')).toContainText('not ready yet');
 await expect(page.locator('.game-card')).toHaveCount(0);
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
 }
 await expect(page.locator('.summary-card')).toBeVisible();
 await page.reload();await expect(page.locator('.summary-card')).toBeVisible();
 await expect(page.locator('.daily-order [aria-current="step"]')).toHaveCount(0);
});

test('reveals a valley outline on the map without a summit pin',async({page},info)=>{
 await fixtureValleys(page);await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/');await page.locator('.mode-select select').selectOption('alpine-valleys');
 await expect(page.getByTestId('map')).toHaveAttribute('data-settled','true');
 await page.getByRole('button',{name:'Guess at map center'}).click();
 await expect(page.locator('.result-stats')).toBeVisible();
 await expect(page.getByTestId('map')).toHaveAttribute('data-settled','true');
 await expect(page.locator('.summit-pin')).toHaveCount(0);
 await page.screenshot({path:`output/modes/${info.project.name}-valley-outline.png`});
});
