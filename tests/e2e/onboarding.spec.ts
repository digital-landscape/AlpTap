import {test,expect} from '@playwright/test';

test('first visit translates instructions, offers a real free shot, and remembers completion',async({page},testInfo)=>{
 await page.goto('/');
 const welcome=page.locator('.welcome-dialog');
 await expect(welcome).toBeVisible();
 await expect(welcome).toContainText('Daily challenge');
 await welcome.getByRole('combobox').selectOption('fr');
 await expect(welcome.getByRole('heading',{name:'Bienvenue sur AlpTap'})).toBeVisible();
 expect(await welcome.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await welcome.getByRole('button',{name:'Essayer le Mont Blanc sur la carte'}).click();
 await expect(welcome).not.toBeVisible();
 await expect(page.locator('.practice-card')).toContainText('Mont Blanc');
 await expect(page.locator('.daily-order [aria-current]')).toHaveCount(0);
 await expect(page.getByTestId('map')).toHaveAttribute('data-settled','true');
 const dailyBefore=await page.evaluate(()=>localStorage.getItem('alptap:session:v1:alps:mixed'));
 await page.locator('.maplibregl-canvas').click({position:testInfo.project.name==='mobile'?{x:160,y:260}:{x:850,y:420}});
 await expect(page.locator('.practice-card .result-stats')).toBeVisible();
 await expect(page.locator('.summit-pin')).toBeVisible();
 const distance=await page.locator('.practice-card .result-stats strong').textContent();
 await page.locator('.maplibregl-canvas').click({position:testInfo.project.name==='mobile'?{x:210,y:230}:{x:950,y:350}});
 await expect(page.locator('.practice-card .result-stats strong')).toHaveText(distance!);
 expect(await page.evaluate(()=>localStorage.getItem('alptap:session:v1:alps:mixed'))).toBe(dailyBefore);
 await page.screenshot({path:`output/practice/${testInfo.project.name}.png`});
 await page.getByRole('button',{name:'Commencer le défi du jour'}).click();
 await expect(page.locator('.practice-card')).toHaveCount(0);
 await expect(page.locator('.mode-highlight [aria-current="step"]')).toHaveText('Facile');
 await page.reload();
 await expect(welcome).not.toBeVisible();
 await expect(page.locator('html')).toHaveAttribute('lang','fr');
 await expect(page.locator('.mode-highlight')).toContainText('Défi du jour');
 await page.getByRole('button',{name:'À propos d’AlpTap'}).click();
 await page.getByRole('button',{name:'Comment jouer'}).click();
 await expect(welcome).toBeVisible();
});

test('uses the browser language on first visit',async({browser})=>{
 const context=await browser.newContext({locale:'de-AT'});
 const page=await context.newPage();
 await page.goto('/');
 await expect(page.locator('.welcome-dialog')).toContainText('Willkommen bei AlpTap');
 await expect(page.locator('.welcome-language select')).toHaveValue('de');
 await context.close();
});

test('Escape skips welcome and remembers the choice',async({page})=>{
 await page.goto('/');
 await expect(page.locator('.welcome-dialog')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.locator('.welcome-dialog')).not.toBeVisible();
 await expect(page.locator('.practice-card')).toHaveCount(0);
 await expect(page.locator('.mode-highlight [aria-current="step"]')).toHaveText('Easy');
 await page.reload();
 await expect(page.locator('.welcome-dialog')).not.toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('alptap:onboarding:v1')!))).toBe(true);
});

test('Escape skips practice before or after a guess without changing daily progress',async({page})=>{
 await page.goto('/');
 await page.locator('.welcome-dialog .primary').click();
 await expect(page.locator('.practice-card')).toBeVisible();
 await expect(page.locator('.game-card')).toBeVisible();
 const before=await page.evaluate(()=>localStorage.getItem('alptap:session:v1:alps:mixed'));
 await page.keyboard.press('Escape');
 await expect(page.locator('.practice-card')).toHaveCount(0);
 await page.locator('.help-button').click();
 await page.locator('.example-button').click();
 await page.locator('.welcome-dialog .primary').click();
 await page.locator('.center-guess').click();
 await expect(page.locator('.practice-card.revealed')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.locator('.practice-card')).toHaveCount(0);
 expect(await page.evaluate(()=>localStorage.getItem('alptap:session:v1:alps:mixed'))).toBe(before);
});

test('desktop allows panning and ignores a release carried into the next round',async({page},testInfo)=>{
 test.skip(testInfo.project.name!=='desktop');
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/');
 await expect(page.locator('.welcome-dialog')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.locator('.maplibregl-canvas')).toBeVisible();
 await expect(page.locator('.game-card[data-difficulty="easy"]')).toBeVisible();
 await page.mouse.move(850,420);
 await page.mouse.down();
 await page.mouse.move(1000,490,{steps:12});
 await page.mouse.up();
 await expect(page.locator('.game-card.revealed')).toHaveCount(0);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('alptap:session:v1:alps:mixed')!).pendingGuess)).toBeNull();
 await page.mouse.move(850,420);
 await page.mouse.down();
 await expect(page.locator('.game-card.revealed')).toHaveCount(0);
 await page.mouse.up();
 await expect(page.locator('.game-card.revealed')).toBeVisible();
 await page.mouse.down();
 await expect(page.locator('.game-card[data-difficulty="medium"]')).toBeVisible();
 await page.mouse.up();
 await expect(page.locator('.game-card.revealed')).toHaveCount(0);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('alptap:session:v1:alps:mixed')!).pendingGuess)).toBeNull();
 await page.mouse.down();
 await expect(page.locator('.game-card.revealed')).toHaveCount(0);
 await page.mouse.up();
 await expect(page.locator('.game-card.revealed')).toBeVisible();
});

test('touch tap still submits practice',async({page},testInfo)=>{
 test.skip(testInfo.project.name!=='mobile');
 await page.goto('/');
 await page.locator('.welcome-dialog .primary').tap();
 await expect(page.getByTestId('map')).toHaveAttribute('data-settled','true');
 await page.touchscreen.tap(160,260);
 await expect(page.locator('.practice-card.revealed')).toBeVisible();
});

test('terrain slider starts at 1.5 and adjusts without guessing',async({page})=>{
 await page.goto('/');
 await expect(page.locator('.welcome-dialog')).toBeVisible();
 await page.keyboard.press('Escape');
 const slider=page.getByRole('slider',{name:'Terrain exaggeration'});
 await expect(slider).toHaveValue('1.5');
 await expect(slider).toBeEnabled();
 const box=await slider.boundingBox();
 expect(box!.height).toBeGreaterThan(box!.width);
 await slider.focus();
 await page.keyboard.press('ArrowUp');
 await expect(slider).toHaveValue('1.6');
 await expect(page.locator('.terrain-exaggeration output')).toHaveText('1.6×');
 await expect(page.locator('.game-card.revealed')).toHaveCount(0);
 await page.locator('.terrain-toggle').click();
 await expect(slider).toBeDisabled();
 await page.locator('.terrain-toggle').click();
 await expect(slider).toBeEnabled();
 await expect(slider).toHaveValue('1.6');
});
