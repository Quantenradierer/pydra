import { expect, test, type Page } from '@playwright/test';
import { HEADS_LEVELS } from '../web/src/game/heads-levels.ts';

const choice = (page: Page, code: string) => page.locator('.choice').filter({ has: page.getByText(code, { exact: true }) });

/** Opens the heads game at a level (1-based), with every level before it solved. */
async function openLevel(page: Page, n: number) {
  await page.goto('/');
  const solved = HEADS_LEVELS.slice(0, n - 1).map((l) => l.id);
  await page.evaluate((ids) => localStorage.setItem('pydra.v1.heads', JSON.stringify({ solved: ids, picks: 0, correctPicks: 0 })), solved);
  await page.goto('/#/heads');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(`Level ${n}: ${HEADS_LEVELS[n - 1]!.title.de}`);
}

test('a call grows a head that runs the function and disappears again; wrong answers fail visibly', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.lessons > li')).toHaveCount(4);
  await expect(page.getByTestId('stats-heads')).toHaveText('Noch kein Level gespielt.');
  await page.getByTestId('start-heads').click();

  await expect(page.getByRole('heading', { level: 2 })).toHaveText(`Level 1: ${HEADS_LEVELS[0]!.title.de}`);
  await expect(page.getByTestId('heads-goal')).toContainText('Hi!');
  await expect(page.getByTestId('head')).toHaveCount(0);
  await expect(page.getByTestId('gap')).toHaveText('___');

  // Without brackets nothing is called: no head, no output.
  await choice(page, 'greet').click();
  await page.getByTestId('run-end').click();
  await expect(page.getByTestId('outcome')).toHaveText('Das Programm ist fertig, aber die Ausgabe passt nicht zum Ziel.');
  await expect(page.locator('.choice.correct')).toHaveCount(0);

  // The right answer, step by step: a head appears for the call, prints, and goes again.
  await choice(page, 'greet()').click();
  await page.getByTestId('run-play').click(); // pause
  await page.getByTestId('run-restart').click();
  await page.getByTestId('run-play').click(); // pause again after the restart
  const heads: number[] = [];
  for (;;) {
    heads.push(await page.getByTestId('head').count());
    if (await page.getByTestId('run-step').isDisabled()) break;
    await page.getByTestId('run-step').click();
  }
  expect(heads).toEqual([0, 0, 1, 0]);
  await expect(page.getByTestId('heads-output')).toHaveText('Hi!');
  await expect(page.getByTestId('outcome')).toHaveText('Geschafft! Das Ergebnis passt genau zum Ziel.');
  await expect(page.getByTestId('heads-board')).toHaveClass(/solved/);
  await expect(choice(page, 'greet()')).toHaveClass(/correct/);
  await expect(page.getByTestId('level-1')).toHaveClass(/solved/);

  await page.getByRole('button', { name: 'Nächstes Level' }).click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(`Level 2: ${HEADS_LEVELS[1]!.title.de}`);
  await page.getByRole('button', { name: 'Zurück' }).click();
  await expect(page.getByTestId('stats-heads')).toHaveText(`1 von ${HEADS_LEVELS.length} Levels geschafft · 50 % richtig`);
  // The fishing game keeps its own progress.
  await expect(page.getByTestId('stats-game')).toHaveText('Noch kein Level gespielt.');
});

test('the head shows its parameter, return hands the value down, and a wrong value is named', async ({ page }) => {
  await openLevel(page, 2);
  await choice(page, '8').click();
  await page.getByTestId('run-play').click(); // pause
  await page.getByTestId('run-restart').click();
  await page.getByTestId('run-play').click();
  // def, the call line, then inside the head.
  await page.getByTestId('run-step').click();
  await page.getByTestId('run-step').click();
  await expect(page.getByTestId('head')).toHaveCount(1);
  await expect(page.getByTestId('head')).toContainText('double(8)');
  await expect(page.getByTestId('head')).toContainText('x = 8');
  await page.getByTestId('run-step').click();
  await expect(page.getByTestId('head')).toHaveCount(0);
  await expect(page.getByTestId('head-return')).toHaveText('double → 16');
  await expect(page.getByTestId('outcome')).toHaveText('Das Programm ist fertig, aber result ist 16 statt 8.');
  await expect(page.getByTestId('heads-board')).toHaveClass(/failed/);
});

test('endless recursion grows heads until Python gives up', async ({ page }) => {
  await openLevel(page, HEADS_LEVELS.findIndex((l) => l.id === 'countdown') + 1);
  await choice(page, 'n + 1').click();
  await page.getByTestId('run-end').click();
  await expect(page.getByTestId('outcome')).toHaveText(/^Zu viele Köpfe!/);
  await expect(page.getByTestId('head')).toHaveCount(3);
  await expect(page.getByTestId('heads-more')).toHaveText(/^\+\d+ Köpfe darunter$/);
  await expect(page.locator('.head-frame.head-error')).toHaveCount(1);
});

test('every heads level fits a 360×640 phone: board, code and all four answers without scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  const tooTall: string[] = [];
  for (const [i, level] of HEADS_LEVELS.entries()) {
    await openLevel(page, i + 1);
    const bottoms = await page.locator('.choice').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().bottom));
    const scroll = await page.evaluate(() => document.documentElement.scrollHeight);
    if (Math.max(...bottoms) > 641 || scroll > 640) tooTall.push(`${level.id}: answers end at ${Math.max(...bottoms)}, page ${scroll}`);
  }
  expect(tooTall).toEqual([]);
});
