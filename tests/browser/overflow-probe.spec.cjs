// Intentional negative control. Excluded from the normal suite and CI.
const { test, expect } = require('@playwright/test');

test('negative control: a forced wide component must fail the phone overflow check', async ({ page }) => {
  await page.route(/https?:\/\/(?!127\.0\.0\.1:4173)/, route => route.abort());
  await page.goto('/movies/data/2026/11/05/my-top-directors-of-all-time.html');
  await page.addStyleTag({ content: '.director-rankings { min-width: 900px !important; }' });
  await page.locator('.director-rankings').evaluate(el => el.scrollIntoView({block: 'start', inline: 'start'}));
  const dimensions = await page.locator('html').evaluate(el => ({ viewport: el.clientWidth, content: el.scrollWidth }));
  console.log('Injected layout fault:', dimensions);
  expect(dimensions.content, 'Intentional failure: the forced minimum width overflows the phone viewport')
    .toBeLessThanOrEqual(dimensions.viewport + 1);
});
