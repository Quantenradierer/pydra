import { expect, test, type Page } from '@playwright/test';
import { runFight, openGame } from './helpers.ts';

/** Independent UX review checks: tap targets, clipped text, a primary button that does not jump. */

const SIZES = [
  { name: 'phone', width: 360, height: 740 },
  { name: 'desktop', width: 1280, height: 800 },
] as const;

async function start(page: Page) {
  await page.addInitScript(() => localStorage.setItem('pydra.v1.robot', JSON.stringify({ solved: ['first-contact'], script: 'forward()\nfire()', runs: 1, wins: 1 })));
  await page.goto('/');
  await openGame(page, 'robot');
  await page.getByTestId('robot-step-first-contact').click();
}

/** Visible controls smaller than 44 x 44 px (inside the visible part of any scroll strip). */
const smallTargets = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('main button, main summary, main input:not([type=hidden])')]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && (r.height < 43.5 || r.width < 43.5);
      })
      .map((e) => `${e.dataset.testid ?? e.className ?? e.tagName} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`),
  );

for (const size of SIZES) {
  test(`${size.name}: every control on the task page is at least 44 px, before and after a fight`, async ({ page }) => {
    await page.setViewportSize(size);
    await start(page);
    expect(await smallTargets(page)).toEqual([]);
    await runFight(page);
    await expect(page.getByTestId('robot-outcome')).toBeVisible();
    expect(await smallTargets(page)).toEqual([]);
  });

  test(`${size.name}: the narration is one line and the script box keeps its size after a fight`, async ({ page }) => {
    await page.setViewportSize(size);
    await start(page);
    const box = page.locator('.robot-editor-box');
    const before = (await box.boundingBox())!.height;
    await runFight(page);
    await expect(page.getByTestId('robot-outcome')).toBeVisible();
    const clipped = await page.evaluate(() => {
      const e = document.querySelector<HTMLElement>('.rb-explain .robot-narration');
      return e ? e.scrollHeight - e.clientHeight : 0;
    });
    expect(clipped).toBeLessThanOrEqual(1);
    const listing = (await page.locator('.robot-listing-holder').boundingBox())!.height;
    expect(Math.abs(listing - before)).toBeLessThan(2);
  });
}

test('the run controls incl. the speed button and the equipment button are at least 44 px high', async ({ page }) => {
  await start(page);
  await runFight(page);
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.rb-controlrow button, .rb-primary, .rb-equip')]
      .filter((e) => e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 43.5)
      .map((e) => `${e.dataset.testid ?? e.className} ${Math.round(e.getBoundingClientRect().height)}`),
  );
  expect(small).toEqual([]);
});

test('no filler sentences: the goal is one line, the verdict states only the result, sheets have no instruction paragraph', async ({ page }) => {
  await start(page);
  const main = page.locator('main.robot');
  await expect(main).not.toContainText('Starte den Kampf');
  await expect(page.getByTestId('robot-narration')).toHaveCount(0);
  await runFight(page);
  await expect(page.getByTestId('robot-outcome')).toHaveText(/^Gewonnen!/);
  await expect(main).not.toContainText('Nächste Aufgabe frei');
  await expect(main).not.toContainText('Schritt');
  await page.getByTestId('robot-equipment').click();
  await expect(page.getByTestId('robot-bench')).not.toContainText('Tippe auf');
});
