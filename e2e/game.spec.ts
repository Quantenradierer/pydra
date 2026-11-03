import { expect, test, type Page } from '@playwright/test';
import { LEVELS } from '../web/src/game/levels.ts';

const level = LEVELS[0]!;
const right = level.choices[level.answerIndex]!.code;
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
  await expect(page.locator('.choice:not([disabled])')).toHaveCount(0);
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
  await expect(page.locator('.choice:not([disabled])')).toHaveCount(0);

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
