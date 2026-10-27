import {test,expect} from '@playwright/test';
const credit=/EOxCloudless https:\/\/cloudless\.eox\.at by EOX IT Services GmbH \(Contains modified Copernicus Sentinel data \d{4}\)/;
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('alptap:onboarding:v1','true'));});
test('EOxCloudless credit appears in the map and About dialog',async({page},info)=>{
 await page.goto('/');
 const attribution=page.locator('.maplibregl-ctrl-attrib');
 await expect(attribution).toContainText(credit);
 await expect(attribution.getByRole('link',{name:'https://cloudless.eox.at'})).toHaveAttribute('href','https://cloudless.eox.at');
 await page.screenshot({path:info.outputPath('map.png')});
 await page.getByRole('button',{name:'About AlpTap'}).click();
 const about=page.locator('.about-dialog .imagery-credit');
 await expect(about).toContainText(credit);
 await about.scrollIntoViewIfNeeded();
 await page.screenshot({path:info.outputPath('about.png')});
});
