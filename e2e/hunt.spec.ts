import { expect, test, type Page } from '@playwright/test';
import { HUNT_LEVELS } from '../web/src/game/hunt-levels.ts';

const choice = (page: Page, code: string) => page.locator('.choice').filter({ has: page.getByText(code, { exact: true }) });

test('the warrior gets eaten stepping on a head, then slays the hydra and takes the gold', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('stats-hunt')).toHaveText('Noch kein Level gespielt.');
  await page.getByTestId('start-hunt').click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(`Level 1: ${HUNT_LEVELS[0]!.title.de}`);
  await expect(page.getByTestId('run-position')).toHaveText('Wähle eine Antwort, dann zieht der Krieger los.');

  await choice(page, 'move_north()').click();
  await page.getByTestId('run-end').click();
  await expect(page.getByTestId('outcome')).toHaveText('Autsch! In Zeile 2 läuft der Krieger gegen einen Felsen oder den Rand.');

  await choice(page, 'move_east()').click();
  await page.getByTestId('run-end').click();
  await expect(page.getByTestId('outcome')).toHaveText('Sieg! Alle Hydras sind besiegt, und das Gold ist eingesammelt.');
  await page.getByRole('button', { name: 'Nächstes Level' }).click();

  await expect(page.getByRole('heading', { level: 2 })).toHaveText(`Level 2: ${HUNT_LEVELS[1]!.title.de}`);
  await choice(page, 'pass').click();
  await page.getByTestId('run-end').click();
  await expect(page.getByTestId('outcome')).toHaveText('Happs! In Zeile 3 tritt der Krieger auf den Kopf einer Hydra, und sie frisst ihn.');
  await expect(page.locator('.hunt-arena.eaten')).toHaveCount(1);
  await choice(page, 'attack()').click();
  await page.getByTestId('run-end').click();
  await expect(page.getByTestId('outcome')).toHaveText('Sieg! Alle Hydras sind besiegt, und das Gold ist eingesammelt.');
  await expect(page.locator('.hunt-hydra.slain')).toHaveCount(1);
  await expect(page.locator('.hunt-gold.taken')).toHaveCount(1);

  // Its own progress, apart from the fishing game.
  await page.getByRole('button', { name: 'Zurück' }).click();
  await expect(page.getByTestId('stats-hunt')).toHaveText(`2 von ${HUNT_LEVELS.length} Levels geschafft · 50 % richtig`);
  await expect(page.getByTestId('stats-game')).toHaveText('Noch kein Level gespielt.');
});

test('every hunt level fits a small phone with its answers in view', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/');
  await page.evaluate((ids) => localStorage.setItem('pydra.v1.hunt', JSON.stringify({ solved: ids, picks: 0, correctPicks: 0 })), HUNT_LEVELS.map((l) => l.id));
  for (const [i] of HUNT_LEVELS.entries()) {
    await page.goto('/#/hunt');
    await page.getByTestId(`level-${i + 1}`).click();
    const box = await page.locator('.choices').boundingBox();
    expect(box!.y + box!.height, `level ${i + 1}`).toBeLessThanOrEqual(641);
  }
});
