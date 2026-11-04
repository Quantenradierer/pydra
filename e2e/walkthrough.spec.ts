import { expect, test } from '@playwright/test';
import { correctSlot, stored } from './helpers.ts';

test('reads a function line by line, then asks about the whole function', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('stats-functions')).toHaveText('Noch keine Funktion gelesen.');
  await page.getByTestId('start-functions').click();

  const total = ((await stored(page, 'session')) as { items: unknown[] }).items.length;
  const lines = await page.locator('pre.code .line').count();
  expect(total).toBe(lines + 1);
  await expect(page.locator('.hydra-head')).toHaveCount(total);
  await expect(page.locator('.topic')).toHaveText('Funktionen lesen');
  const code = await page.locator('pre.code').textContent();

  for (let i = 1; i <= total; i++) {
    await expect(page.locator('.progress')).toHaveText(`${i}/${total}`);
    if (i <= lines) {
      // The line asked about is marked, and named in the prompt.
      await expect(page.locator('.prompt')).toHaveText(`Was macht die markierte Zeile ${i}?`);
      await expect(page.locator('.line.focus')).toHaveCount(1);
      await expect(page.locator('.line').nth(i - 1)).toHaveClass(/focus/);
    } else {
      await expect(page.locator('.prompt')).toHaveText('Was macht die ganze Funktion?');
      await expect(page.locator('.line.focus')).toHaveCount(0);
    }
    // Right answers except on line 2.
    const right = await correctSlot(page);
    await page.locator('.choice').nth(i === 2 ? (right + 1) % 4 : right).click();
    await expect(page.locator('.verdict')).toHaveText(i === 2 ? 'Kopf hoch!' : 'Köpfchen!');
    await expect(page.locator('.explanation')).not.toBeEmpty();
    await expect(page.locator(`.hydra-head[data-index="${i - 1}"]`)).toHaveAttribute('data-state', i === 2 ? 'regrown' : 'slashed');

    // Resumes the walkthrough on the same step after a reload.
    if (i === 2) {
      await page.reload();
      await expect(page.locator('.progress')).toHaveText(`2/${total}`);
      await expect(page.locator('.line').nth(1)).toHaveClass(/focus/);
      await expect(page.getByTestId('feedback')).toBeVisible();
    }
    await page.getByRole('button', { name: i === total ? 'Fertig' : 'Weiter', exact: true }).click();
  }

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${total - 1} von ${total} Köpfen erlegt`);
  expect(await stored(page, 'counters.functions')).toEqual({
    sessionsPlayed: 1,
    bestScore: total - 1,
    totalAnswers: total,
    totalCorrect: total - 1,
  });
  expect(await stored(page, 'counters')).toBeNull();

  // Play again starts the next function.
  expect(await stored(page, 'lastResult')).toMatchObject({ lesson: 'functions', total });
  await page.getByRole('button', { name: 'Nochmal spielen' }).click();
  await expect(page.locator('.progress')).toHaveText(/^1\//);
  expect(await page.locator('pre.code').textContent()).not.toBe(code);

  await page.getByRole('button', { name: 'Beenden' }).click();
  const percent = Math.round((100 * (total - 1)) / total);
  await expect(page.getByTestId('stats-functions')).toHaveText(`1 von 6 Funktionen gelesen · ${percent} % richtig`);
  await expect(page.getByTestId('stats-mixed')).toHaveText('Noch keine Runde gespielt. Leg los!');
});
