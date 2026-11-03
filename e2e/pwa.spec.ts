import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { STATIC_COPY } from './paths.mjs';
import { answer, waitForServiceWorker } from './helpers.ts';

/** Changes sw.js like a new deployment and waits until the new worker is installed. */
async function deployNewVersion(page: Page) {
  appendFileSync(join(STATIC_COPY, 'sw.js'), `\n// deployed ${Date.now()}\n`);
  await page.evaluate(async () => {
    const registration = (await navigator.serviceWorker.getRegistration())!;
    await registration.update();
    for (let i = 0; i < 100 && !registration.waiting; i++) await new Promise((r) => setTimeout(r, 100));
    if (!registration.waiting) throw new Error('new service worker not installed');
  });
}

test('is installable as a PWA', async ({ page }) => {
  await page.goto('/');
  await waitForServiceWorker(page);
  const manifest = await page.request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBe(true);
  expect(await manifest.json()).toMatchObject({
    name: 'Pydra: Python Trainer',
    short_name: 'Pydra',
    display: 'standalone',
    start_url: '/',
    scope: '/',
  });

  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  expect(installabilityErrors).toEqual([]);
});

test('serves the app and its caching headers', async ({ request }) => {
  const index = await request.get('/');
  expect(index.headers()['cache-control']).toBe('no-cache');
  const sw = await request.get('/sw.js');
  expect(sw.headers()['cache-control']).toBe('no-cache');
  const html = await index.text();
  const asset = html.match(/\/assets\/[^"]+\.js/)![0];
  expect((await request.get(asset)).headers()['cache-control']).toBe('public, max-age=31536000, immutable');
  expect((await request.get('/api/health')).ok()).toBe(true);
});

test('loads and runs a quiz offline from the service worker', async ({ page, context }) => {
  await page.goto('/');
  await waitForServiceWorker(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('start-mixed')).toBeVisible();
  await page.getByTestId('start-mixed').click();
  await answer(page);
  await expect(page.locator('.explanation')).not.toBeEmpty();
  // App routes fall back to the cached index.html.
  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Einstellungen');
  await context.setOffline(false);
});

test('reloads at once when a new version is deployed outside a quiz', async ({ page }) => {
  await page.goto('/');
  await waitForServiceWorker(page);
  await page.evaluate(() => Object.assign(window, { marker: true }));

  const reloaded = page.waitForEvent('load');
  await deployNewVersion(page);
  await reloaded;
  await expect(page.getByTestId('start-mixed')).toBeVisible();
  expect(await page.evaluate(() => 'marker' in window)).toBe(false);
});

test('waits with the update until the quiz ends', async ({ page }) => {
  await page.goto('/');
  await waitForServiceWorker(page);
  await page.getByTestId('start-mixed').click();
  await answer(page);
  await page.evaluate(() => Object.assign(window, { marker: true }));

  await deployNewVersion(page);
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => 'marker' in window)).toBe(true);
  await expect(page.locator('.progress')).toHaveText('1/10');

  const reloaded = page.waitForEvent('load');
  await page.getByRole('button', { name: 'Beenden' }).click();
  await reloaded;
  await expect(page.getByTestId('start-mixed')).toBeVisible();
  expect(await page.evaluate(() => 'marker' in window)).toBe(false);
});
