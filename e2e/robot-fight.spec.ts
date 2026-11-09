import { expect, test, type Page } from '@playwright/test';
import { startFight } from './helpers.ts';

/** The fight is played, slowly, on the arena; the verdict only comes when it is over. And nothing on the task page is decoration. */

async function openTask(page: Page, step = 'first-contact', script = 'forward()\nfire()', solved: string[] = []) {
  await page.goto('/');
  await page.evaluate(([code, solved]) => localStorage.setItem('pydra.v1.robot', JSON.stringify({ solved, script: code, runs: 0, wins: 0 })), [script, solved] as const);
  await page.reload();
  await page.getByTestId('start-robot').click();
  await page.getByTestId(`robot-step-${step}`).click();
}

/** What a player sees changing during a fight: where the robots are, which line lights up, the step counter. */
const sample = (page: Page) =>
  page.evaluate(() => ({
    robots: [...document.querySelectorAll<HTMLElement>('.rb-unit')].map((u) => `${u.dataset.robot}:${u.style.left},${u.style.top}`).join(' '),
    line: document.querySelector('.robot-listing li.active')?.getAttribute('data-line') ?? '',
    where: document.querySelector('[data-testid="robot-where"]')?.textContent ?? '',
    hint: [...document.querySelectorAll('.robot-listing .robot-note-inline')].map((e) => e.textContent).join('|'),
    verdict: document.querySelector('[data-testid="robot-outcome"]') !== null && !document.querySelector('[data-testid="robot-result"]')!.hasAttribute('hidden'),
  }));

test('pressing "Kampf starten" plays the fight slowly: robots move, the line lights up, the verdict comes last', async ({ page }) => {
  await openTask(page, 'first-contact', 'forward()\nforward()\nfire()\nfire()');
  const before = await sample(page);
  const t0 = Date.now();
  await startFight(page);
  // Right after the click: the fight is running, no verdict, "Zum Ergebnis" instead of a result button.
  await expect(page.getByTestId('robot-play')).toHaveAttribute('aria-label', 'Pause');
  expect((await sample(page)).verdict).toBe(false);
  await expect(page.getByTestId('robot-skip')).toBeVisible();
  const samples = [await sample(page)];
  while (Date.now() - t0 < 5200) {
    await page.waitForTimeout(700);
    samples.push(await sample(page));
  }
  // Several different states in a row, not one jump: positions and the highlighted line change over time.
  expect(new Set(samples.map((s) => s.robots)).size).toBeGreaterThanOrEqual(3);
  expect(new Set(samples.map((s) => s.line)).size).toBeGreaterThanOrEqual(3);
  expect(new Set(samples.map((s) => s.where)).size).toBeGreaterThanOrEqual(5);
  expect(samples[0]!.robots).toBe(before.robots);
  // The verdict is hidden while it plays (the first samples) ...
  expect(samples.slice(0, 4).every((s) => !s.verdict)).toBe(true);
  // ... and appears on its own after the last step, together with the points and the "next" button.
  await expect(page.getByTestId('robot-outcome')).toContainText('Gewonnen!', { timeout: 20_000 });
  await expect(page.getByTestId('robot-next')).toBeVisible();
  // At about one step per second: 8 steps (4 lines + 4 rounds) took several seconds, not an instant.
  expect(Date.now() - t0).toBeGreaterThan(4000);
});

test('pause, one step and the speed button work while the fight is on; skipping shows the verdict at once', async ({ page }) => {
  await openTask(page);
  await startFight(page);
  await page.getByTestId('robot-play').click(); // pause
  await expect(page.getByTestId('robot-play')).toHaveAttribute('aria-label', 'Abspielen');
  const paused = await sample(page);
  await page.waitForTimeout(1800);
  expect(await sample(page)).toEqual(paused);
  await page.getByTestId('robot-step').click();
  expect((await sample(page)).where).not.toBe(paused.where);
  await expect(page.getByTestId('robot-outcome')).toBeHidden();
  await page.getByTestId('robot-speed').click();
  await expect(page.getByTestId('robot-speed')).toHaveText('⏱ schnell');
  await page.getByTestId('robot-skip').click();
  await expect(page.getByTestId('robot-outcome')).toBeVisible();
});

test('the points toast of a first win only comes with the verdict', async ({ page }) => {
  await openTask(page);
  await startFight(page);
  await page.waitForTimeout(1500);
  await expect(page.locator('.toast, [role="status"]:has-text("XP")')).toHaveCount(0);
  await page.getByTestId('robot-skip').click();
  await expect(page.getByText(/\+\d+ XP/)).toBeVisible();
});

test('nothing on the task page is decoration: no share, no automatic menu, no pictures row, the title is a task sentence', async ({ page }) => {
  for (const [lang, goal] of [['de', 'Ziel: Zerstöre den Gegner'], ['en', 'Goal: destroy the enemy']] as const) {
    await page.goto('/');
    await page.evaluate((l) => localStorage.setItem('pydra.v1.language', JSON.stringify(l)), lang);
    await openTask(page);
    await expect(page.getByTestId('robot-catch')).toContainText(goal);
    await expect(page.getByTestId('robot-catch')).not.toContainText(/Erster Kontakt|First Contact/);
    await expect(page.locator('.rb-vs, .rb-pictures, .robot-foes')).toHaveCount(0);
    await startFight(page);
    await page.getByTestId('robot-skip').click();
    await expect(page.getByTestId('robot-outcome')).toBeVisible();
    const text = (await page.locator('main.robot').innerText()).toLowerCase();
    for (const word of ['teilen', 'share', 'automatisch', 'automatic', 'continue automatically', 'teile']) expect(text, word).not.toContain(word);
    await expect(page.locator('main.robot [data-testid*="share"], main.robot [aria-label*="hare"], main.robot [aria-label*="eilen"]')).toHaveCount(0);
  }
});

test('a lost fight whose script ended does not play 200 empty rounds: the waiting is one step, the verdict comes in seconds', async ({ page }) => {
  await openTask(page, 'one-more-line', 'forward()\nfire()', ['first-contact']);
  const t0 = Date.now();
  await startFight(page);
  await expect(page.getByTestId('robot-outcome')).toContainText('Verloren', { timeout: 15_000 });
  expect(Date.now() - t0).toBeLessThan(12_000);
  await expect(page.getByTestId('robot-narration')).toContainText('Dein Skript ist zu Ende');
});

test('on a phone the verdict and the next button are scrolled into view when the fight ends', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await openTask(page, 'first-contact', 'forward()\nforward()\nfire()\nfire()');
  await startFight(page);
  await expect(page.getByTestId('robot-outcome')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('robot-next')).toBeInViewport({ ratio: 0.9 });
  await expect(page.getByTestId('robot-outcome')).toBeInViewport({ ratio: 0.9 });
});

test('a bug hunt always has its bug: a script that does not win gets the prepared buggy script, a fix in progress stays', async ({ page }) => {
  await openTask(page, 'one-more-line', '', ['first-contact', 'one-more-line']);
  await page.getByTestId('level-3').click();
  await expect(page.getByTestId('robot-code')).toHaveValue('foward()\nfire()\nfire()');
  await page.getByTestId('robot-code').fill('foward()\nfire()\nfire()\nsay("x")');
  await page.getByTestId('level-2').click();
  await page.getByTestId('level-3').click();
  await expect(page.getByTestId('robot-code')).toHaveValue('foward()\nfire()\nfire()\nsay("x")');
});
