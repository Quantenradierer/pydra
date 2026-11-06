import { expect, test } from '@playwright/test';
import { answer, correctSlot, stored } from './helpers.ts';

test('plays a spot-the-difference session with two snippets per question', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('stats-diff')).toHaveText('Noch keine Runde gespielt. Leg los!');
  await expect(page.getByTestId('start-diff')).toContainText('Finde den Unterschied');
  await page.getByTestId('start-diff').click();

  const session = (await stored(page, 'session')) as { lesson: string; items: { id: string }[] };
  expect(session.lesson).toBe('diff');
  expect(new Set(session.items.map((i) => i.id)).size).toBe(10);
  expect(session.items.every((i) => i.id.startsWith('diff-'))).toBe(true);

  let score = 0;
  for (let i = 1; i <= 10; i++) {
    await expect(page.locator('.progress')).toHaveText(`${i}/10`);
    // Both versions, labelled, with at least one tinted changed line each.
    await expect(page.getByTestId('diff-a')).toContainText('Version A (Original)');
    await expect(page.getByTestId('diff-b')).toContainText('Version B (geändert)');
    await expect(page.getByTestId('diff-a').locator('pre.code')).toBeVisible();
    await expect(page.getByTestId('diff-b').locator('.line.changed').first()).toBeVisible();
    await expect(page.locator('.choice')).toHaveCount(4);

    // Right answers except on question 3; the question after a reload keeps both snippets.
    if (i === 3) {
      const right = await correctSlot(page);
      expect(await answer(page, (right + 1) % 4)).toBe(false);
      await expect(page.locator('.verdict')).toHaveText('Kopf hoch!');
      await expect(page.locator(`.hydra-head[data-index="2"]`)).toHaveAttribute('data-state', 'regrown');
      await page.reload();
      await expect(page.getByTestId('diff-b')).toBeVisible();
      await expect(page.getByTestId('feedback')).toBeVisible();
    } else {
      expect(await answer(page, await correctSlot(page))).toBe(true);
      score++;
      await expect(page.locator('.verdict')).toHaveText('Köpfchen!');
      await expect(page.locator(`.hydra-head[data-index="${i - 1}"]`)).toHaveAttribute('data-state', 'slashed');
    }
    await expect(page.locator('.explanation')).not.toBeEmpty();
    await page.getByRole('button', { name: i === 10 ? 'Fertig' : 'Weiter', exact: true }).click();
  }

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('9 von 10 Köpfen erlegt');
  expect(score).toBe(9);
  expect(await stored(page, 'counters.diff')).toEqual({ sessionsPlayed: 1, bestScore: 9, totalAnswers: 10, totalCorrect: 9 });
  expect(await stored(page, 'counters')).toBeNull();
  expect(await stored(page, 'lastResult')).toEqual({ lesson: 'diff', score: 9, total: 10 });

  // Play again starts another diff session; the answers paid XP.
  await page.getByRole('button', { name: 'Nochmal spielen' }).click();
  expect(((await stored(page, 'session')) as { lesson: string }).lesson).toBe('diff');
  await page.getByRole('button', { name: 'Beenden' }).click();
  await expect(page.getByTestId('stats-diff')).toHaveText('1 Runde · Bestwert 9/10 · 90 % richtig');
  await expect(page.getByTestId('stats-mixed')).toHaveText('Noch keine Runde gespielt. Leg los!');
  await expect(page.getByTestId('home-level')).toBeVisible();
  expect(((await stored(page, 'points')) as { total: number }).total).toBeGreaterThanOrEqual(90);
});

test('shows the two versions side by side on desktop and stacked on a phone', async ({ browser, baseURL }) => {
  const sizes = async (width: number, height: number) => {
    const context = await browser.newContext({ baseURL, viewport: { width, height } });
    const page = await context.newPage();
    await page.goto('/');
    await page.getByTestId('start-diff').click();
    const a = (await page.getByTestId('diff-a').boundingBox())!;
    const b = (await page.getByTestId('diff-b').boundingBox())!;
    await context.close();
    return { a, b };
  };

  const desktop = await sizes(1000, 800);
  expect(desktop.b.x).toBeGreaterThan(desktop.a.x + desktop.a.width - 2);
  expect(Math.abs(desktop.b.y - desktop.a.y)).toBeLessThan(2);

  const phone = await sizes(360, 640);
  expect(phone.b.y).toBeGreaterThan(phone.a.y + phone.a.height - 2);
  expect(phone.a.x + phone.a.width).toBeLessThanOrEqual(360);
  expect(phone.b.x + phone.b.width).toBeLessThanOrEqual(360);
});
