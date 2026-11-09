import { expect, test } from '@playwright/test';
import { closeSheets, fillCode, openSheet, runFight, startFight, stored } from './helpers.ts';

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
    // The replay: to the end and back to the start, then one step shows the highlighted line and the log.
    // (Restart is disabled at the start of the replay, step / end at its end.)
    await page.getByTestId('robot-restart').click();
    await page.getByTestId('robot-step').click();
    await expect(page.locator('.robot-listing li.active')).toHaveCount(1);
    await expect(page.getByTestId('robot-position')).toHaveText('Runde 1 von 2');
    expect(((await stored(page, 'robot')) as { solved: string[] }).solved).toEqual(['first-contact']);

    // One More Line: the same script now loses (the dummy takes 2 hits) ...
    await page.getByTestId('robot-next').click();
    await expect(page.getByTestId('robot-code')).toHaveValue('forward()\nfire()');
    await runFight(page);
    await expect(page.getByTestId('robot-outcome')).toContainText('Verloren');
    // ... a loss sends the player back to the same script; one more line wins.
    await fillCode(page, 'forward()\nfire()\nfire()');
    await runFight(page);
    await expect(page.getByTestId('robot-outcome')).toContainText('Gewonnen!');

    // A typo gets a friendly message with the line.
    await fillCode(page, 'forward()\nfoward()');
    await runFight(page);
    await expect(page.getByTestId('robot-error')).toContainText('Zeile 2: Dein Roboter kennt „foward“ nicht. Meintest du forward()?');

    // The map shows the progress, and the points arrived.
    await page.getByRole('button', { name: 'Zurück', exact: true }).click();
    await expect(page.getByTestId('robot-step-one-more-line')).toHaveAttribute('aria-label', /geschafft/);
    await expect(page.getByTestId('robot-step-training-dummy')).toBeEnabled();
    await page.getByRole('button', { name: 'Zurück', exact: true }).click();
    await expect(page.getByTestId('stats-robot')).toContainText(/^2 von \d+ Aufgaben geschafft/);
    await expect(page.getByTestId('home-level')).toBeVisible();
  });
}

test('a bug hunt is a robot fight: the bug is put into your script, fix it and watch the fight; English texts', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('pydra.v1.language', JSON.stringify('en'));
    const solved = ['first-contact', 'one-more-line', 'training-dummy'];
    localStorage.setItem('pydra.v1.robot', JSON.stringify({ solved, script: 'forward()\nfire()\nfire()', runs: 3, wins: 3 }));
  });
  await page.reload();
  await page.getByTestId('start-robot').click();
  await expect(page.getByRole('heading', { level: 2 }).first()).toHaveText('Chapter 0: Commands in a row');
  await page.getByTestId('robot-step-gl-foward').click();
  await expect(page.getByTestId('robot-code')).toHaveValue('foward()\nfire()\nfire()');
  await expect(page.getByTestId('robot-catch')).toContainText('The script has a bug. Find it.');
  await runFight(page);
  await expect(page.getByTestId('robot-error')).toContainText('Line 1');
  await fillCode(page, 'forward()\nfire()\nfire()');
  await runFight(page);
  await expect(page.getByTestId('robot-outcome')).toContainText('Won');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByTestId('robot-step-gl-foward')).toHaveAttribute('aria-label', /done/);
});

test('the builder: every part can be equipped at any time; new parts are only marked "neu"', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('pydra.v1.robot', JSON.stringify({ solved: ['first-contact'], script: 'forward()\nfire()' })));
  await page.goto('/#/');
  await page.reload();
  await page.getByTestId('start-robot').click();
  await page.getByTestId('robot-step-one-more-line').click();
  await openSheet(page, 'robot-build-open');
  // Chapter 0: nothing is locked, not even the cannon, spider legs, treads or the shield.
  for (const id of ['robot-gear-cannon', 'robot-gear-hammer', 'robot-gear-shield', 'robot-gear-gps', 'robot-gear-plates', 'robot-locomotion-legs', 'robot-locomotion-treads', 'robot-chassis-medium']) {
    await expect(page.getByTestId(id), id).toBeEnabled();
  }
  await expect(page.getByTestId('robot-new')).toHaveCount(0);
  // The commands of the equipped parts are in the one help sheet.
  const commands = async () => {
    await openSheet(page, 'robot-code-more');
    return page.getByTestId('robot-code-help');
  };
  await expect(await commands()).toContainText('forward(steps)');
  await expect(page.getByTestId('robot-code-help')).not.toContainText('fire(power)');
  await openSheet(page, 'robot-build-open');
  // Both weapons do not fit next to the eyes on a light chassis: swap the blaster for the cannon.
  await page.getByTestId('robot-gear-cannon').click();
  await expect(page.getByTestId('robot-build-note')).toHaveText('Alle Plätze sind belegt: Nimm erst ein Teil heraus.');
  await expect(page.getByTestId('robot-gear-cannon')).not.toBeChecked();
  await page.getByTestId('robot-gear-blaster').uncheck();
  await page.getByTestId('robot-gear-cannon').check();
  await expect(await commands()).toContainText('fire(power)');
  // The cannon needs a power; the old blaster-only code stops at line 1 with a friendly message.
  await fillCode(page, 'forward()\nfire()');
  await runFight(page);
  await expect(page.getByTestId('robot-outcome')).toContainText('Das Skript hat in Zeile 2 angehalten: fire() will');
  // Back to the blaster: the default gear wins the same fight.
  await openSheet(page, 'robot-build-open');
  await page.getByTestId('robot-gear-cannon').uncheck();
  await page.getByTestId('robot-gear-blaster').check();
  await fillCode(page, 'forward()\nfire()\nfire()');
  await runFight(page);
  await expect(page.getByTestId('robot-outcome')).toContainText('Gewonnen!');

  // Chapter 1 only marks the cannon as new; it is still just a part.
  await page.evaluate(() => {
    const solved = ['first-contact', 'one-more-line', 'training-dummy', 'corner-dummy', 'u-turn', 'twin-dummies', 'wall-dummy', 'obstacle-course', 'hello-robot', 'far-dummy'];
    localStorage.setItem('pydra.v1.robot', JSON.stringify({ solved, script: 'say("Hi")\nforward(4)\nfire()\nfire()\nfire()\nfire()' }));
  });
  await page.goto('/#/');
  await page.reload();
  await page.getByTestId('start-robot').click();
  await page.getByTestId('robot-step-armored-dummy').click();
  await openSheet(page, 'robot-build-open');
  await expect(page.getByTestId('robot-new').first()).toHaveText('neu');
  await runFight(page);
  await expect(page.getByTestId('robot-outcome')).toContainText('Gewonnen!');
});

const BEFORE_CHAPTER_3 = [
  'first-contact', 'one-more-line', 'training-dummy', 'corner-dummy', 'u-turn', 'twin-dummies', 'wall-dummy', 'obstacle-course',
  'hello-robot', 'far-dummy', 'armored-dummy', 'counter', 'sign-dummy', 'math-dummy', 'twin-armor', 'name-tag', 'calibrator',
  'tank-dummy', 'dummy-row', 'step-counter', 'after-the-loop', 'double-loop', 'dummy-army',
  'pg1-a', 'pg1-b', 'pg1-c', 'pg1-d', 'pg1-e', 'drill-sergeant',
];
const CHAPTER_3 = ['peekaboo', 'three-way', 'bubble', 'charger', 'gatekeeper'];
/** The starting robot: every task is won with it. */
const DEFAULT_BUILD = { chassis: 'light', locomotion: 'wheels', gear: ['blaster', 'eyes'], addons: ['wide', 'scanner'], blasterMark: 1 };

const LOOK = (inner: string) =>
  `for i in range(30):\n    if see_right() == "enemy":\n        turn_right()\n    elif see_left() == "enemy":\n        turn_left()\n    elif see() == "enemy":\n${inner}`;
const BUBBLE = LOOK('        if enemy_shielded():\n            wait()\n        else:\n            fire()');
const GATEKEEPER = BUBBLE;
const MAZE = 'while alive():\n    if see() == "enemy":\n        fire()\n    elif see() == "wall" and distance() == 1:\n        turn_right()\n    else:\n        forward()';
const FINAL =
  'while alive():\n    if see() == "enemy":\n        if enemy_shielded():\n            wait()\n        else:\n            fire()\n    elif see_left() == "enemy":\n        turn_left()\n    elif see_right() == "enemy":\n        turn_right()\n    elif see() == "wall" and distance() == 1:\n        turn_right()\n    else:\n        forward()';

async function preset(page: import('@playwright/test').Page, solved: string[], script: string, build: object = DEFAULT_BUILD) {
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

  // Gatekeeper (boss): the starting robot wins by waiting while the shield is up; its own shield is optional.
  await page.evaluate(([s]) => {
    const p = JSON.parse(localStorage.getItem('pydra.v1.robot')!);
    localStorage.setItem('pydra.v1.robot', JSON.stringify({ ...p, solved: s }));
  }, [[...BEFORE_CHAPTER_3, 'peekaboo', 'three-way', 'bubble', 'charger']]);
  await page.goto('/#/');
  await page.reload();
  await page.getByTestId('start-robot').click();
  await page.getByTestId('robot-step-gatekeeper').click();
  await fillCode(page, LOOK('        fire()'));
  await runFight(page);
  await expect(page.getByTestId('robot-outcome')).toContainText('Schild geschossen');
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
  // The fight starts playing by itself; pause it at once (still at the start) to step through it by hand.
  await startFight(page);
  await page.getByTestId('robot-play').click();
  await expect(page.getByTestId('robot-position')).toHaveText(/ 0 (von|of) /);
}

for (const [device, viewport] of [
  ['phone', { width: 360, height: 640 }],
  ['desktop', { width: 1280, height: 800 }],
] as const) {
  test(`on a ${device}: the fight runs line by line with calls and branches`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openStep(page, 'first-contact', 'd = distance()\nif d > 0:\n    forward()\nfire()');
    const narration = page.getByTestId('robot-narration');
    // Slow by default; back at the start nothing has run yet.
    await expect(page.getByTestId('robot-speed')).toHaveText('⏱ mittel');
    await expect(narration).toHaveText('');
    await expect(page.locator('.robot-listing li.active')).toHaveCount(0);

    // Line 1: a sensor call that costs no tick, and a variable that changes.
    await page.getByTestId('robot-step').click();
    await expect(page.locator('.robot-listing li.active')).toHaveAttribute('data-line', '1');
    await expect(narration).toHaveText('');
    await expect(page.locator('.robot-listing li[data-line="1"] .robot-note-inline')).toContainText('distance() →');
    await expect(page.getByTestId('robot-position')).toHaveText(/^Runde 1 von \d+$/);

    // Line 2: the branch that was taken is lit up and explained.
    await page.getByTestId('robot-step').click();
    await expect(page.locator('.robot-listing li.active')).toHaveAttribute('data-line', '2');
    await expect(page.locator('.robot-listing li[data-line="2"]')).toHaveClass(/branch-true/);

    // Line 3: the command; stepping on plays it out in the arena (move) and the log tells it.
    await page.getByTestId('robot-step').click();
    await expect(page.locator('.robot-listing li.active')).toHaveAttribute('data-line', '3');
    await page.getByTestId('robot-step').click();
    // The action plays out: one short sentence, no coordinates, no filler.
    await expect(narration).toHaveText('Du fährst einen Schritt vor.');

    // Restart goes back to the start; the speed button cycles through the speeds and keeps its value.
    await page.getByTestId('robot-restart').click();
    await expect(page.getByTestId('robot-position')).toHaveText(/^Runde 0 von/);
    await page.getByTestId('robot-speed').click();
    await expect(page.getByTestId('robot-speed')).toHaveText('⏱ schnell');
    await page.getByTestId('robot-speed').click();
    await expect(page.getByTestId('robot-speed')).toHaveText('⏱ sehr schnell');
    await page.getByTestId('robot-play').click();
    await expect(page.getByTestId('robot-play')).toHaveAttribute('aria-label', 'Abspielen', { timeout: 10_000 });
    await expect(page.getByTestId('robot-outcome')).toBeVisible();

    // The highlighted code replaces the editor (same box): right of the arena on a desktop, under it on a phone. Nothing scrolls sideways.
    await expect(page.getByTestId('robot-listing')).toBeVisible();
    await expect(page.getByTestId('robot-code')).toBeHidden();
    const canvas = (await page.getByTestId('robot-canvas').boundingBox())!;
    const code = (await page.getByTestId('robot-listing').boundingBox())!;
    if (device === 'desktop') expect(code.x).toBeGreaterThanOrEqual(canvas.x + canvas.width - 1);
    else expect(code.y).toBeGreaterThanOrEqual(canvas.y + canvas.height - 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('a function call is highlighted line by line: the call, then the line inside the function', async ({ page }) => {
  await openStep(page, 'first-contact', 'def go(n):\n    forward(n)\ngo(1)\nfire()');
  // def (line 1), the call (line 3), then inside the function (line 2).
  for (let i = 0; i < 3; i++) await page.getByTestId('robot-step').click();
  await expect(page.locator('.robot-listing li.active')).toHaveAttribute('data-line', '2');
});

test('one fight per task: it plays at once, the verdict comes when it ends, a lost fight says why', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('pydra.v1.robot', JSON.stringify({ solved: ['first-contact'], script: 'forward()\nfire()\nfire()' })));
  await page.reload();
  await page.getByTestId('start-robot').click();
  await page.getByTestId('robot-step-one-more-line').click();
  await startFight(page);
  await expect(page.getByTestId('robot-play')).toHaveAttribute('aria-label', 'Pause');
  await page.getByTestId('robot-skip').click();
  await expect(page.getByTestId('robot-outcome')).toHaveText(/^Gewonnen!/);
  // Nothing advances by itself, there is no "automatic" option.
  await expect(page.getByText(/Automatisch weiter/)).toHaveCount(0);
  await fillCode(page, 'forward()\nfire()');
  await runFight(page);
  await expect(page.getByTestId('robot-outcome')).toContainText('Die Zeit lief ab');
});

test('English texts in the stepping view', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('pydra.v1.language', JSON.stringify('en')));
  await openStep(page, 'first-contact', 'forward()\nfire()');
  await page.getByTestId('robot-step').click();
  await page.getByTestId('robot-step').click();
  await expect(page.getByTestId('robot-narration')).toHaveText('You drive one step ahead.');
  await expect(page.getByTestId('robot-position')).toHaveText(/^Round 1 of \d+$/);
  await expect(page.getByTestId('robot-speed')).toHaveText('⏱ medium');
});

test('the task map: a Continue button leads to the next task and finished chapters fold away', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('start-robot').click();
  await expect(page.getByTestId('robot-continue')).toContainText('Los geht’s');
  await expect(page.getByTestId('robot-continue')).toContainText('Aufgabe 1');
  await expect(page.getByTestId('robot-chapter-1')).not.toHaveAttribute('open', '');
  await page.getByTestId('robot-continue').click();
  await expect(page.getByTestId('robot-catch')).toContainText('Zerstöre den Gegner.');
  await runFight(page);
  await expect(page.getByTestId('robot-outcome')).toContainText('Gewonnen!');
  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  await expect(page.getByTestId('robot-continue')).toContainText('Weiter geht’s');
  await expect(page.getByTestId('robot-continue')).toContainText('Aufgabe 2');
});

test('the build screen draws the robot from its parts: tap sockets to plug parts in and out, swap the drive', async ({ page }) => {
  await page.goto('/');
  const solved = ['first-contact', 'one-more-line', 'training-dummy', 'corner-dummy', 'u-turn', 'twin-dummies', 'wall-dummy', 'obstacle-course', 'hello-robot', 'far-dummy'];
  await page.evaluate((s) => localStorage.setItem('pydra.v1.robot', JSON.stringify({ solved: s, script: 'forward()' })), solved);
  await page.reload();
  await page.getByTestId('start-robot').click();
  await page.getByTestId('robot-step-armored-dummy').click();
  await openSheet(page, 'robot-build-open');
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

/** Every zone/step indicator exists exactly once on the task page: the level pills, and no other navigation. */
async function expectOneNavigation(page: import('@playwright/test').Page) {
  await expect(page.getByTestId('level-strip')).toHaveCount(1);
  await expect(page.locator('nav')).toHaveCount(1);
  for (const gone of ['robot-steps', 'zone-tabs', 'zone-task', 'zone-robot', 'zone-code', 'zone-fight', 'robot-api-open', 'robot-vq-open', 'robot-more-open', 'robot-vq-auto', 'robot-share']) await expect(page.getByTestId(gone), gone).toHaveCount(0);
  await expect(page.locator('.rb-steps, .rb-tabs, .rb-zone, [aria-current="step"]:not(.level-dot)')).toHaveCount(0);
  await expect(page.locator('[aria-current="step"]')).toHaveCount(1);
  // The task name is the heading once, the one primary button exists once.
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('button.primary')).toHaveCount(1);
}

test('desktop 1280x800: the task page has two columns, one navigation, and does not scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openStep(page, 'one-more-line', 'forward()\nfire()', ['first-contact']);
  await page.getByTestId('robot-skip').click();
  await expectOneNavigation(page);
  expect(await pageScrolls(page)).toBe(false);
  // The arena, its controls, the result and the primary button are on the screen without scrolling.
  for (const id of ['robot-canvas', 'robot-play', 'robot-outcome', 'robot-improve']) {
    const box = (await page.getByTestId(id).boundingBox())!;
    expect(box.y + box.height, id).toBeLessThanOrEqual(800);
  }
  // Arena left, script right.
  const arena = (await page.getByTestId('robot-canvas').boundingBox())!;
  const script = (await page.getByTestId('robot-listing').boundingBox())!;
  expect(script.x).toBeGreaterThan(arena.x + arena.width);
});

test('phone 360x740: one column, one navigation, one primary button that changes with the state', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('pydra.v1.robot', JSON.stringify({ solved: ['first-contact'], script: 'forward()\nfire()', runs: 1, wins: 1 })));
  await page.reload();
  await page.getByTestId('start-robot').click();
  await page.getByTestId('robot-step-one-more-line').click();
  await expectOneNavigation(page);
  // The task, the arena (a preview with both robots), the controls (waiting) and the script are on one page.
  await expect(page.getByTestId('robot-catch')).toBeVisible();
  await expect(page.getByTestId('robot-canvas')).toBeVisible();
  await expect(page.getByTestId('robot-play')).toBeDisabled();
  await expect(page.getByTestId('robot-code')).toBeVisible();
  await expect(page.getByTestId('robot-run')).toHaveText('Kampf starten');
  await expect(page.getByTestId('robot-outcome')).toHaveCount(0);
  // The pills are the only way between tasks; tap targets are 44 px.
  for (const id of ['robot-play', 'robot-run', 'robot-build-open']) expect((await page.getByTestId(id).boundingBox())!.height, id).toBeGreaterThanOrEqual(43.5);
  // Run: the verdict appears under the arena and the primary becomes "improve"; the page is at most 1.6 screens tall.
  await runFight(page);
  await expect(page.getByTestId('robot-outcome')).toHaveAttribute('data-state', 'lost');
  await expect(page.getByTestId('robot-improve')).toHaveText('Skript verbessern');
  await expect(page.getByTestId('robot-play')).toBeEnabled();
  await expectOneNavigation(page);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(740 * 1.6);
  // "Improve" brings the editor back and focuses it; typing makes the primary "start fight" again.
  await page.getByTestId('robot-improve').click();
  await expect(page.getByTestId('robot-code')).toBeFocused();
  await expect(page.getByTestId('robot-run')).toHaveText('Kampf starten');
  // The equipment sheet closes with Escape and gives the focus back.
  await page.getByTestId('robot-build-open').click();
  await expect(page.getByTestId('robot-parts-sheet')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('robot-parts-sheet')).toBeHidden();
  await expect(page.getByTestId('robot-build-open')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
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
  await expectOneNavigation(page);
  await expect(page.getByTestId('robot-run')).toHaveText('Start fight');
  await expect(page.getByTestId('robot-build-open')).toHaveText('Equipment');
  await runFight(page);
  await expect(page.getByTestId('robot-outcome')).toContainText('Lost');
  await expect(page.getByTestId('robot-improve')).toHaveText('Improve script');
});

test('there are no hints anywhere in the work screen', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('start-robot').click();
  await page.getByTestId('robot-step-first-contact').click();
  await expect(page.getByTestId('robot-hint')).toHaveCount(0);
  await expect(page.getByTestId('robot-hint-code')).toHaveCount(0);
  await expect(page.getByTestId('robot-hints')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Hinweis/ })).toHaveCount(0);
});
