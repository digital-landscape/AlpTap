import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('alptap:onboarding:v1','true'));});
test('one click reveals, locks the guess, restores progress, and saves summary',async({page},testInfo)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');
 await expect(page.locator('.game-card')).toBeVisible();
 await expect(page.locator('.question-area')).toContainText('SOIUSA');
 await expect(page.locator('.question-area p')).not.toBeEmpty();
 await expect(page.getByRole('button',{name:'Confirm location'})).toHaveCount(0);
 await expect(page.getByTestId('map')).toHaveAttribute('data-settled','true');
 const canvas=page.locator('.maplibregl-canvas');
 await canvas.click({position:testInfo.project.name==='mobile'?{x:160,y:260}:{x:850,y:420}});
 await expect(page.locator('.result-stats')).toBeVisible();
 await expect(page.locator('.source-link')).toHaveAttribute('href',/^https:\/\/(?:[a-z-]+\.wikipedia\.org\/wiki\/|www\.wikidata\.org\/wiki\/Q)/);
 const savedGuess=await page.evaluate(()=>JSON.parse(localStorage.getItem('alptap:session:v1:alps:mixed')!).results[0].guess);
 await canvas.click({position:testInfo.project.name==='mobile'?{x:210,y:230}:{x:950,y:350}});
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('alptap:session:v1:alps:mixed')!).results[0].guess)).toEqual(savedGuess);
 for(let round=0;round<3;round++){
  await expect(page.locator('.game-card')).toHaveAttribute('data-difficulty',['easy','medium','hard'][round]);
  await expect(page.locator('.mode-highlight [aria-current="step"]')).toHaveText(['Easy','Medium','Hard'][round]);
  await expect(page.locator('.mode-highlight [aria-current="step"]')).toHaveCSS('font-weight','800');
  if(round>0)await page.getByRole('button',{name:'Guess at map center'}).click();
  await expect(page.locator('.result-stats')).toBeVisible();
  await expect(page.locator('.summit-pin')).toBeVisible();
  await expect(page.locator('.section-result')).toBeVisible();
  await expect(page.locator('.result-continue-note')).toContainText('automatically');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('alptap:session:v1:alps:mixed')!).round)).toBe(round);
  // Avoid waiting for tile downloads during the six-second reveal; restore is checked after completion.
  await expect(page.getByRole('button',{name:'Next summit',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:round<2?'Next round':'See results',exact:true}).click();
  if(round<2)await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('alptap:session:v1:alps:mixed')!).round)).toBe(round+1);
 }
 await expect(page.getByRole('heading',{name:'Your Alpine discovery'})).toBeVisible();
 await expect(page.locator('.result-card-grid li')).toHaveCount(3);
 for(let i=0;i<3;i++)await expect(page.locator('.recap-card').nth(i)).toHaveAttribute('data-difficulty',['easy','medium','hard'][i]);
 await expect(page.locator('.recap-card .section-result')).toHaveCount(3);
 await expect(page.locator('.recap-card .score-breakdown')).toHaveCount(3);
 const scores=await page.evaluate(()=>JSON.parse(localStorage.getItem('alptap:session:v1:alps:mixed')!).results.map((r:{score:number})=>r.score));
 for(let i=0;i<3;i++)await expect(page.locator('.result-card-grid li').nth(i).locator('.result-stats>div').nth(1).locator('strong')).toContainText(new Intl.NumberFormat('en').format(scores[i]));
 await expect(page.locator('.summary-scrim')).not.toHaveClass(/scores-aside/);
 await page.getByRole('button',{name:'Move scores aside'}).click();
 await expect(page.locator('.guess-pin')).toHaveCount(3);
 await expect(page.locator('.guess-pin').first()).toBeVisible();
 await expect(page.locator('.summit-pin')).toHaveCount(3);
 await expect(page.locator('.summit-pin').first()).toBeVisible();
 await page.getByRole('button',{name:'Expand scores'}).click();
 await page.getByRole('button',{name:'Move scores aside'}).click();
 await expect(page.locator('.summary-scrim')).toHaveClass(/scores-aside/);
 await page.locator('.recap-map-button').first().click();
 await expect(page.locator('.guess-pin')).toHaveCount(3);
 await expect(page.locator('.guess-pin').first()).toBeVisible();
 await expect(page.locator('.summit-pin')).toHaveCount(3);
 await expect(page.locator('.summit-pin').first()).toBeVisible();
 await page.getByRole('button',{name:'Expand scores'}).click();
 await expect(page.locator('.summary-scrim')).not.toHaveClass(/scores-aside/);
 await page.reload();
 await expect(page.getByRole('heading',{name:'Your Alpine discovery'})).toBeVisible();
 await page.screenshot({path:`output/playwright/${testInfo.project.name}-summary.png`});
 expect(errors).toEqual([]);
});
test('loads all three mixed regional challenges and switches all interface languages',async({page})=>{
 await page.goto('/');
 for(const region of ['alps','western-alps','eastern-alps']){
   await page.locator('.mode-select select').selectOption(region==='alps'?'alpine-peaks':region);
   await expect(page.locator('.game-card')).toHaveAttribute('data-difficulty','easy');
   await expect(page.locator('.game-card')).toBeVisible();
   await expect.poll(()=>page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('alptap:preferences')!);const s=JSON.parse(localStorage.getItem(`alptap:session:v1:${p.region}:${p.difficulty}`)||'null');return s?.challenge.peakIds.length;})).toBe(3);
 }
 for(const locale of ['de','fr','it','en']){await page.locator('.language-select select').selectOption(locale);await expect(page.locator('html')).toHaveAttribute('lang',locale);}
 await page.reload();await expect(page.locator('.mode-select select')).toHaveValue('eastern-alps');await expect(page.locator('.filterbar>label:not(.mode-select) select')).toHaveCount(0);
});
test('provides a retry state when the static selection catalogue fails',async({page})=>{
 await page.route('**/data/processed/api-index.json*',route=>route.abort());await page.goto('/');await expect(page.getByRole('button',{name:'Try again',exact:true})).toBeVisible();await expect(page.locator('.game-card')).toHaveCount(0);
});
test('falls back to 2D when elevation tiles fail',async({page})=>{
 await page.route('**/terrarium/**',route=>route.abort());await page.goto('/');await expect(page.locator('.game-card')).toBeVisible();await expect(page.locator('.terrain-notice')).toBeVisible();await expect(page.locator('.terrain-toggle:not(.shadow-toggle)')).toBeDisabled();
 await page.getByRole('button',{name:'Guess at map center'}).click();await expect(page.locator('.result-stats')).toBeVisible();
});
test('respects reduced motion and has no horizontal mobile overflow',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await expect(page.locator('.game-card')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Guess at map center'}).click();expect(await page.locator('.reveal-content').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
});

test('section bonus survives refresh and the curve explains its value',async({page})=>{
 await page.route('**/sections/SZ.*.json',route=>{
  const id=new URL(route.request().url()).pathname.split('/').at(-1)!.replace('.json','');
  return route.fulfill({json:{type:'Feature',properties:{id,name:'Test section'},geometry:{type:'Polygon',coordinates:[[[-180,-85],[180,-85],[180,85],[-180,85],[-180,-85]]]}}});
 });
 await page.goto('/');await page.getByRole('button',{name:'Guess at map center'}).click();
 await expect(page.locator('.section-result')).toHaveClass(/matched/);
 const readResult=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('alptap:session:v1:alps:mixed')!).results[0]);
 const result=await readResult();expect(result.areaBonus).toBeGreaterThan(0);expect(result.score).toBe(result.distanceScore+result.areaBonus);
 await page.reload();await expect(page.locator('.section-result')).toHaveClass(/matched/);expect((await readResult()).score).toBe(result.score);
 await page.getByRole('button',{name:'About AlpTap'}).click();await expect(page.locator('.curve-values')).toContainText('737');
 await page.getByRole('slider',{name:'How points work'}).fill('100');await expect(page.locator('.curve-values')).toContainText('416');
});
test('a failed section fetch keeps the submitted guess and retries without losing the bonus',async({page})=>{
 await page.route('**/sections/SZ.*.json',route=>route.abort());await page.goto('/');
 await page.getByRole('button',{name:'Guess at map center'}).click();await expect(page.locator('.section-error')).toBeVisible();
 await expect(page.getByRole('button',{name:'Guess at map center'})).toHaveCount(0);
 await page.unroute('**/sections/SZ.*.json');await page.locator('.section-error button').click();await expect(page.locator('.result-stats')).toBeVisible();
});
