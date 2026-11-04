import { expect, test, type Page } from '@playwright/test';
import { ORDER_LEVELS } from '../web/src/game/order-levels.ts';

/** Runs the program and jumps to its end (a run that stops at once has ended already). */
async function run(page: Page) {
  await page.getByTestId('run').click();
  const end = page.getByTestId('run-end');
  if (await end.isEnabled()) await end.click();
}

test('sorts the shuffled lines, runs the program and solves the level', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('stats-order')).toHaveText('Noch kein Programm ausgeführt.');
  await page.getByTestId('start-order').click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(`Level 1: ${ORDER_LEVELS[0]!.title.de}`);
  const lines = page.locator('.order-code');
  await expect(lines).toHaveText(['attack()', 'move_east()', 'move_east()']);

  // As shown, the warrior strikes before he has moved.
  await run(page);
  await expect(page.getByTestId('outcome')).toHaveText('In Zeile 1 schlägt der Krieger ins Leere: Auf seinem Feld ist keine Hydra.');
  await expect(page.getByTestId('feedback')).toContainText('Tipp:');

  // Moving a line ends the run shown, keeps the focus on the moved line, and survives a reload.
  await page.getByTestId('line-1-down').click();
  await expect(page.getByTestId('feedback')).toBeEmpty();
  await expect(page.getByTestId('line-2-down')).toBeFocused();
  await page.getByTestId('line-2-down').click();
  await expect(lines).toHaveText(['move_east()', 'move_east()', 'attack()']);
  await page.reload();
  await expect(lines).toHaveText(['move_east()', 'move_east()', 'attack()']);
  await expect(page.getByTestId('line-1-up')).toBeDisabled();
  await expect(page.getByTestId('line-3-down')).toBeDisabled();

  await run(page);
  await expect(page.getByTestId('outcome')).toHaveText('Sieg! Alle Hydras sind besiegt, und das Gold ist eingesammelt.');
  await expect(page.getByTestId('level-1')).toHaveClass(/solved/);
  await page.getByRole('button', { name: 'Nächstes Level' }).click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(`Level 2: ${ORDER_LEVELS[1]!.title.de}`);

  await page.getByRole('button', { name: 'Zurück' }).click();
  await expect(page.getByTestId('stats-order')).toHaveText(`1 von ${ORDER_LEVELS.length} Levels geschafft · 2 Läufe`);
});

test('a line in the wrong place can be a Python IndentationError', async ({ page }) => {
  await page.goto('/');
  const ids = ORDER_LEVELS.slice(0, 3).map((l) => l.id);
  await page.evaluate((solved) => localStorage.setItem('pydra.v1.order', JSON.stringify({ solved, runs: 3, wins: 3 })), ids);
  await page.goto('/#/order');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(`Level 4: ${ORDER_LEVELS[3]!.title.de}`);
  await run(page);
  await expect(page.getByTestId('outcome')).toHaveText('Python bricht in Zeile 1 ab: IndentationError: unexpected indent');
});

test('every code puzzle level fits a small phone with its run button in view', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/');
  await page.evaluate((ids) => localStorage.setItem('pydra.v1.order', JSON.stringify({ solved: ids, runs: 0, wins: 0 })), ORDER_LEVELS.map((l) => l.id));
  for (const [i] of ORDER_LEVELS.entries()) {
    await page.goto('/#/order');
    await page.getByTestId(`level-${i + 1}`).click();
    const button = await page.getByTestId('run').boundingBox();
    expect(button!.y + button!.height, `level ${i + 1}`).toBeLessThanOrEqual(641);
    const list = page.getByTestId('lines');
    expect(await list.evaluate((el) => el.scrollHeight - el.clientHeight), `level ${i + 1} lines all visible`).toBeLessThanOrEqual(1);
  }
});
