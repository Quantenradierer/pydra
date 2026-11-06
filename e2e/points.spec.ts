import { expect, test } from '@playwright/test';
import { answer, correctSlot, stored } from './helpers.ts';

test('earns XP for right answers, shows tasks and achievements, and keeps the player name', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('home-level')).toHaveText('Level 1 · Hydra-Ei');

  // A right answer pays out and shows a toast.
  await page.getByTestId('start-mixed').click();
  expect(await answer(page, await correctSlot(page))).toBe(true);
  await expect(page.locator('.toast').first()).toContainText('+11 XP');
  await expect(page.locator('.toast').first()).toContainText('Neue Auszeichnung: Erste Schuppe');
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();

  // A wrong answer pays nothing.
  const before = ((await stored(page, 'points')) as { total: number }).total;
  const right = await correctSlot(page);
  await answer(page, right === 0 ? 1 : 0);
  expect(((await stored(page, 'points')) as { total: number }).total).toBe(before);

  // Leaving the round keeps the points; they show on Home and on the profile.
  await page.getByRole('button', { name: 'Beenden' }).click();
  await page.getByTestId('open-profile').click();
  await expect(page.getByTestId('profile-total')).toHaveText(`${before} XP insgesamt`);
  await expect(page.getByTestId('task-quiz')).toContainText('1/5');
  await expect(page.getByTestId('ach-first-answer')).toHaveClass(/earned/);
  await expect(page.getByTestId('ach-count')).toHaveText('1 von 24 erreicht');
  await expect(page.getByTestId('ach-streak-30')).not.toHaveClass(/earned/);

  // The name is saved on this device and survives a reload and a progress reset.
  await page.getByTestId('player-name').fill('  Ada  ');
  await page.getByTestId('save-name').click();
  await expect(page.getByTestId('greeting')).toHaveText('Hallo, Ada!');
  await page.reload();
  await expect(page.getByTestId('player-name')).toHaveValue('Ada');
  await page.goto('/#/settings');
  await page.getByRole('button', { name: 'Fortschritt zurücksetzen' }).click();
  await page.getByTestId('confirm-reset').click();
  await page.goto('/#/');
  await page.reload();
  await expect(page.locator('.profile-chip strong')).toHaveText('Ada');
  await expect(page.getByTestId('home-level')).toHaveText('Level 1 · Hydra-Ei');
  await expect(page.locator('.chip-xp')).toHaveText('0 XP');
});

test('shows the profile in English', async ({ page }) => {
  await page.goto('/#/settings');
  await page.locator('[data-lang="en"]').click();
  await page.goto('/#/profile');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Profile');
  await expect(page.getByTestId('profile-level')).toHaveText('Level 1 · Hydra Egg');
  await expect(page.getByTestId('ach-count')).toHaveText('0 of 24 earned');
});
