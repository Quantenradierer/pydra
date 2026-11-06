import { expect, test, type Page } from '@playwright/test';
import { PREDICT_LEVELS } from '../web/src/game/predict-levels.ts';

const first = PREDICT_LEVELS[0]!;

/** Types one guess per output line. */
async function typeLines(page: Page, lines: readonly string[]) {
  for (const [i, line] of lines.entries()) await page.getByTestId(`guess-${i + 1}`).fill(line);
}

/** Checks the typed lines and jumps to the end of the run. */
async function check(page: Page) {
  await page.getByTestId('check').click();
  const end = page.getByTestId('run-end');
  if (await end.isEnabled()) await end.click();
}

for (const [device, viewport] of [
  ['phone', { width: 360, height: 640 }],
  ['desktop', { width: 1280, height: 800 }],
] as const) {
  test(`on a ${device}: predicts the output, misses, steps through the run and solves the level`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByTestId('stats-predict')).toHaveText('Noch kein Level gespielt.');
    await page.getByTestId('start-predict').click();
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(`Level 1: ${first.title.de}`);
    await expect(page.getByTestId('run-position')).toHaveText('Noch nicht geprüft.');
    await expect(page.getByTestId('run-step')).toBeDisabled();
    // One head per printed line.
    await expect(page.locator('.hydra-head')).toHaveCount(first.output.length);

    // Empty lines are not checked.
    await page.getByTestId('check').click();
    await expect(page.getByTestId('outcome')).toHaveText('Schreib erst in jede Zeile etwas: Jeder Kopf der Hydra sagt eine Zeile.');
    await expect(page.getByTestId('guess-1')).toBeFocused();

    // A classic beginner mistake: the quotes. The run plays step by step; heads fall or grow back.
    await typeLines(page, ['"Python"', 'Hydra']);
    await page.getByTestId('check').click();
    await page.getByTestId('run-play').click(); // pause
    await page.getByTestId('run-restart').click();
    await page.getByTestId('run-play').click(); // pause again, at the start
    await expect(page.locator('.program .line.focus')).toHaveCount(1);
    await page.getByTestId('run-end').click();
    await expect(page.getByTestId('outcome')).toHaveText('1 von 2 Zeilen stimmen. Für jede falsche wächst ein Kopf nach.');
    await expect(page.getByTestId('feedback')).toContainText('Ausgabezeile 1: print zeigt Text ohne Anführungszeichen.');
    await expect(page.getByTestId('output-1')).toHaveClass(/wrong/);
    await expect(page.getByTestId('output-2')).toHaveClass(/right/);
    await expect(page.locator('.hydra-head[data-state="regrown"]')).toHaveCount(1);
    await expect(page.locator('.hydra-head[data-state="slashed"]')).toHaveCount(1);
    await expect(page.getByTestId('reveal')).toHaveCount(0);

    // Changing a line ends the run shown; the lines survive a reload.
    await page.getByTestId('guess-1').fill('Python');
    await expect(page.getByTestId('feedback')).toBeEmpty();
    await expect(page.locator('.predict-line.wrong, .predict-line.right')).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('guess-1')).toHaveValue('Python');
    await expect(page.getByTestId('guess-2')).toHaveValue('Hydra');

    // Enter in the last line checks.
    await page.getByTestId('guess-2').press('Enter');
    await page.getByTestId('run-end').click();
    await expect(page.getByTestId('outcome')).toHaveText('Köpfchen! Jede Zeile stimmt, und die Hydra hat keinen Kopf mehr.');
    await expect(page.locator('.hydra-head[data-state="slashed"]')).toHaveCount(2);
    await expect(page.getByTestId('level-1')).toHaveClass(/solved/);
    const next = page.getByRole('button', { name: 'Nächstes Level' });
    await next.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await next.click();
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(`Level 2: ${PREDICT_LEVELS[1]!.title.de}`);

    await page.getByRole('button', { name: 'Zurück' }).click();
    await expect(page.getByTestId('stats-predict')).toHaveText(`1 von ${PREDICT_LEVELS.length} Levels geschafft · 50 % richtig`);
    await expect(page.getByTestId('stats-game')).toHaveText('Noch kein Level gespielt.');
  });
}

test('after two misses the output can be shown, and typing it solves the level', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('pydra.v1.gameSpeed', JSON.stringify('fast')));
  await page.goto('/#/predict');
  await typeLines(page, ['x', 'y']);
  await check(page);
  await expect(page.getByTestId('reveal')).toHaveCount(0);
  await check(page);
  await expect(page.getByTestId('outcome')).toHaveText('0 von 2 Zeilen stimmen. Für jede falsche wächst ein Kopf nach.');
  await page.getByTestId('reveal').click();
  await expect(page.getByTestId('revealed')).toContainText(first.output.join('\n'));
  await typeLines(page, first.output);
  await check(page);
  await expect(page.getByTestId('outcome')).toHaveText(/^Köpfchen!/);
});

test('in English, with every level solved, the last level ends the game', async ({ page }) => {
  await page.goto('/');
  const ids = PREDICT_LEVELS.slice(0, -1).map((l) => l.id);
  await page.evaluate((solved) => {
    localStorage.setItem('pydra.v1.language', JSON.stringify('en'));
    localStorage.setItem('pydra.v1.predict', JSON.stringify({ solved, checks: solved.length, rightChecks: solved.length }));
  }, ids);
  await page.goto('/#/predict');
  await page.reload(); // the language is read when the app starts
  const last = PREDICT_LEVELS.at(-1)!;
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(`Level ${PREDICT_LEVELS.length}: ${last.title.en}`);
  await typeLines(page, last.output);
  await check(page);
  await expect(page.getByTestId('outcome')).toHaveText('Head of the class! Every line is right, and the hydra has no heads left.');
  await expect(page.getByTestId('feedback')).toContainText('All levels solved!');
});

test('every predict level fits a small phone: the whole program and the check button in view', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/');
  await page.evaluate((ids) => localStorage.setItem('pydra.v1.predict', JSON.stringify({ solved: ids, checks: 0, rightChecks: 0 })), PREDICT_LEVELS.map((l) => l.id));
  for (const [i] of PREDICT_LEVELS.entries()) {
    await page.goto('/#/predict');
    await page.getByTestId(`level-${i + 1}`).click();
    const button = await page.getByTestId('check').boundingBox();
    expect(button!.y + button!.height, `level ${i + 1}`).toBeLessThanOrEqual(641);
    const program = page.getByTestId('program');
    expect(await program.evaluate((el) => el.scrollHeight - el.clientHeight), `level ${i + 1} program all visible`).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollHeight), `level ${i + 1}`).toBeLessThanOrEqual(640);
  }
});
