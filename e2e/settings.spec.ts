import { expect, test } from '@playwright/test';
import { answer, stored } from './helpers.ts';

test('switches the language and keeps it after a reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
  await expect(page.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByTestId('stats-mixed')).toHaveText("No sessions yet. Let's go!");

  await page.getByTestId('start-mixed').click();
  await page.keyboard.press('1');
  await expect(page.locator('.verdict')).toHaveText(/Head of the class!|Head-scratcher, huh\?/);
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeVisible();
});

test('resets progress after confirming, keeping the language', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByRole('button', { name: 'English' }).click();
  await page.getByRole('button', { name: 'Back' }).click();

  await page.getByTestId('start-mixed').click();
  for (let i = 1; i <= 10; i++) {
    await answer(page);
    await page.getByRole('button', { name: i === 10 ? 'Finish' : 'Next', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Home' }).click();
  await expect(page.getByTestId('stats-mixed')).toContainText('1 session');

  await page.getByRole('button', { name: 'Settings' }).click();
  // Cancelling keeps everything.
  await page.getByRole('button', { name: 'Reset progress' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  expect(await stored(page, 'counters')).not.toBeNull();

  await page.getByRole('button', { name: 'Reset progress' }).click();
  await page.getByTestId('confirm-reset').click();
  await expect(page.getByRole('status')).toHaveText('Progress reset.');
  expect(await stored(page, 'counters')).toBeNull();
  expect(await stored(page, 'questionStats')).toBeNull();
  expect(await stored(page, 'language')).toBe('en');

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByTestId('stats-mixed')).toHaveText("No sessions yet. Let's go!");
});

test('shows the install button only when the browser offers installation', async ({ page }) => {
  await page.goto('/#/settings');
  const install = page.getByRole('button', { name: 'App installieren' });
  await expect(install).toBeHidden();
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, { prompt: async () => undefined, userChoice: Promise.resolve({ outcome: 'accepted' }) });
    dispatchEvent(event);
  });
  await expect(install).toBeVisible();
  await page.evaluate(() => dispatchEvent(new Event('appinstalled')));
  await expect(install).toBeHidden();
});
