import { expect, test } from '@playwright/test';
import { stored } from './helpers.ts';

for (const [device, viewport] of [
  ['phone', { width: 360, height: 640 }],
  ['desktop', { width: 1280, height: 800 }],
] as const) {
  test(`on a ${device}: build, code, battle, lose, improve, win and replay`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByTestId('stats-robot')).toHaveText('Noch kein Kampf gespielt.');
    await page.getByTestId('start-robot').click();
    await expect(page.getByTestId('robot-map')).toBeVisible();
    // Only the first battle is open.
    await expect(page.getByTestId('robot-step-one-more-line')).toBeDisabled();

    // First Contact: the code is already there, just press the button (a win in under a minute).
    await page.getByTestId('robot-step-first-contact').click();
    await expect(page.getByTestId('robot-code')).toHaveValue('forward()\nfire()');
    await page.getByTestId('robot-run').click();
    await expect(page.getByTestId('robot-outcome')).toContainText('Gewonnen!');
    await expect(page.getByTestId('robot-stars')).toContainText('★★★');
    // The replay: scrub to the end and see the highlighted line and the log.
    await page.getByTestId('robot-restart').click();
    await page.getByTestId('robot-forward').click();
    await expect(page.locator('.robot-listing li.active')).toHaveCount(1);
    await expect(page.getByTestId('robot-position')).toHaveText('Tick 1 von 2');
    await page.getByTestId('robot-end').click();
    await expect(page.getByTestId('robot-log')).toContainText('schießt und trifft');
    expect(((await stored(page, 'robot')) as { solved: string[] }).solved).toEqual(['first-contact']);

    // One More Line: the same script now loses (the dummy takes 2 hits) ...
    await page.getByTestId('robot-next').click();
    await expect(page.getByTestId('robot-code')).toHaveValue('forward()\nfire()');
    await page.getByTestId('robot-run').click();
    await expect(page.getByTestId('robot-outcome')).toContainText('Verloren');
    await expect(page.getByTestId('robot-layout-1')).toContainText('✗');
    // ... a loss sends the player back to the same script; one more line wins.
    await page.getByTestId('robot-code').fill('forward()\nfire()\nfire()');
    await page.getByTestId('robot-run').click();
    await expect(page.getByTestId('robot-outcome')).toContainText('Gewonnen!');
    await expect(page.getByTestId('robot-history')).toBeAttached();

    // A typo gets a friendly message with the line.
    await page.getByTestId('robot-code').fill('forward()\nfoward()');
    await page.getByTestId('robot-run').click();
    await expect(page.getByTestId('robot-error')).toContainText('Zeile 2: Dein Roboter kennt „foward“ nicht. Meintest du forward()?');

    // The map shows the progress, and the points arrived.
    await page.getByRole('button', { name: 'Zurück', exact: true }).click();
    await expect(page.getByTestId('robot-step-one-more-line')).toContainText('geschafft');
    await expect(page.getByTestId('robot-step-training-dummy')).toBeEnabled();
    await page.getByRole('button', { name: 'Zurück', exact: true }).click();
    await expect(page.getByTestId('stats-robot')).toContainText('2 von 44 Aufgaben geschafft');
    await expect(page.getByTestId('home-level')).toBeVisible();
  });
}

test('a challenge: Line Up, and English texts', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('pydra.v1.language', JSON.stringify('en'));
    const solved = ['first-contact', 'one-more-line', 'training-dummy'];
    localStorage.setItem('pydra.v1.robot', JSON.stringify({ solved, script: 'forward()\nfire()', runs: 3, wins: 3 }));
  });
  await page.reload();
  await page.getByTestId('start-robot').click();
  await expect(page.getByRole('heading', { level: 2 }).first()).toHaveText('Chapter 0: Commands in a row');
  await page.getByTestId('robot-step-lu-first-shot').click();
  await expect(page.getByTestId('robot-lineup')).toBeVisible();
  // Wrong order first.
  await page.getByTestId('robot-check').click();
  await expect(page.getByTestId('robot-feedback')).toHaveText('Not quite yet. Try again.');
  // Sort the lines with the arrow buttons (selection by bubble sort on the visible order).
  const target = ['forward()', 'forward()', 'fire()', 'fire()'];
  for (let pass = 0; pass < 8; pass++) {
    const lines = await page.locator('.robot-lineup code').allTextContents();
    const i = lines.findIndex((l, k) => l !== target[k]);
    if (i < 0) break;
    const j = lines.findIndex((l, k) => k > i && l === target[i]);
    for (let k = j; k > i; k--) await page.getByTestId(`robot-up-${k}`).click();
  }
  await page.getByTestId('robot-check').click();
  await expect(page.getByTestId('robot-feedback')).toHaveText('Right!');
  await page.getByTestId('robot-to-map').click();
  await expect(page.getByTestId('robot-step-lu-first-shot')).toContainText('done');
});

test('the builder: parts unlock with the chapters and decide which commands exist', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('pydra.v1.robot', JSON.stringify({ solved: ['first-contact'], script: 'forward()\nfire()' })));
  await page.goto('/#/');
  await page.reload();
  await page.getByTestId('start-robot').click();
  await page.getByTestId('robot-step-one-more-line').click();
  await page.getByTestId('robot-build').locator('summary').click();
  // Chapter 0: cannon and spider legs are still locked.
  await expect(page.getByTestId('robot-gear-cannon')).toBeDisabled();
  await expect(page.getByTestId('robot-locomotion-legs')).toBeDisabled();
  await expect(page.getByTestId('robot-api')).toContainText('forward(steps)');
  await expect(page.getByTestId('robot-api')).not.toContainText('fire(power)');

  // Chapter 1 unlocks them.
  await page.evaluate(() => {
    const solved = ['first-contact', 'one-more-line', 'training-dummy', 'corner-dummy', 'u-turn', 'twin-dummies', 'wall-dummy', 'obstacle-course', 'hello-robot', 'far-dummy'];
    localStorage.setItem('pydra.v1.robot', JSON.stringify({ solved, script: 'say("Hi")\nforward(4)\nfire(3)' }));
  });
  await page.goto('/#/');
  await page.reload();
  await page.getByTestId('start-robot').click();
  await page.getByTestId('robot-step-armored-dummy').click();
  await page.getByTestId('robot-build').locator('summary').click();
  // Both weapons do not fit next to the eyes on a light chassis: swap the blaster for the cannon.
  await page.getByTestId('robot-gear-cannon').click();
  await expect(page.getByTestId('robot-build-note')).toHaveText('Alle Plätze sind belegt: Nimm erst ein Teil heraus.');
  await expect(page.getByTestId('robot-gear-cannon')).not.toBeChecked();
  await page.getByTestId('robot-gear-blaster').uncheck();
  await page.getByTestId('robot-gear-cannon').check();
  await expect(page.getByTestId('robot-api')).toContainText('fire(power)');
  await page.getByTestId('robot-code').fill('say("Hi")\nforward(4)\nfire(3)\nwait()\nwait()\nfire(3)');
  await page.getByTestId('robot-run').click();
  await expect(page.getByTestId('robot-outcome')).toContainText('Gewonnen!');
  // The old blaster-only code stops at line 1 with a friendly message: the cannon needs a power.
  await page.getByTestId('robot-code').fill('fire()');
  await page.getByTestId('robot-run').click();
  await expect(page.getByTestId('robot-outcome')).toContainText('Das Skript hat in Zeile 1 angehalten: fire() will');
});
