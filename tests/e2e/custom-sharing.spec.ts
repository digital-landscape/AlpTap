import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {gameURL} from '../../src/core/game-url';
import type {Ring} from '../../src/core/custom';

const catalog=JSON.parse(readFileSync('public/data/catalogs/current.json','utf8')).id;
for(const [database,polygon] of [
  ['Alpine',[[7,45],[8,45],[8,46],[7,46]]],
  ['worldwide',[[-72,-34],[-68,-34],[-68,-30],[-72,-30]]],
] as [string,Ring][]){
  test(`shares ${database} custom results with the area link`,async({page},testInfo)=>{
    await page.addInitScript(()=>{
      localStorage.setItem('alptap:onboarding:v1','true');
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as any).copiedResults=text;}}});
      Object.defineProperty(navigator,'share',{configurable:true,value:async(data:ShareData)=>{(window as any).sharedResults=data;}});
    });
    const link=gameURL('http://127.0.0.1:5173/',{mode:'custom',region:'alps',catalog,polygon});
    await page.goto(new URL(link).search);
    await expect.poll(()=>page.evaluate(()=>Object.keys(localStorage).find(k=>k.startsWith('alptap:play:v1:')&&k.includes('custom-v1')))).toBeTruthy();
    // Restore completed guesses through the production scoring path.
    await page.evaluate(()=>{
      const key=Object.keys(localStorage).find(k=>k.startsWith('alptap:play:v1:')&&k.includes('custom-v1'))!;
      const session=JSON.parse(localStorage.getItem(key)!);
      session.round=2;session.complete=true;session.pendingGuess=null;
      session.results=(session.peaks??session.targets).map((target:any)=>({guess:target.position??{lat:target.lat,lon:target.lon}}));
      localStorage.setItem(key,JSON.stringify(session));
    });
    await page.reload();
    const share=page.getByRole('button',{name:'Share results',exact:true});
    const copy=page.getByRole('button',{name:'Copy results',exact:true});
    await expect(share).toBeVisible();await expect(copy).toBeVisible();
    await expect(share.locator('svg')).toBeVisible();await expect(copy.locator('svg')).toBeVisible();
    await copy.click();
    await expect(page.getByText('Results copied!',{exact:true})).toBeVisible();
    const copied=await page.evaluate(()=>(window as any).copiedResults as string);
    const expected=new URL(link).search;
    expect(copied).toContain('AlpTap · Custom');
    expect(new URL(copied.split('\n').at(-1)!).search).toBe(expected);
    await share.click();
    const shared=await page.evaluate(()=>(window as any).sharedResults as ShareData);
    expect(new URL(shared.url!).search).toBe(expected);
    expect(`${shared.text}\n${shared.url}`).toBe(copied);
    await page.screenshot({path:`output/custom-sharing/${database}-${testInfo.project.name}.png`});
    // Browsers without native sharing copy the same complete message.
    await page.evaluate(()=>{Object.defineProperty(navigator,'share',{value:undefined});(window as any).copiedResults=null;});
    await share.click();
    expect(await page.evaluate(()=>(window as any).copiedResults)).toBe(copied);
    await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw new Error('blocked');}}});});
    await copy.click();
    await expect(page.getByRole('textbox',{name:'Your share message'})).toHaveValue(copied);
  });
}
