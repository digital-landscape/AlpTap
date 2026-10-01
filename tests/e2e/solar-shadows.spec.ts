import { test, expect } from '@playwright/test';
test('GPU depth shadows move across a ridge with the sun and flatten at zero height',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  // Load the actual renderer through Vite; exercise its shaders with controlled terrain.
  const moduleUrl='/src/map/SolarShadowRenderer.ts';
  const {SolarShadowRenderer}=await import(/* @vite-ignore */ moduleUrl);
  const renderer=new SolarShadowRenderer();
  const heights=new Float32Array(64*64);for(let y=0;y<64;y++)for(let x=30;x<34;x++)heights[y*64+x]=1000;
  const alpha=(sun:[number,number,number],height:number)=>{
   const canvas=renderer.render(heights,64,[10000,10000],sun,height);
   const copy=document.createElement('canvas');copy.width=copy.height=384;const context=copy.getContext('2d')!;context.drawImage(canvas,0,0);
   return [context.getImageData(140,192,1,1).data[3],context.getImageData(244,192,1,1).data[3]];
  };
  const morning=alpha([Math.sqrt(.75),0,.5],1),evening=alpha([-Math.sqrt(.75),0,.5],1),flat=alpha([Math.sqrt(.75),0,.5],0),night=alpha([0,0,-1],1);
  renderer.dispose();return {morning,evening,flat,night};
 });
 expect(result.morning[0]).toBeGreaterThan(result.morning[1]+30);
 expect(result.evening[1]).toBeGreaterThan(result.evening[0]+30);
 expect(Math.abs(result.flat[0]-result.flat[1])).toBeLessThan(3);
 expect(result.night[0]).toBeGreaterThan(70);
});
test('live shadows refresh time and follow terrain controls',async({page})=>{
 test.setTimeout(90000);
 await page.clock.install({time:new Date('2026-06-21T10:00:00Z')});
 await page.goto('/');await expect(page.locator('.welcome-dialog')).toBeVisible();await page.keyboard.press('Escape');
 const map=page.getByTestId('map');
 await expect(map).toHaveAttribute('data-solar-status','ready',{timeout:45000});
 await page.screenshot({path:`output/terrain-shading/solar-${test.info().project.name}.png`});
 const shadows=page.getByRole('button',{name:'Sun shadows',exact:true});
 await expect(shadows).toHaveAttribute('aria-pressed','true');
 await shadows.click();await expect(map).toHaveAttribute('data-solar-status','disabled');
 await shadows.click();await expect(map).toHaveAttribute('data-solar-status','ready');
 const before=await map.getAttribute('data-solar-time');
 await page.clock.fastForward(60000);
 await expect(map).not.toHaveAttribute('data-solar-time',before!);
 await page.locator('.terrain-toggle:not(.shadow-toggle)').click();await expect(map).toHaveAttribute('data-solar-status','disabled');
 await page.locator('.terrain-toggle:not(.shadow-toggle)').click();await expect(map).toHaveAttribute('data-solar-status','ready');
 await page.getByRole('slider',{name:'Terrain exaggeration'}).fill('0');await expect(map).toHaveAttribute('data-solar-status','disabled');
});

test('shadows start off at night and can be enabled manually',async({page})=>{
 test.setTimeout(90000);
 await page.clock.install({time:new Date('2026-06-21T00:00:00Z')});
 await page.goto('/');await expect(page.locator('.welcome-dialog')).toBeVisible();await page.keyboard.press('Escape');
 const map=page.getByTestId('map'),shadows=page.getByRole('button',{name:'Sun shadows',exact:true});
 await expect(map).toHaveAttribute('data-settled','true');
 await expect(shadows).toHaveAttribute('aria-pressed','false');
 await expect(map).toHaveAttribute('data-solar-status','disabled');
 await expect(page.locator('.terrain-toggle:not(.shadow-toggle)')).toHaveAttribute('aria-pressed','true');
 await page.screenshot({path:`output/shadow-controls/night-${test.info().project.name}.png`});
 await shadows.click();await expect(map).toHaveAttribute('data-solar-status','ready',{timeout:45000});
 await expect(shadows).toHaveAttribute('aria-pressed','true');
 await shadows.click();await expect(map).toHaveAttribute('data-solar-status','disabled');
 await page.clock.fastForward(12*60*60*1000);
 await expect(shadows).toHaveAttribute('aria-pressed','false');
});
