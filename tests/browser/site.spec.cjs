const { test, expect } = require('@playwright/test');
const rankings = '/movies/data/2026/11/05/my-top-directors-of-all-time.html';

test.beforeEach(async ({ page }) => {
  // External image hosts are not part of this site's behavior. Exercise the fallback deterministically.
  await page.route(/https?:\/\/(?!127\.0\.0\.1:4173)/, route => route.abort());
});

async function fits(page, scope = page) {
  await expect.poll(() => scope.locator('html').evaluate(el => el.scrollWidth - el.clientWidth),
    { message: 'The page must not require horizontal scrolling' }).toBeLessThanOrEqual(1);
}

test('Writing & Projects combines filters, resets, and restores browser history', async ({ page }) => {
  await page.goto('/projects/');
  const cards = page.locator('#archive-stream > article');
  const allCount = await cards.count();
  expect(allCount).toBeGreaterThan(18);
  await page.getByRole('button', { name: 'Writing', exact: true }).click();
  await page.getByRole('button', { name: 'Film', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My top directors of all time, two ways' })).toBeVisible();
  await expect(page.locator('[data-archive-type="project"]:visible')).toHaveCount(0);
  await expect(page).toHaveURL(/type=writing.*topic=film/);
  const selectedUrl = page.url();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Film', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('#archive-stream > article:visible')).toHaveCount(allCount);
  await page.goBack();
  await expect(page).toHaveURL(selectedUrl);
  await expect(page.locator('[data-archive-type="project"]:visible')).toHaveCount(0);
  await fits(page);
});

test('Director sorting updates order, shared links, tied ranks, and image fallback', async ({ page }) => {
  await page.goto(rankings);
  const cards = page.locator('.dr-card');
  await expect(cards.first().locator('h2')).toHaveText('Steven Spielberg');
  await page.getByRole('button', { name: 'Average rating', exact: true }).click();
  await expect(cards.first().locator('h2')).toHaveText('Christopher Nolan');
  await expect(cards.nth(1).locator('h2')).toHaveText('Stanley Kubrick');
  await expect(cards.nth(2).locator('.dr-rank')).toHaveText('3');
  await expect(cards.nth(3).locator('.dr-rank')).toHaveText('3');
  await expect(page).toHaveURL(/rank=average/);
  await page.reload();
  await expect(cards.first().locator('h2')).toHaveText('Christopher Nolan');
  await expect(cards.first().locator('.dr-portrait img')).toBeHidden();
  await page.getByRole('button', { name: 'Total stars', exact: true }).click();
  await expect(cards.first().locator('h2')).toHaveText('Steven Spielberg');
  await cards.first().locator('.dr-films summary').click();
  await expect(cards.first().locator('.dr-films li')).toHaveCount(21);
  await fits(page);
});

test('Shannon ticket purchase keeps choices and reveals its parent scene ending', async ({ page }) => {
  await page.goto('/blood-manatees/scene/6/');
  const terminal = page.frameLocator('[data-bm-airport]');
  await expect(page.locator('[data-bm-airport-ending]')).toBeHidden();
  await terminal.getByRole('button', { name: 'Touch to begin' }).click();
  await terminal.getByRole('button', { name: /Place Ewen.*passport on reader/ }).click();
  await terminal.locator('#continue').click();
  await terminal.getByRole('button', { name: '32C', exact: true }).click();
  await terminal.locator('#continue').click();
  await terminal.locator('[data-story-bags="2"]').click();
  await terminal.locator('#back').click();
  await expect(terminal.getByRole('button', { name: '32C', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await terminal.locator('#continue').click();
  await expect(terminal.locator('[data-story-bags="2"]')).toHaveAttribute('aria-pressed', 'true');
  await terminal.locator('#continue').click();
  await expect(terminal.locator('#screen')).toContainText('Seat 32C');
  await terminal.locator('#continue').click();
  await terminal.getByRole('button', { name: 'Take the ticket' }).click();
  await expect(page.locator('[data-bm-airport-ending]')).toBeVisible();
  await fits(page);
  await fits(page, terminal);
});

test('Miami workstation synchronizes its cameras, completion, and replay', async ({ page }) => {
  await page.goto('/blood-manatees/scene/7/');
  const ending = page.locator('[data-arrival-ending]');
  const view = name => page.locator(`[data-arrival-view="${name}"]`);
  await expect(ending).toBeHidden();
  await page.getByRole('button', { name: 'Open passenger record' }).click();
  await expect(view('desk')).toBeVisible();
  await page.getByRole('button', { name: 'Review passenger information' }).click();
  await expect(page.locator('[data-arrival-screen]')).toContainText('Position eliminated');
  await page.getByRole('button', { name: 'Open equipment record' }).click();
  await expect(view('baggage')).toBeVisible();
  await page.getByRole('button', { name: 'Accept equipment description' }).click();
  await page.getByRole('button', { name: 'Close arrival record' }).click();
  await expect(view('exit')).toBeVisible();
  await expect(ending).toBeVisible();
  await expect(ending).toBeFocused();
  await page.getByRole('button', { name: 'Replay arrival' }).click();
  await expect(ending).toBeHidden();
  await expect(view('corridor')).toBeVisible();
  await fits(page);
});

test('Dark mode survives reload and navigation without page overflow', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.locator('#theme-menu summary').click();
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  for (const path of ['/', '/projects/', '/reviews/diary/', rankings, '/code/data/2026/11/08/how-i-test-noland.html']) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await fits(page);
  }
});
