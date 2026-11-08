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
    await expect(page.getByTestId('stats-robot')).toContainText(/^2 von \d+ Aufgaben geschafft/);
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

const BEFORE_CHAPTER_3 = [
  'first-contact', 'one-more-line', 'training-dummy', 'corner-dummy', 'u-turn', 'twin-dummies', 'wall-dummy', 'obstacle-course',
  'hello-robot', 'far-dummy', 'armored-dummy', 'counter', 'sign-dummy', 'math-dummy', 'twin-armor', 'name-tag', 'calibrator',
  'tank-dummy', 'dummy-row', 'step-counter', 'after-the-loop', 'double-loop', 'dummy-army',
  'pg1-a', 'pg1-b', 'pg1-c', 'pg1-d', 'pg1-e', 'drill-sergeant',
];
const CHAPTER_3 = ['peekaboo', 'three-way', 'bubble', 'charger', 'gatekeeper'];
const SHIELD_BUILD = { chassis: 'medium', locomotion: 'wheels', gear: ['blaster', 'eyes', 'shield'], addons: ['wide', 'scanner'], blasterMark: 1 };

const LOOK = (inner: string) =>
  `for i in range(30):\n    if see_right() == "enemy":\n        turn_right()\n    elif see_left() == "enemy":\n        turn_left()\n    elif see() == "enemy":\n${inner}`;
const BUBBLE = LOOK('        if enemy_shielded():\n            wait()\n        else:\n            fire()');
const GATEKEEPER = LOOK('        if enemy_shielded():\n            shield.activate()\n        else:\n            fire()');
const MAZE = 'while alive():\n    if see() == "enemy":\n        fire()\n    elif see() == "wall" and distance() == 1:\n        turn_right()\n    else:\n        forward()';
const FINAL =
  'while alive():\n    if see() == "enemy":\n        if enemy_shielded():\n            shield.activate()\n        else:\n            fire()\n    elif see_left() == "enemy":\n        turn_left()\n    elif see_right() == "enemy":\n        turn_right()\n    elif see() == "wall" and distance() == 1:\n        turn_right()\n    else:\n        forward()';

async function preset(page: import('@playwright/test').Page, solved: string[], script: string, build: object = SHIELD_BUILD) {
  await page.evaluate(([s, sc, b]) => localStorage.setItem('pydra.v1.robot', JSON.stringify({ solved: s, script: sc, build: b, runs: 40, wins: 40 })), [solved, script, build] as const);
  await page.goto('/#/');
  await page.reload();
  await page.getByTestId('start-robot').click();
}

async function win(page: import('@playwright/test').Page, id: string, script: string) {
  await page.getByTestId(`robot-step-${id}`).click();
  await page.getByTestId('robot-code').fill(script);
  await page.getByTestId('robot-run').click();
  await expect(page.getByTestId('robot-outcome')).toContainText('Gewonnen!');
}

test('Chapter 3: the concept card, if / elif decisions and the shield boss', async ({ page }) => {
  await page.goto('/');
  await preset(page, BEFORE_CHAPTER_3, 'forward(4)\nfire()');
  await page.getByTestId('robot-step-peekaboo').click();
  // The chapter's concept card is open until it is read, and parts show their own cards.
  await expect(page.getByTestId('robot-card-ch3')).toHaveAttribute('open', '');
  await expect(page.getByTestId('robot-card-part-hammer')).toBeVisible();
  await page.getByTestId('robot-card-gotit-ch3').click();
  await expect(page.getByTestId('robot-card-ch3')).not.toHaveAttribute('open', '');
  expect(((await stored(page, 'robot')) as { cards: string[] }).cards).toEqual(['ch3']);

  // Old code loses a layout (the dummy is on the right sometimes) ...
  await page.getByTestId('robot-code').fill('fire()\nfire()');
  await page.getByTestId('robot-run').click();
  await expect(page.getByTestId('robot-outcome')).toContainText('Verloren');
  // ... an if / else wins, and Three-Way and Bubble follow the same script.
  await page.getByTestId('robot-code').fill('if see() == "enemy":\n    fire()\n    fire()\nelse:\n    turn_right()\n    fire()\n    fire()');
  await page.getByTestId('robot-run').click();
  await expect(page.getByTestId('robot-outcome')).toContainText('Gewonnen!');
  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  await win(page, 'three-way', 'if see_right() == "enemy":\n    turn_right()\nelif see_left() == "enemy":\n    turn_left()\nfire()\nfire()');
  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  // Bubble: blind shooting wastes shots on the shield and is refused with a reason ...
  await page.getByTestId('robot-step-bubble').click();
  await page.getByTestId('robot-code').fill(LOOK('        fire()'));
  await page.getByTestId('robot-run').click();
  await expect(page.getByTestId('robot-outcome')).toContainText('Schild geschossen');
  await page.getByTestId('robot-code').fill(BUBBLE);
  await page.getByTestId('robot-run').click();
  await expect(page.getByTestId('robot-outcome')).toContainText('Gewonnen!');

  // Gatekeeper (boss): waiting costs too much health, the own shield wins.
  await page.evaluate(([s]) => {
    const p = JSON.parse(localStorage.getItem('pydra.v1.robot')!);
    localStorage.setItem('pydra.v1.robot', JSON.stringify({ ...p, solved: s }));
  }, [[...BEFORE_CHAPTER_3, 'peekaboo', 'three-way', 'bubble', 'charger']]);
  await page.goto('/#/');
  await page.reload();
  await page.getByTestId('start-robot').click();
  await page.getByTestId('robot-step-gatekeeper').click();
  await page.getByTestId('robot-code').fill(BUBBLE);
  await page.getByTestId('robot-run').click();
  await expect(page.getByTestId('robot-outcome')).toContainText('zu viel Schaden');
  await page.getByTestId('robot-code').fill(GATEKEEPER);
  await page.getByTestId('robot-run').click();
  await expect(page.getByTestId('robot-outcome')).toContainText('Gewonnen!');
  await expect(page.getByTestId('robot-stars')).toBeVisible();
});

test('Chapter 4 to the Basics Certificate, in English', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('pydra.v1.language', JSON.stringify('en')));
  await preset(page, [...BEFORE_CHAPTER_3, ...CHAPTER_3], GATEKEEPER);
  const english = async (id: string, script: string) => {
    await page.getByTestId(`robot-step-${id}`).click();
    await page.getByTestId('robot-code').fill(script);
    await page.getByTestId('robot-run').click();
    await expect(page.getByTestId('robot-outcome')).toContainText('Won!');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
  };
  await expect(page.getByRole('heading', { level: 2, name: 'Chapter 4: while loops' })).toBeVisible();
  await english('far-far-dummy', 'while see() != "enemy":\n    forward()\nfire()\nfire()');
  await english('regenerator', 'while see() != "enemy":\n    forward()\nwhile alive():\n    fire()');
  // The old script cannot get around a corner; the maze loop can (and keeps winning the earlier fights).
  await page.getByTestId('robot-step-maze-runner').click();
  await page.getByTestId('robot-code').fill('while see() != "enemy":\n    forward()\nwhile alive():\n    fire()');
  await page.getByTestId('robot-run').click();
  await expect(page.getByTestId('robot-outcome')).toContainText('Lost');
  await page.getByTestId('robot-code').fill(MAZE);
  await page.getByTestId('robot-run').click();
  await expect(page.getByTestId('robot-outcome')).toContainText('Won!');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await english('hide-and-seek', FINAL);

  // Proving Grounds II: the whole chapter in a row, then the certificate.
  await expect(page.getByTestId('robot-step-final-exam')).toBeDisabled();
  for (const id of ['pg2-a', 'pg2-b', 'pg2-c', 'pg2-d', 'pg2-e', 'pg2-f', 'pg2-g', 'pg2-h']) await english(id, FINAL);
  await english('final-exam', FINAL);
  await expect(page.getByTestId('robot-certificate')).toContainText('Basics Certificate');
});

test('the Training Grounds: random fights from Chapter 2 on', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('start-robot').click();
  await expect(page.getByTestId('robot-training')).toHaveCount(0);
  await preset(page, BEFORE_CHAPTER_3.slice(0, 17), 'forward()\nfire()', { chassis: 'light', locomotion: 'wheels', gear: ['blaster', 'eyes'], addons: [], blasterMark: 1 });
  await page.getByTestId('robot-training').click();
  await expect(page.getByTestId('robot-training-stats')).toContainText('0 Trainingskämpfe');
  await page.getByTestId('robot-train-new').click();
  await page.getByTestId('robot-run').click();
  await expect(page.getByTestId('robot-outcome')).toContainText('Verloren');
  // Training #1 is a row of dummies; the matching loop wins.
  await page.getByTestId('robot-code').fill('shots = 4\nforward(4)\nfor i in range(shots):\n    fire()');
  await page.getByTestId('robot-run').click();
  await expect(page.getByTestId('robot-outcome')).toContainText('Gewonnen!');
  await page.getByTestId('robot-next').click();
  await expect(page.getByTestId('robot-step-title')).toContainText('Training Nr. 2');
  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  await expect(page.getByTestId('robot-training-stats')).toContainText('1 Trainingskämpfe');
});
