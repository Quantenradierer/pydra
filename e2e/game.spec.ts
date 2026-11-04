import { expect, test, type Page } from '@playwright/test';
import { LEVELS } from '../web/src/game/levels.ts';

const level = LEVELS[0]!;
const right = level.choices[level.answerIndex]!.code;
/** The level button lies fully inside the visible part of the strip (up to sub-pixel rounding). */
async function expectInStrip(page: Page, testId: string) {
  await expect
    .poll(async () => {
      const [button, strip] = await Promise.all([page.getByTestId(testId).boundingBox(), page.locator('.level-strip').boundingBox()]);
      return button!.x >= strip!.x - 1 && button!.x + button!.width <= strip!.x + strip!.width + 1;
    })
    .toBe(true);
}

const choice = (page: Page, code: string) => page.locator('.choice').filter({ has: page.getByText(code, { exact: true }) });

test('fills the gap, watches the hydra run it, and never sees the right answer before picking it', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('stats-game')).toHaveText('Noch kein Level gespielt.');
  await page.getByTestId('start-game').click();

  await expect(page.getByRole('heading', { level: 2 })).toHaveText(`Level 1: ${level.title.de}`);
  await expect(page.getByTestId('gap')).toHaveText('___');
  await expect(page.getByTestId('run-position')).toHaveText('Wähle eine Antwort, dann schwimmt die Hydra los.');
  await expect(page.getByTestId('run-step')).toBeDisabled();
  await expect(page.getByTestId('level-2')).toBeDisabled();

  // A wrong answer: the code is filled in and runs step by step like a debugger.
  await choice(page, 'turn_left()').click();
  await page.getByTestId('run-play').click(); // pause
  await expect(page.getByTestId('gap')).toHaveText('turn_left()');
  const before = await page.getByTestId('run-position').textContent();
  await page.getByTestId('run-step').click();
  await expect(page.getByTestId('run-position')).not.toHaveText(before!);
  await expect(page.locator('.program .line.focus')).toHaveCount(1);
  await expect(page.locator('.choice:not([disabled])')).toHaveCount(4); // every answer stays pickable
  await expect(page.locator('.choice.correct, .choice.wrong')).toHaveCount(0);
  await page.getByTestId('run-end').click();
  await expect(page.getByTestId('outcome')).toHaveText('Autsch! In Zeile 4 schwimmt die Hydra gegen die Wand.');
  await expect(page.getByTestId('arena')).toHaveClass(/crashed/);
  await expect(choice(page, 'turn_left()')).toHaveClass(/wrong/);
  await expect(page.getByTestId('feedback')).toContainText('Probier eine andere Antwort.');
  await expect(page.locator('.choice.correct')).toHaveCount(0);

  // Another wrong answer has its own outcome; still nothing reveals the right one.
  await choice(page, 'pass').click();
  await page.getByTestId('run-end').click();
  await expect(page.getByTestId('outcome')).toHaveText('Das Programm ist zu Ende, aber 1 Fisch ist übrig.');
  await expect(page.locator('.choice.wrong')).toHaveCount(2);
  await expect(page.locator('.choice.correct')).toHaveCount(0);
  await expect(page.getByTestId('feedback')).not.toContainText(right);

  // The tried answers survive a reload.
  await page.reload();
  await expect(page.locator('.choice.wrong')).toHaveCount(2);
  await expect(page.locator('.choice.correct')).toHaveCount(0);
  await expect(page.getByTestId('gap')).toHaveText('___');

  // The right answer, picked with the keyboard.
  const slot = await page.locator('.choice').evaluateAll((els, code) => els.findIndex((e) => e.textContent?.includes(code)), right);
  await page.keyboard.press(String(slot + 1));
  await page.getByTestId('run-end').click();
  await expect(page.getByTestId('outcome')).toHaveText('Satt! Die Hydra hat alle Fische gefressen.');
  await expect(choice(page, right)).toHaveClass(/correct/);
  await expect(page.getByTestId('arena')).toHaveClass(/fed/);
  await expect(page.locator('.choice:not([disabled])')).toHaveCount(4);

  // After solving, every answer can still be tried to compare; nothing is un-solved or counted.
  await choice(page, 'move()').click();
  await page.getByTestId('run-end').click();
  await expect(page.getByTestId('outcome')).toHaveText(/Autsch/);
  await expect(choice(page, 'move()')).toHaveClass(/wrong/);
  await expect(choice(page, right)).toHaveClass(/correct/);
  await expect(page.getByTestId('level-1')).toHaveClass(/solved/);
  await choice(page, right).click();
  await page.getByTestId('run-end').click();
  await expect(page.getByTestId('outcome')).toHaveText('Satt! Die Hydra hat alle Fische gefressen.');
  await expect(page.locator('.choice.wrong')).toHaveCount(3);

  await page.getByRole('button', { name: 'Nächstes Level' }).click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(`Level 2: ${LEVELS[1]!.title.de}`);
  await expect(page.getByTestId('level-1')).toHaveClass(/solved/);

  // A solved level can be played again from scratch.
  await page.getByTestId('level-1').click();
  await expect(page.getByTestId('gap')).toHaveText('___');
  await expect(page.locator('.choice.correct, .choice.wrong')).toHaveCount(0);

  await page.getByRole('button', { name: 'Zurück' }).click();
  await expect(page.getByTestId('stats-game')).toHaveText(`1 von ${LEVELS.length} Levels geschafft · 33 % richtig`);
});

test('the hydra speed is a setting: slow by default, saved, and used by the run', async ({ page }) => {
  await page.goto('/#/settings');
  await expect(page.locator('[data-speed="slow"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-speed="fast"]').click();
  await page.reload();
  await expect(page.locator('[data-speed="fast"]')).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/');
  await page.getByTestId('start-game').click();
  await choice(page, 'move()').click();
  await expect(page.getByTestId('outcome')).toBeVisible({ timeout: 6000 });
});

test('on a phone the level buttons stay on one line and the arena stays in view while picking', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/');
  await page.getByTestId('start-game').click();
  const tops = await page.locator('.level-dot').evaluateAll((els) => new Set(els.map((e) => e.getBoundingClientRect().top)).size);
  expect(tops).toBe(1);
  await page.locator('.level-strip').screenshot({ path: 'test-results/game-phone-top.png' });

  // Run an answer, then scroll down to the last one: the arena must still be in view.
  await choice(page, 'turn_left()').click();
  await page.locator('.choice').last().scrollIntoViewIfNeeded();
  const arena = await page.getByTestId('arena').boundingBox();
  const last = await page.locator('.choice').last().boundingBox();
  expect(arena!.y).toBeGreaterThanOrEqual(0);
  expect(arena!.y + arena!.height).toBeLessThanOrEqual(641);
  expect(last!.y + last!.height).toBeLessThanOrEqual(641);
  expect(arena!.width).toBeGreaterThan(300); // the arena fills the width
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(640); // nothing scrolls
  await page.screenshot({ path: 'test-results/game-phone.png' });
});

test('with every level open on a phone, the strip scrolls sideways on one line and keeps the current level in view', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/');
  // All but the last level solved: the last one opens and is the current one.
  const solved = LEVELS.slice(0, -1).map((l) => l.id);
  await page.evaluate((ids) => {
    localStorage.setItem('pydra.v1.game', JSON.stringify({ solved: ids, picks: ids.length, correctPicks: ids.length }));
  }, solved);
  await page.reload();
  await expect(page.getByTestId('stats-game')).toHaveText(`${solved.length} von ${LEVELS.length} Levels geschafft · 100 % richtig`);
  await page.getByTestId('start-game').click();

  const last = LEVELS.at(-1)!;
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(`Level ${LEVELS.length}: ${last.title.de}`);
  const dots = page.locator('.level-dot');
  await expect(dots).toHaveCount(LEVELS.length);
  expect(await dots.evaluateAll((els) => new Set(els.map((e) => e.getBoundingClientRect().top)).size)).toBe(1);
  await expect(page.locator('.level-dot:disabled')).toHaveCount(0);
  // The page itself never scrolls sideways; the strip does, with the current level visible.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  const current = page.getByTestId(`level-${LEVELS.length}`);
  await expect(current).toHaveAttribute('aria-current', 'step');
  await expectInStrip(page, `level-${LEVELS.length}`);

  // The last level is really playable: its right answer solves it and closes the game.
  const right = last.choices[last.answerIndex]!.code;
  await choice(page, right).click();
  await page.getByTestId('run-end').click();
  await expect(page.getByTestId('outcome')).toHaveText('Satt! Die Hydra hat alle Fische gefressen.');
  await expect(page.getByTestId('feedback')).toContainText('Alle Levels geschafft!');

  // An early level, picked from the strip, scrolls into view too.
  await page.getByTestId('level-1').scrollIntoViewIfNeeded();
  await page.getByTestId('level-1').click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(`Level 1: ${LEVELS[0]!.title.de}`);
  await expectInStrip(page, 'level-1');
});

test('every level fits a 360×640 phone: arena, code and all four answers without scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/');
  const tooTall: string[] = [];
  for (const [i, level] of LEVELS.entries()) {
    const solved = LEVELS.slice(0, i).map((l) => l.id);
    await page.evaluate((ids) => {
      localStorage.setItem('pydra.v1.game', JSON.stringify({ solved: ids, picks: 0, correctPicks: 0 }));
    }, solved);
    await page.goto('/#/game');
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(`Level ${i + 1}: ${level.title.de}`);
    const bottoms = await page.locator('.choice').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().bottom));
    const scroll = await page.evaluate(() => document.documentElement.scrollHeight);
    if (Math.max(...bottoms) > 641 || scroll > 640) tooTall.push(`${level.id}: answers end at ${Math.max(...bottoms)}, page ${scroll}`);
  }
  expect(tooTall).toEqual([]);
});
