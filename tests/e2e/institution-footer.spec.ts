import {test, expect} from '@playwright/test';

test('institution signatures fit the viewport and follow the selected language', async ({page}, testInfo) => {
  await page.goto('/');
  const footer = page.locator('.institution-layout > .institution-footer');
  const links = footer.locator('a');
  await expect(links).toHaveCount(2);
  for (const locale of ['de', 'en', 'fr', 'it']) {
    await page.locator('.welcome-language select').selectOption(locale);
    await expect(links.nth(0)).toHaveAttribute('href', locale === 'de' ? 'https://www.oeaw.ac.at' : 'https://www.oeaw.ac.at/en/');
    await expect(links.nth(1)).toHaveAttribute('href', locale === 'de' ? 'https://www.oeaw.ac.at/igf/home' : 'https://www.oeaw.ac.at/en/igf/home');
    const welcomeLinks = page.locator('.welcome-dialog .institution-footer a');
    await expect(welcomeLinks).toHaveCount(2);
    await expect(welcomeLinks.nth(0)).toHaveAttribute('href', (await links.nth(0).getAttribute('href'))!);
    await expect(welcomeLinks.nth(1)).toHaveAttribute('href', (await links.nth(1).getAttribute('href'))!);
    await expect(welcomeLinks.nth(0)).toHaveAttribute('target', '_blank');
    await expect(welcomeLinks.nth(1)).toHaveAttribute('target', '_blank');
    for (const link of await links.all()) {
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  }
  const images = await footer.locator('img').evaluateAll(elements => elements.map(element => {
    const img = element as HTMLImageElement;
    return {height: img.getBoundingClientRect().height, loaded: img.complete && img.naturalWidth > 0};
  }));
  expect(images[0].height).toBe(images[1].height);
  expect(images.every(img => img.loaded)).toBe(true);
  expect(await footer.evaluate(el => {
    const rect = el.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight;
  })).toBe(true);
  await page.screenshot({path: `output/institution-footer/${testInfo.project.name}.png`});
});
