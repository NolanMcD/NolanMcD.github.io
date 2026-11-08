const { test, expect } = require('@playwright/test');
const samples = [['blank', '—'], ['zero', '0'], ['125-4', '125.4'], ['999-9', '999.9'], ['1250-5', '1,250.5']];

for (const width of [1280, 390, 320]) {
  test(`mileage photo and selectable bib text fit ${width}px layouts`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    for (const [slug, label] of samples) {
      await page.goto(`/__running-preview/${slug}.html`);
      await page.evaluate(() => document.fonts.ready);
      const photo = page.locator('.running-mileage__photo img');
      const text = page.locator('.running-mileage__number');
      const caption = page.locator('.running-mileage__caption');
      await expect(text).toHaveText(label);
      await expect(caption).toContainText(`2026 running total · ${label} miles`);
      await expect(page.locator('.running-mileage__overlay')).toHaveAttribute('aria-hidden', 'true');
      if (slug === 'blank') {
        await expect(caption).toContainText('Mileage coming soon.');
        await expect(caption.locator('time')).toHaveCount(0);
      } else {
        await expect(caption.locator('time')).toHaveAttribute('datetime', '2026-11-08');
        await expect(caption).not.toContainText('Mileage coming soon.');
      }
      const image = await photo.evaluate(img => ({width: img.naturalWidth, height: img.naturalHeight, drawn: img.getBoundingClientRect().width / img.getBoundingClientRect().height}));
      expect([image.width, image.height]).toEqual([1086, 1448]);
      expect(image.drawn).toBeCloseTo(1086 / 1448, 4);
      const bounds = await text.evaluate(el => {
        const b = el.getBBox();
        return { x: b.x, width: b.width, center: b.x + b.width / 2, selectable: getComputedStyle(el).userSelect };
      });
      await expect(text).toHaveAttribute('x', '858');
      // Glyph side bearings can offset the ink bounds slightly from the exact SVG anchor.
      expect(Math.abs(bounds.center - 858)).toBeLessThan(2);
      expect(bounds.x).toBeGreaterThan(710);
      expect(bounds.x + bounds.width).toBeLessThan(1005);
      expect(bounds.selectable).toBe('text');
      const selection = await text.evaluate(el => {
        const range = document.createRange(); range.selectNodeContents(el);
        const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
        const value = selection.toString(); selection.removeAllRanges(); return value;
      });
      expect(selection).toBe(label);
      expect(await page.locator('html').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
      const screenshot = testInfo.outputPath(`${width}px-${slug}-light.png`);
      await page.locator('.running-mileage').screenshot({path: screenshot});
      await testInfo.attach(`${width}px-${slug}-light`, { path: screenshot, contentType: 'image/png' });
    }
    await page.locator('html').evaluate(el => { el.dataset.theme = 'dark'; });
    const darkScreenshot = testInfo.outputPath(`${width}px-dark.png`);
    await page.locator('.running-mileage').screenshot({path: darkScreenshot});
    await testInfo.attach(`${width}px-dark`, { path: darkScreenshot, contentType: 'image/png' });
  });
}

test('manual mileage works without JavaScript and replaces the Strava shortcut', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: {width: 320, height: 900} });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/');
  await expect(page.locator('.running-mileage')).toBeVisible();
  await expect(page.locator('.running-mileage__caption')).toContainText('running total');
  const label = await page.locator('.running-mileage__number').textContent();
  await expect(page.locator('.running-mileage__caption')).toContainText(`${label} miles`);
  await expect(page.locator('.home-shortcuts a[href*="strava.com"]')).toHaveCount(0);
  await page.screenshot({path: test.info().outputPath('homepage-no-js-320.png')});
  await page.setViewportSize({width: 1280, height: 900});
  await page.screenshot({path: test.info().outputPath('homepage-no-js-desktop.png')});
  await context.close();
});
