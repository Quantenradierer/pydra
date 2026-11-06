import { expect, test } from '@playwright/test';
import { answer, dailyCorrectSlot, stored } from './helpers.ts';

const DAY = '2026-11-07';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(`${DAY}T12:00:00`));
});

test('plays the daily challenge with a wrong answer, resumes after a reload, locks the result and pays XP once', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('stats-daily')).toHaveText('Noch nicht gespielt');
  await expect(page.getByTestId('start-daily')).toContainText('Tages-Challenge');
  await page.getByTestId('start-daily').click();

  const kinds = ['trace', 'extend', 'whatif', 'diff', 'requirement'];
  const wrongStep = 2; // step 3 is answered wrong
  for (let i = 0; i < 5; i++) {
    await expect(page.locator('.progress')).toHaveText(`${i + 1}/5`);
    await expect(page.locator('.choice')).toHaveCount(4);
    if (i === 3) {
      await expect(page.getByTestId('diff-a')).toBeVisible();
      await expect(page.getByTestId('diff-b').locator('.line.changed').first()).toBeVisible();
    } else {
      await expect(page.getByTestId(`daily-code-${kinds[i]}`)).toBeVisible();
    }
    if (i === 1) await expect(page.locator('.line.added').first()).toBeVisible();
    if (i === 2) await expect(page.locator('.line.changed').first()).toBeVisible();

    if (i === 2) {
      // Resume: a reload mid-challenge keeps the answers so far.
      await page.reload();
      await expect(page.locator('.progress')).toHaveText('3/5');
      await expect(page.locator('.hydra-head[data-index="0"]')).toHaveAttribute('data-state', 'slashed');
    }
    const right = await dailyCorrectSlot(page);
    const ok = await answer(page, i === wrongStep ? (right + 1) % 4 : right);
    expect(ok).toBe(i !== wrongStep);
    await expect(page.locator('.explanation')).not.toBeEmpty();
    await page.getByRole('button', { name: i === 4 ? 'Fertig' : 'Weiter', exact: true }).click();
  }

  await expect(page.getByTestId('daily-headline')).toHaveText('4 von 5 geschafft');
  await expect(page.getByTestId('daily-share')).toHaveText(`Pydra Daily ${DAY} 🐉🐉🐲🐉🐉 4/5`);
  const total = ((await stored(page, 'points')) as { total: number; awarded: string[] }).total;
  expect(total).toBe(Math.round(90 * 1.1));
  expect(((await stored(page, 'points')) as { awarded: string[] }).awarded).toEqual([`d:${DAY}`]);

  // Copy: the status message appears (clipboard or fallback).
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => undefined);
  await page.getByTestId('daily-copy').click();
  await expect(page.getByTestId('daily-copy-status')).not.toBeEmpty();

  // Home shows the locked state; opening the card shows the result again.
  await page.getByRole('button', { name: 'Zur Startseite' }).click();
  await expect(page.getByTestId('stats-daily')).toHaveText('Heute geschafft: 4/5');
  await page.getByTestId('start-daily').click();
  await expect(page.getByTestId('daily-headline')).toHaveText('4 von 5 geschafft');

  // A practice round gives no XP and does not change the result.
  await page.getByTestId('daily-practice').click();
  for (let i = 0; i < 5; i++) {
    expect(await answer(page, (await dailyCorrectSlot(page) + 1) % 4)).toBe(false);
    await page.getByRole('button', { name: i === 4 ? 'Fertig' : 'Weiter', exact: true }).click();
  }
  await expect(page.getByTestId('daily-headline')).toHaveText('4 von 5 geschafft');
  await expect(page.getByTestId('daily-practice-result')).toContainText('0 von 5');
  expect(((await stored(page, 'points')) as { total: number }).total).toBe(total);
});

test('starts gently: the first days are the intro snippets, the 8th day an easy regular one', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-06T12:00:00'));
  await page.goto('/');
  await page.getByTestId('start-daily').click();
  await expect(page.getByTestId('daily-code-trace')).toContainText('cats = 2');
  expect((await stored(page, 'daily')) as { run: { snippet: string } }).toMatchObject({ run: { snippet: 'intro-01' } });

  const later = await page.context().newPage();
  await later.clock.setFixedTime(new Date('2026-11-13T12:00:00'));
  await later.goto('/');
  await later.getByTestId('start-daily').click();
  await expect(later.locator('.progress')).toHaveText('1/5');
  const run = (await stored(later, 'daily')) as { run: { snippet: string } };
  expect(run.run.snippet).not.toMatch(/^intro-/);
});

test('resumes a running challenge on launch and shows its progress on Home', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('start-daily').click();
  await answer(page, await dailyCorrectSlot(page));
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByTestId('stats-daily')).toHaveText('Läuft: 1/5');
  // Launching the app mid-challenge opens the challenge again, like a quiz.
  await page.reload();
  await expect(page.locator('.progress')).toHaveText('2/5');
});

test('Reset progress wipes the saved challenge', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('start-daily').click();
  await answer(page, await dailyCorrectSlot(page));
  await page.goto('/#/settings');
  await page.getByRole('button', { name: 'Fortschritt zurücksetzen' }).click();
  await page.getByTestId('confirm-reset').click();
  expect(await stored(page, 'daily')).toBeNull();
});

test('works on a phone in English', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 360, height: 640 } });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(`${DAY}T12:00:00`));
  await page.goto('/#/settings');
  await page.locator('[data-lang="en"]').click();
  await page.goto('/');
  await expect(page.getByTestId('stats-daily')).toHaveText('Not played yet');
  await page.getByTestId('start-daily').click();
  await expect(page.getByTestId('daily-code-trace')).toBeVisible();
  const box = (await page.getByTestId('daily-code-trace').boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(360);
  await context.close();
});
