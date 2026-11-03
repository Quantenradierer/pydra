import { expect, test, type Page } from '@playwright/test';
import { answer, correctSlot, stored } from './helpers.ts';

const head = (page: Page, index: number) => page.locator(`.hydra-head[data-index="${index}"]`);

/** The summary hydra shows `score` slashed heads and the others regrown. */
async function expectSummaryHydra(page: Page, score: number) {
  await expect(page.locator('.hydra-head[data-state="slashed"]')).toHaveCount(score);
  await expect(page.locator('.hydra-head[data-state="regrown"]')).toHaveCount(10 - score);
}

test('plays a full session with feedback and a summary', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.getByTestId('stats-mixed')).toHaveText('Noch keine Runde gespielt. Leg los!');
  await page.getByTestId('start-mixed').click();

  let score = 0;
  for (let i = 1; i <= 10; i++) {
    await expect(page.locator('.progress')).toHaveText(`${i}/10`);
    await expect(page.locator('.choice')).toHaveCount(4);
    const correct = await answer(page, (i - 1) % 4);
    if (correct) score++;
    // Locked, marked with colour and an icon, explained.
    await expect(page.locator('.choice:disabled')).toHaveCount(4);
    await expect(page.locator('.choice.correct .mark svg')).toHaveCount(1);
    await expect(page.locator('.choice.wrong .mark svg')).toHaveCount(correct ? 0 : 1);
    await expect(page.locator('.verdict')).toHaveText(correct ? 'Köpfchen!' : 'Kopf hoch!');
    await expect(page.locator('.explanation')).not.toBeEmpty();
    await expect(page.getByTestId('feedback')).toBeFocused();
    await expect(head(page, i - 1)).toHaveAttribute('data-state', correct ? 'slashed' : 'regrown');
    await page.getByRole('button', { name: i === 10 ? 'Fertig' : 'Weiter', exact: true }).click();
  }

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${score} von 10 Köpfen erlegt`);
  await expectSummaryHydra(page, score);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${score} von 10 Köpfen erlegt`);
  await expectSummaryHydra(page, score);
  expect(await stored(page, 'counters')).toEqual({
    sessionsPlayed: 1,
    bestScore: score,
    totalAnswers: 10,
    totalCorrect: score,
  });
  expect(Object.keys((await stored(page, 'questionStats')) as object)).toHaveLength(10);

  await page.getByRole('button', { name: 'Zur Startseite' }).click();
  await expect(page.getByTestId('stats-mixed')).toHaveText(`1 Runde · Bestwert ${score}/10 · ${score * 10} % richtig`);

  await page.getByTestId('start-mixed').click();
  await expect(page.locator('.progress')).toHaveText('1/10');
});

test('slashes the head of a right answer, regrows a wrong one, and restores both after a reload', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('start-mixed').click();
  await expect(page.locator('.hydra-head')).toHaveCount(10);
  await expect(head(page, 0)).toHaveAttribute('data-state', 'active');
  await expect(head(page, 1)).toHaveAttribute('data-state', 'idle');

  await page.locator('.choice').nth(await correctSlot(page)).click();
  await expect(head(page, 0)).toHaveAttribute('data-state', 'slashed');
  await expect(head(page, 0)).toHaveClass(/hydra-strike/);
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await expect(head(page, 1)).toHaveAttribute('data-state', 'active');

  await page.locator('.choice').nth(((await correctSlot(page)) + 1) % 4).click();
  await expect(head(page, 1)).toHaveAttribute('data-state', 'regrown');
  await expect(head(page, 1)).toHaveClass(/hydra-strike/);

  // Resumed with the feedback showing: the same heads, without replaying the animation.
  await page.reload();
  await expect(page.getByTestId('feedback')).toBeVisible();
  await expect(head(page, 0)).toHaveAttribute('data-state', 'slashed');
  await expect(head(page, 1)).toHaveAttribute('data-state', 'regrown');
  await expect(head(page, 2)).toHaveAttribute('data-state', 'idle');
  await expect(page.locator('.hydra-strike')).toHaveCount(0);
});

test('plays again from the summary', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('start-mixed').click();
  for (let i = 1; i <= 10; i++) {
    await page.keyboard.press('1');
    await page.keyboard.press('Enter');
  }
  await expect(page.getByRole('heading', { level: 1 })).toContainText('von 10 Köpfen erlegt');
  await page.getByRole('button', { name: 'Nochmal spielen' }).click();
  await expect(page.locator('.progress')).toHaveText('1/10');
});

test('answers with keys 1-4 and continues with Enter or Space', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('start-mixed').click();
  await page.keyboard.press('3');
  const picked = page.locator('.choice').nth(2);
  await expect(picked).toHaveClass(/correct|wrong/);
  const marks = await page.locator('.choice').evaluateAll((els) => els.map((e) => e.className));
  // Further number keys do not change the answer.
  await page.keyboard.press('1');
  expect(await page.locator('.choice').evaluateAll((els) => els.map((e) => e.className))).toEqual(marks);
  await page.keyboard.press('Enter');
  await expect(page.locator('.progress')).toHaveText('2/10');
  await expect(page.getByTestId('feedback')).toBeHidden();

  // Keys do nothing before answering except picking.
  await page.keyboard.press('Enter');
  await expect(page.locator('.progress')).toHaveText('2/10');
  await page.keyboard.press('4');
  await expect(page.getByTestId('feedback')).toBeVisible();
  await page.keyboard.press(' ');
  await expect(page.locator('.progress')).toHaveText('3/10');
});

test('quits without confirmation and keeps the stats of answered questions', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('start-mixed').click();
  await answer(page);
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await answer(page);
  await page.getByRole('button', { name: 'Beenden' }).click();

  await expect(page.getByTestId('start-mixed')).toBeVisible();
  expect(await stored(page, 'session')).toBeNull();
  expect(await stored(page, 'counters')).toMatchObject({ sessionsPlayed: 0, totalAnswers: 2 });

  await page.reload();
  await expect(page.getByTestId('start-mixed')).toBeVisible();
});

test('resumes a session after a reload, on the same screen', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('start-mixed').click();
  await answer(page);
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await answer(page);
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();

  // Mid-question: resumes unanswered.
  const prompt = await page.locator('.prompt').textContent();
  const choices = await page.locator('.choice .text').allTextContents();
  await page.reload();
  await expect(page.locator('.progress')).toHaveText('3/10');
  await expect(page.locator('.prompt')).toHaveText(prompt!);
  expect(await page.locator('.choice .text').allTextContents()).toEqual(choices);
  await expect(page.getByTestId('feedback')).toBeHidden();

  // With the feedback showing: resumes with the feedback.
  await answer(page, 2);
  const marked = await page.locator('.choice').evaluateAll((els) => els.map((e) => e.className));
  await page.goto('/');
  await expect(page.locator('.progress')).toHaveText('3/10');
  await expect(page.getByTestId('feedback')).toBeVisible();
  await expect(page.locator('.explanation')).not.toBeEmpty();
  expect(await page.locator('.choice').evaluateAll((els) => els.map((e) => e.className))).toEqual(marked);
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await expect(page.locator('.progress')).toHaveText('4/10');
});

test('discards a saved session that refers to an unknown question', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('start-mixed').click();
  await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem('pydra.v1.session')!);
    session.items[0].id = 'removed-01';
    localStorage.setItem('pydra.v1.session', JSON.stringify(session));
  });
  await page.reload();
  await expect(page.getByTestId('start-mixed')).toBeVisible();
  expect(await stored(page, 'session')).toBeNull();
});

test('highlights code snippets', async ({ page }) => {
  await page.goto('/');
  // Retry sessions until one shows a snippet (most questions have one).
  for (let attempt = 0; attempt < 10; attempt++) {
    await page.getByTestId('start-mixed').click();
    if (await page.locator('pre code.hljs').count()) break;
    await page.getByRole('button', { name: 'Beenden' }).click();
  }
  await expect(page.locator('pre code.hljs').locator('[class^=hljs-]').first()).toBeVisible();
});
