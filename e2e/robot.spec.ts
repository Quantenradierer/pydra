import { expect, test } from '@playwright/test';
import { closeDrawer, codeBox, fillCode, openDrawer, runFight, stored, zone } from './helpers.ts';

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
    await runFight(page);
    await expect(page.getByTestId('robot-outcome')).toContainText('Gewonnen!');
    await expect(page.getByTestId('robot-stars')).toContainText('★★★');
    // The replay: scrub to the end and see the highlighted line and the log.
    // (Back / restart are disabled at the start of the replay, forward / end at its end.)
    await page.getByTestId('robot-end').click();
    await page.getByTestId('robot-restart').click();
    await page.getByTestId('robot-forward').click();
    await expect(page.locator('.robot-listing li.active')).toHaveCount(1);
    await expect(page.getByTestId('robot-position')).toHaveText('Runde 1 von 2');
    await page.getByTestId('robot-end').click();
    await expect(page.getByTestId('robot-log')).toContainText('schießt und trifft');
    expect(((await stored(page, 'robot')) as { solved: string[] }).solved).toEqual(['first-contact']);

    // One More Line: the same script now loses (the dummy takes 2 hits) ...
    await page.getByTestId('robot-next').click();
    await expect(page.getByTestId('robot-code')).toHaveValue('forward()\nfire()');
    await runFight(page);
    await expect(page.getByTestId('robot-outcome')).toContainText('Verloren');
    // The queue shows a result once the fight has been watched to its end.
    await expect(page.getByTestId('robot-layout-1')).not.toContainText('✗');
    await page.getByTestId('robot-end').click();
    await expect(page.getByTestId('robot-layout-1')).toContainText('✗');
    // ... a loss sends the player back to the same script; one more line wins.
    await fillCode(page, 'forward()\nfire()\nfire()');
    await runFight(page);
    await expect(page.getByTestId('robot-outcome')).toContainText('Gewonnen!');
    await expect(page.getByTestId('robot-history')).toBeAttached();

    // A typo gets a friendly message with the line.
    await fillCode(page, 'forward()\nfoward()');
    await runFight(page);
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
  expect(await pageScrolls(page)).toBe(false);
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
  await openDrawer(page, 'robot', 'robot-build-open');
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
  await openDrawer(page, 'robot', 'robot-build-open');
  // Both weapons do not fit next to the eyes on a light chassis: swap the blaster for the cannon.
  await page.getByTestId('robot-gear-cannon').click();
  await expect(page.getByTestId('robot-build-note')).toHaveText('Alle Plätze sind belegt: Nimm erst ein Teil heraus.');
  await expect(page.getByTestId('robot-gear-cannon')).not.toBeChecked();
  await page.getByTestId('robot-gear-blaster').uncheck();
  await page.getByTestId('robot-gear-cannon').check();
  await expect(page.getByTestId('robot-api')).toContainText('fire(power)');
  await fillCode(page, 'say("Hi")\nforward(4)\nfire(3)\nwait()\nwait()\nfire(3)');
  await runFight(page);
  await expect(page.getByTestId('robot-outcome')).toContainText('Gewonnen!');
  // The old blaster-only code stops at line 1 with a friendly message: the cannon needs a power.
  await fillCode(page, 'fire()');
  await runFight(page);
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
  await fillCode(page, script);
  await runFight(page);
  await expect(page.getByTestId('robot-outcome')).toContainText('Gewonnen!');
}

test('Chapter 3: if / elif decisions and the shield boss', async ({ page }) => {
  await page.goto('/');
  await preset(page, BEFORE_CHAPTER_3, 'forward(4)\nfire()');
  await page.getByTestId('robot-step-peekaboo').click();
  // Old code loses a layout (the dummy is on the right sometimes) ...
  await fillCode(page, 'fire()\nfire()');
  await runFight(page);
  await expect(page.getByTestId('robot-outcome')).toContainText('Verloren');
  // ... an if / else wins, and Three-Way and Bubble follow the same script.
  await fillCode(page, 'if see() == "enemy":\n    fire()\n    fire()\nelse:\n    turn_right()\n    fire()\n    fire()');
  await runFight(page);
  await expect(page.getByTestId('robot-outcome')).toContainText('Gewonnen!');
  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  await win(page, 'three-way', 'if see_right() == "enemy":\n    turn_right()\nelif see_left() == "enemy":\n    turn_left()\nfire()\nfire()');
  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  // Bubble: blind shooting wastes shots on the shield and is refused with a reason ...
  await page.getByTestId('robot-step-bubble').click();
  await fillCode(page, LOOK('        fire()'));
  await runFight(page);
  await expect(page.getByTestId('robot-outcome')).toContainText('Schild geschossen');
  await fillCode(page, BUBBLE);
  await runFight(page);
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
  await fillCode(page, BUBBLE);
  await runFight(page);
  await expect(page.getByTestId('robot-outcome')).toContainText('zu viel Schaden');
  await fillCode(page, GATEKEEPER);
  await runFight(page);
  await expect(page.getByTestId('robot-outcome')).toContainText('Gewonnen!');
  await expect(page.getByTestId('robot-stars')).toBeVisible();
});

test('Chapter 4 to the Basics Certificate, in English', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('pydra.v1.language', JSON.stringify('en')));
  await preset(page, [...BEFORE_CHAPTER_3, ...CHAPTER_3], GATEKEEPER);
  const english = async (id: string, script: string) => {
    await page.getByTestId(`robot-step-${id}`).click();
    await fillCode(page, script);
    await runFight(page);
    await expect(page.getByTestId('robot-outcome')).toContainText('Won!');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
  };
  await expect(page.getByRole('heading', { level: 2, name: 'Chapter 4: while loops' })).toBeVisible();
  await english('far-far-dummy', 'while see() != "enemy":\n    forward()\nfire()\nfire()');
  await english('regenerator', 'while see() != "enemy":\n    forward()\nwhile alive():\n    fire()');
  // The old script cannot get around a corner; the maze loop can (and keeps winning the earlier fights).
  await page.getByTestId('robot-step-maze-runner').click();
  await fillCode(page, 'while see() != "enemy":\n    forward()\nwhile alive():\n    fire()');
  await runFight(page);
  await expect(page.getByTestId('robot-outcome')).toContainText('Lost');
  await fillCode(page, MAZE);
  await runFight(page);
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
  await runFight(page);
  await expect(page.getByTestId('robot-outcome')).toContainText('Verloren');
  // Training #1 is a row of dummies; the matching loop wins.
  await fillCode(page, 'shots = 4\nforward(4)\nfor i in range(shots):\n    fire()');
  await runFight(page);
  await expect(page.getByTestId('robot-outcome')).toContainText('Gewonnen!');
  await page.getByTestId('robot-next').click();
  await expect(page.getByTestId('robot-step-title')).toContainText('Training Nr. 2');
  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  await expect(page.getByTestId('robot-training-stats')).toContainText('1 Trainingskämpfe');
});

/** Starts the Robot Battler on a given step with some progress and a script. */
async function openStep(page: import('@playwright/test').Page, step: string, script: string, solved: string[] = []) {
  await page.goto('/');
  await page.evaluate(([solvedIds, code]) => localStorage.setItem('pydra.v1.robot', JSON.stringify({ solved: solvedIds, script: code, runs: 1, wins: 1 })), [solved, script] as const);
  await page.reload();
  await page.getByTestId('start-robot').click();
  await page.getByTestId(`robot-step-${step}`).click();
  await runFight(page);
  await expect(page.getByTestId('robot-play')).toBeVisible();
}

for (const [device, viewport] of [
  ['phone', { width: 360, height: 640 }],
  ['desktop', { width: 1280, height: 800 }],
] as const) {
  test(`on a ${device}: the fight runs line by line with calls, variables, branches and the call stack`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openStep(page, 'first-contact', 'd = distance()\nif d > 0:\n    forward()\nfire()');
    const narration = page.getByTestId('robot-narration');
    // Slow by default; nothing has run yet.
    await expect(page.getByTestId('robot-speed')).toHaveValue('1');
    await expect(page.getByTestId('robot-speed-label')).toHaveText('sehr langsam');
    await expect(page.getByTestId('robot-where')).toContainText('Schritt 0 von');
    await expect(page.locator('.robot-listing li.active')).toHaveCount(0);

    // Line 1: a sensor call that costs no tick, and a variable that changes.
    await page.getByTestId('robot-line-forward').click();
    await expect(page.locator('.robot-listing li.active')).toHaveAttribute('data-line', '1');
    await expect(page.getByTestId('robot-where')).toHaveText(/^Zeile 1 · Schritt 1 von \d+$/);
    await expect(narration).toContainText('kostet keine Runde');
    await expect(page.getByTestId('robot-vars')).toContainText('d = ');
    await expect(page.locator('.robot-listing li[data-line="1"] .robot-note-inline')).toContainText('distance() →');
    await expect(page.getByTestId('robot-sensors')).toContainText('distance()');
    await expect(page.getByTestId('robot-position')).toHaveText(/^Runde 1 von \d+$/);

    // Line 2: the branch that was taken is lit up and explained.
    await page.getByTestId('robot-line-forward').click();
    await expect(page.locator('.robot-listing li.active')).toHaveAttribute('data-line', '2');
    await expect(narration).toContainText('Die Bedingung ist wahr');
    await expect(page.locator('.robot-listing li[data-line="2"]')).toHaveClass(/branch-true/);

    // Line 3: the command; stepping on plays it out in the arena (move) and the log tells it.
    await page.getByTestId('robot-line-forward').click();
    await expect(page.locator('.robot-listing li.active')).toHaveAttribute('data-line', '3');
    await expect(narration).toContainText('ist ein Befehl');
    await page.getByTestId('robot-line-forward').click();
    await expect(page.getByTestId('robot-where')).toContainText('Arena · Runde 1');
    await expect(narration).toContainText('fährt von');

    // A tick back goes to the start of the fight; a tick forward jumps over the lines of the next tick.
    await page.getByTestId('robot-back').click();
    await expect(page.getByTestId('robot-position')).toHaveText(/^Runde 0 von/);
    await page.getByTestId('robot-forward').click();
    await expect(page.getByTestId('robot-position')).toHaveText(/^Runde 1 von/);
    await page.getByTestId('robot-end').click();
    await expect(page.getByTestId('robot-log')).toContainText('schießt und trifft');

    // Play at top speed: it runs to the end by itself, and the slider keeps its value.
    await page.getByTestId('robot-restart').click();
    await openDrawer(page, 'fight', 'robot-more-open');
    await page.getByTestId('robot-speed').fill('5');
    await expect(page.getByTestId('robot-speed-label')).toHaveText('sehr schnell');
    await closeDrawer(page, 'fight');
    await page.getByTestId('robot-play').click();
    await expect(page.getByTestId('robot-play')).toHaveText('Abspielen', { timeout: 10_000 });
    await expect(page.getByTestId('robot-log')).toContainText('schießt und trifft');

    // On a desktop the highlighted code sits left of the arena; on a phone it lives in the Code zone. Nothing scrolls sideways.
    if (device === 'desktop') {
      const canvas = (await page.getByTestId('robot-canvas').boundingBox())!;
      const code = (await page.getByTestId('robot-listing').boundingBox())!;
      expect(code.x + code.width).toBeLessThanOrEqual(canvas.x + 1);
    } else {
      await expect(page.getByTestId('robot-listing')).toBeHidden();
      await zone(page, 'code');
      await expect(page.getByTestId('robot-listing')).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('a function call shows in the call stack with its argument and the local variable', async ({ page }) => {
  await openStep(page, 'first-contact', 'def go(n):\n    forward(n)\ngo(1)\nfire()');
  // def (line 1), the call (line 3), then inside the function (line 2).
  for (let i = 0; i < 3; i++) await page.getByTestId('robot-line-forward').click();
  await expect(page.locator('.robot-listing li.active')).toHaveAttribute('data-line', '2');
  await expect(page.getByTestId('robot-stack')).toContainText('go(1)');
  await expect(page.getByTestId('robot-vars')).toContainText('n = 1');
});

test('the variation queue: first fight, then the other variations and earlier enemies, with a summary', async ({ page }) => {
  test.setTimeout(90_000);
  await openStep(page, 'one-more-line', 'forward()\nfire()\nfire()', ['first-contact']);
  const queue = page.getByTestId('robot-queue-panel');
  await expect(page.getByTestId('robot-vq-progress')).toHaveText(/^Kampf 1 von (\d+): .*, Spielfeld 1 von \d+$/);
  const total = Number((await page.getByTestId('robot-vq-progress').textContent())!.match(/von (\d+):/)![1]);
  expect(total).toBeGreaterThan(3);
  await expect(page.getByTestId('robot-vq-state')).toHaveText('läuft');
  // Watch the first fight to its end: its result lights up in the queue.
  await page.getByTestId('robot-end').click();
  await expect(page.getByTestId('robot-vq-state')).toHaveText('gewonnen');
  await expect(page.getByTestId('robot-layout-1')).toContainText('✓');
  // Go on to the next map, then let the rest play on its own at top speed (auto-advance).
  await page.getByTestId('robot-vq-next').click();
  await expect(page.getByTestId('robot-vq-progress')).toHaveText(/^Kampf 2 von/);
  await openDrawer(page, 'fight', 'robot-more-open');
  // "Next fight" starts it playing at once; speed it up and the rest follows by itself.
  await expect(page.getByTestId('robot-play')).toHaveText('Pause');
  await page.getByTestId('robot-speed').fill('5');
  await closeDrawer(page, 'fight');
  await openDrawer(page, 'fight', 'robot-vq-open');
  await expect(page.getByTestId('robot-vq-summary')).toContainText(`${total} von ${total} Kämpfen gewonnen`, { timeout: 60_000 });
  await expect(page.getByTestId('robot-vq-verdict')).toHaveText('Dein Skript gewinnt auf allen Spielfeldern und gegen alle früheren Gegner.');
  // The earlier enemy is part of the queue and can be watched again from the summary.
  await expect(queue.getByTestId('robot-vq-row-first-contact#1')).toBeHidden(); // won fights are folded away
  await queue.getByTestId('robot-vq-won').locator('summary').click();
  await expect(queue.getByTestId('robot-vq-row-first-contact#1')).toContainText('früherer Gegner');
  await queue.getByTestId('robot-vq-watch-first-contact#1').click();
  await expect(page.getByTestId('robot-vq-progress')).toContainText('früherer Gegner „');
  await expect(page.locator('.robot-listing li')).toHaveCount(3);
});

test('the queue summary says which variations were lost and why, and skipping shows it at once', async ({ page }) => {
  await openStep(page, 'one-more-line', 'forward()\nfire()', ['first-contact']);
  await expect(page.getByTestId('robot-outcome')).toContainText('Verloren');
  await openDrawer(page, 'fight', 'robot-vq-open');
  await page.getByTestId('robot-vq-all').click();
  const summary = page.getByTestId('robot-vq-summary');
  await expect(summary).toContainText('Kämpfen gewonnen');
  await expect(page.getByTestId('robot-vq-verdict')).toContainText('Mindestens ein Kampf ging verloren');
  const lost = summary.locator('li.lost').first();
  await expect(lost).toContainText('✗');
  await expect(lost).toContainText('Die Zeit lief ab');
  // The skipped fights are marked in the queue, and a lost one can be watched.
  await expect(page.getByTestId('robot-layout-1')).toContainText('✗');
  await lost.getByRole('button', { name: 'Ansehen' }).click();
  await expect(page.getByTestId('robot-vq-state')).toHaveText('verloren');
  await expect(page.getByTestId('robot-vq-reason')).toContainText('Die Zeit lief ab');
});

test('English texts in the stepping view', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('pydra.v1.language', JSON.stringify('en')));
  await openStep(page, 'first-contact', 'forward()\nfire()');
  await page.getByTestId('robot-line-forward').click();
  await expect(page.getByTestId('robot-narration')).toContainText('is a command: it costs one round');
  await expect(page.getByTestId('robot-where')).toHaveText(/^Line 1 · step 1 of \d+$/);
  await expect(page.getByTestId('robot-vq-progress')).toContainText('Fight 1 of');
  await expect(page.getByTestId('robot-speed-label')).toHaveText('very slow');
});

test('the task map: a Continue button leads to the next task and finished chapters fold away', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('start-robot').click();
  await expect(page.getByTestId('robot-continue')).toContainText('Los geht’s');
  await expect(page.getByTestId('robot-continue')).toContainText('Erster Kontakt');
  await expect(page.getByTestId('robot-chapter-1')).not.toHaveAttribute('open', '');
  await page.getByTestId('robot-continue').click();
  await expect(page.getByTestId('robot-step-title')).toHaveText('Erster Kontakt');
  await runFight(page);
  await expect(page.getByTestId('robot-outcome')).toContainText('Gewonnen!');
  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  await expect(page.getByTestId('robot-continue')).toContainText('Weiter geht’s');
  await expect(page.getByTestId('robot-continue')).toContainText('Eine Zeile mehr');
});

test('the build screen draws the robot from its parts: tap sockets to plug parts in and out, swap the drive', async ({ page }) => {
  await page.goto('/');
  const solved = ['first-contact', 'one-more-line', 'training-dummy', 'corner-dummy', 'u-turn', 'twin-dummies', 'wall-dummy', 'obstacle-course', 'hello-robot', 'far-dummy'];
  await page.evaluate((s) => localStorage.setItem('pydra.v1.robot', JSON.stringify({ solved: s, script: 'forward()' })), solved);
  await page.reload();
  await page.getByTestId('start-robot').click();
  await page.getByTestId('robot-step-armored-dummy').click();
  await zone(page, 'robot');
  const art = page.locator('.robot-bench-stage svg.rb');
  // The start build: wheels, blaster, eyes.
  await expect(art).toHaveAttribute('data-loco', 'wheels');
  await expect(art).toHaveAttribute('data-gear', 'blaster eyes');
  await expect(page.getByTestId('robot-part-blaster')).toBeVisible();
  await expect(page.getByTestId('robot-part-eyes')).toBeVisible();
  // Tap the blaster, take it out: an empty socket (plug outline) appears.
  await page.getByTestId('robot-part-blaster').dispatchEvent('click');
  await page.getByTestId('robot-unplug-blaster').click();
  await expect(art).toHaveAttribute('data-gear', 'eyes');
  await expect(page.getByTestId('robot-part-blaster')).toHaveCount(0);
  await expect(page.locator('.rb-plug')).toHaveCount(1);
  // Tap the empty socket: the parts that fit are offered; plug the cannon in.
  await page.locator('.rb-plug').dispatchEvent('click');
  await expect(page.getByTestId('robot-inspector')).toContainText('Leerer Platz');
  await page.getByTestId('robot-pick-cannon').click();
  await expect(art).toHaveAttribute('data-gear', /cannon/);
  await expect(page.getByTestId('robot-part-cannon')).toBeVisible();
  await expect(page.getByTestId('robot-gear-cannon')).toBeChecked(); // (the full list is a drawer; attached is enough)
  // Swap the drive: the picture changes.
  await page.getByTestId('robot-socket-underside').dispatchEvent('click');
  await page.getByTestId('robot-pick-legs').click();
  await expect(art).toHaveAttribute('data-loco', 'legs');
  await expect(page.getByTestId('robot-part-legs')).toHaveCount(1);
  await expect(page.getByTestId('robot-part-wheels')).toHaveCount(0);
  await expect(page.getByTestId('robot-locomotion-legs')).toBeChecked();
});

test('the hidden dev gallery shows every chassis and part', async ({ page }) => {
  await page.goto('/#/dev/robots');
  await expect(page.getByTestId('robot-gallery')).toBeVisible();
  expect(await page.locator('[data-testid=robot-gallery] svg.rb').count()).toBeGreaterThan(100);
});

/** True when the page itself (not a zone inside it) scrolls vertically. */
const pageScrolls = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 1);

test('desktop 1280x800: task, robot, code and fight sit side by side and the page does not scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openStep(page, 'one-more-line', 'forward()\nfire()', ['first-contact']);
  for (const z of ['task', 'robot', 'code', 'fight'] as const) await expect(page.getByTestId(`zone-${z}`)).toBeVisible();
  await expect(page.getByTestId('zone-tabs')).toBeHidden();
  expect(await pageScrolls(page)).toBe(false);
  // The arena, its controls and the result are all on the screen without scrolling the page.
  for (const id of ['robot-canvas', 'robot-play', 'robot-outcome', 'robot-run']) {
    const box = (await page.getByTestId(id).boundingBox())!;
    expect(box.y + box.height, id).toBeLessThanOrEqual(800);
  }
  // Opening a drawer replaces the body of its zone, never the page layout.
  await page.getByTestId('robot-api-open').click();
  await expect(page.getByTestId('robot-api')).toBeVisible();
  expect(await pageScrolls(page)).toBe(false);
});

test('phone 360x740: one zone fills the screen, the bottom bar switches, the page does not scroll and the fight zone barely does', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('pydra.v1.robot', JSON.stringify({ solved: ['first-contact'], script: 'forward()\nfire()', runs: 1, wins: 1 })));
  await page.reload();
  await page.getByTestId('start-robot').click();
  await page.getByTestId('robot-step-one-more-line').click();
  // The step indicator and the bottom bar are always there; the task zone comes first.
  await expect(page.getByTestId('robot-steps').locator('li')).toHaveCount(4);
  await expect(page.getByTestId('robot-phase-build')).toHaveAttribute('aria-current', 'step');
  await expect(page.getByTestId('zone-task')).toBeVisible();
  for (const z of ['robot', 'code', 'fight'] as const) await expect(page.getByTestId(`zone-${z}`)).toBeHidden();
  for (const tab of await page.locator('[data-testid^=zone-tab-]').all()) expect((await tab.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  // Task -> Code by the primary button; focus lands in the editor.
  await page.getByTestId('robot-to-code').click();
  await expect(page.getByTestId('zone-code')).toBeVisible();
  await expect(page.getByTestId('robot-code')).toBeFocused();
  await expect(page.getByTestId('robot-phase-code')).toHaveAttribute('aria-current', 'step');
  // The tab bar switches, and focus moves to the zone heading.
  await page.getByTestId('zone-tab-robot').click();
  await expect(page.getByTestId('zone-robot')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Roboter' })).toBeFocused();
  await expect(page.getByTestId('robot-phase-build')).toHaveAttribute('aria-current', 'step');
  await expect(page.getByTestId('zone-tab-robot')).toHaveAttribute('aria-current', 'true');
  // Run: the fight zone comes forward with the fight phase; the primary action is Play.
  await runFight(page);
  await expect(page.getByTestId('zone-fight')).toBeVisible();
  await expect(page.getByTestId('robot-phase-fight')).toHaveAttribute('aria-current', 'step');
  await expect(page.getByTestId('robot-play')).toBeVisible();
  expect(await pageScrolls(page)).toBe(false);
  const body = await page.getByTestId('zone-fight').locator('.rb-zone-body').evaluate((el) => el.scrollHeight - el.clientHeight);
  expect(body).toBeLessThanOrEqual(160);
  for (const id of ['robot-play', 'robot-run', 'robot-vq-open']) {
    const box = await page.getByTestId(id).boundingBox();
    if (box) expect(box.height, id).toBeGreaterThanOrEqual(43.5);
  }
  // A lost fight offers "improve": back to the code, phase 4.
  await expect(page.getByTestId('robot-outcome')).toHaveAttribute('data-state', 'lost');
  await page.getByTestId('robot-improve').click();
  await expect(page.getByTestId('zone-code')).toBeVisible();
  await expect(page.getByTestId('robot-code')).toBeFocused();
  await expect(page.getByTestId('robot-phase-improve')).toHaveAttribute('aria-current', 'step');
  // Drawers: open from the editor, close with Escape, focus returns to the opener.
  await page.getByTestId('robot-api-open').click();
  await expect(page.getByTestId('robot-api')).toBeVisible();
  await expect(page.getByTestId('robot-code')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('robot-api')).toBeHidden();
  await expect(page.getByTestId('robot-api-open')).toBeFocused();
  expect(await pageScrolls(page)).toBe(false);
});

test('the same screens in English', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('pydra.v1.language', JSON.stringify('en'));
    localStorage.setItem('pydra.v1.robot', JSON.stringify({ solved: ['first-contact'], script: 'forward()\nfire()', runs: 1, wins: 1 }));
  });
  await page.reload();
  await page.getByTestId('start-robot').click();
  await page.getByTestId('robot-step-one-more-line').click();
  await expect(page.getByTestId('robot-steps')).toHaveText(/1Build2Script3Fight4Improve/);
  await expect(page.getByTestId('zone-tab-fight')).toHaveText('Fight');
  await expect(page.getByRole('heading', { level: 2, name: 'Task' })).toBeVisible();
  await runFight(page);
  await expect(page.getByTestId('robot-outcome')).toContainText('Lost');
  await expect(page.getByTestId('robot-improve')).toHaveText('Improve script');
});

test('there are no hints anywhere in the work screen', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('start-robot').click();
  await page.getByTestId('robot-step-first-contact').click();
  await expect(page.getByTestId('robot-hint')).toHaveCount(0);
  await zone(page, 'code');
  await expect(page.getByTestId('robot-hint-code')).toHaveCount(0);
  await expect(page.getByTestId('robot-hints')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Hinweis/ })).toHaveCount(0);
});
