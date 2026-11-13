import { expect, test, type Page } from '@playwright/test';
import { CHALLENGES } from '../web/src/elevator/challenges.ts';
import { stored } from './helpers.ts';

const idle = (floors: number[]) => floors.map((f) => `elevator.go_to_floor(${f})\n`).join('');

/** The reference solution of every challenge (web/src/elevator/challenges.ts). */
const REFERENCE: Record<string, string> = {
  '1': idle([0, 1]),
  '2': idle([1, 0]),
  '3': idle([0, 1, 2]),
  '4': idle([0, 1, 2, 3]),
  '5': idle([3, 2, 1, 0]),
  '6': idle([0, 1, 2, 3]),
  '7': 'for floor in range(6):\n    elevator.go_to_floor(floor)\n',
  '8': 'for floor in range(20):\n    elevator.go_to_floor(floor)\n',
  '9': 'for floor in range(20):\n    if waiting(floor) > 0:\n        elevator.go_to_floor(floor)\nelevator.go_to_floor(0)\n',
};
/** The challenges by the number they are shown with; they are stored by their UUID. */
const IDS = Object.keys(REFERENCE);
const uuid = (n: string) => CHALLENGES[Number(n) - 1]!.id;

/** Opens Hydra Lift directly. */
async function openLift(page: Page) {
  await page.goto('/#/elevator');
  await expect(page.getByTestId('lift-list')).toBeVisible();
}

/** Runs the program and skips the playback (and a crash) to the verdict. */
async function runAndSkip(page: Page) {
  await page.getByTestId('lift-run').click();
  // A program that cannot start has no playback to skip.
  await page.getByTestId('lift-skip').click({ timeout: 1500 }).catch(() => {});
  await expect(page.getByTestId('lift-outcome')).toBeVisible();
}

/** Marks every challenge before `id` as solved, so `id` is open. */
async function unlockUpTo(page: Page, id: string) {
  await page.goto('/');
  await page.evaluate((ids) => {
    const challenges: Record<string, { passing: string }> = {};
    for (const x of ids) challenges[x] = { passing: '' };
    localStorage.setItem('pydra.v1.elevator', JSON.stringify({ challenges, solved: ids, misses: {}, runs: ids.length, wins: ids.length }));
  }, IDS.slice(0, IDS.indexOf(id)).map(uuid));
  await openLift(page);
}

/** Pauses the playback and goes back to its very start (right after starting, it may still be there: restart is then off). */
async function pauseAtStart(page: Page) {
  await page.getByTestId('lift-play').click();
  const restart = page.getByTestId('lift-restart');
  if (await restart.isEnabled()) await restart.click();
}

const status = (page: Page, id: string) => page.getByTestId(`lift-challenge-${id}`);

test('Hydra Lift is on Home; its list shows the buildings in order, only the first challenge open', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('start-elevator')).toContainText('Hydra-Aufzug');
  await page.getByTestId('start-elevator').click();
  await expect(page.getByTestId('lift-list')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hydra-Aufzug');
  await expect(page.locator('.lift-group-title > span')).toHaveText(['Das Gartenhaus', 'Die Schule', 'Das Hochhaus']);
  await expect(page.getByTestId('lift-building-progress-house')).toHaveText('0 von 3');
  await expect(status(page, '1')).toHaveAttribute('data-status', 'open');
  await expect(status(page, '2')).toBeDisabled();
});

test('the first challenge: two floors, the fixed line, and the solution is given to show the game', async ({ page }) => {
  await openLift(page);
  await page.getByTestId('lift-continue').click();
  await expect(page.getByTestId('lift-title')).toHaveText('1 · Hoch und runter');
  // The fixed line `elevator = elevators[0]` is applied but not shown.
  await expect(page.getByTestId('lift-prelude')).toHaveCount(0);
  await expect(page.getByTestId('lift-scene')).toContainText('Das Gartenhaus');
  await expect(page.getByTestId('lift-code')).toHaveValue(REFERENCE['1']!);
  await runAndSkip(page);
  await expect(page.getByTestId('lift-outcome')).toHaveAttribute('data-state', 'passed');
});

test('a program that never drives to a floor: the verdict says so once, in the result box', async ({ page }) => {
  await openLift(page);
  await status(page, '1').click();
  await page.getByTestId('lift-code').fill('elevator.go_to_floor(0)\n');
  await runAndSkip(page);
  await expect(page.getByTestId('lift-outcome')).toHaveAttribute('data-state', 'failed');
  await expect(page.getByTestId('lift-outcome')).toContainText('Die Zeit ist um: 0 von 5 Leuten');
  await expect(page.getByTestId('lift-hint')).toHaveText('Auf Etage 1 warten Leute, aber kein Aufzug hat dort gehalten.');
  // The mistake is shown once, in the result box: the goal box stays as it is.
  await expect(page.getByTestId('lift-goal')).not.toHaveClass(/met|missed/);
  await expect(page.getByTestId('lift-caption')).not.toContainText('Die Zeit ist um');
});

test('playback: the code is stepped through line by line, the running line marked', async ({ page }) => {
  await openLift(page);
  await status(page, '1').click();
  await page.getByTestId('lift-code').fill(REFERENCE['1']!);
  await page.getByTestId('lift-run').click();
  await pauseAtStart(page);
  const active = page.getByTestId('lift-listing').locator('li.active');
  const caption = page.getByTestId('lift-caption');
  // The run starts with line 1, which puts floor 0 on the list: the program waits there until the stop at 0 is over.
  await expect(active).toHaveText(/go_to_floor\(0\)/);
  await expect(caption).toHaveText('0 s: Der Aufzug elevator hat nichts zu tun. Dein Programm läuft von oben. Dein Code: elevator.go_to_floor(0).');
  await expect(page.getByTestId('lift-queue-0')).toHaveText('[0]');
  // The next step: the program goes on after the stop, with line 2; the elevator then drives to 1 with line 2 marked.
  for (let i = 0; i < 3 && !(await caption.textContent())!.includes('macht weiter'); i++) await page.getByTestId('lift-next-call').click();
  await expect(caption).toContainText('elevator hat in Etage 0 gehalten. Dein Programm macht weiter. Dein Code: elevator.go_to_floor(1).');
  await expect(active).toHaveText(/go_to_floor\(1\)/);
  await expect(page.getByTestId('lift-queue-0')).toHaveText('[1]');
  await page.getByTestId('lift-end').click();
  await expect(page.getByTestId('lift-outcome')).toHaveAttribute('data-state', 'passed');
  await expect(page.getByTestId('lift-stat-transported')).toHaveText('5');
});

test('playback: a for line shows the value of its loop variable, also after the stop the run waited for', async ({ page }) => {
  await unlockUpTo(page, '7');
  await status(page, '7').click();
  await page.getByTestId('lift-code').fill(REFERENCE['7']!);
  await page.getByTestId('lift-run').click();
  await pauseAtStart(page);
  const forLine = page.getByTestId('lift-listing').locator('li[data-line="1"] .robot-note-inline');
  const caption = page.getByTestId('lift-caption');
  await expect(forLine).toHaveText('floor = 0');
  // After the stop at 0 the run goes on: the loop goes to 1.
  for (let i = 0; i < 6 && !(await caption.textContent())!.includes('go_to_floor(1)'); i++) await page.getByTestId('lift-next-call').click();
  await expect(forLine).toHaveText('floor = 1');
});

test('code that cannot start says why, and nothing crashes', async ({ page }) => {
  await openLift(page);
  await status(page, '1').click();
  await page.getByTestId('lift-code').fill('elevator.go_to_floor(0)\ngo_to_floor(1)\n');
  await runAndSkip(page);
  await expect(page.getByTestId('lift-outcome')).toHaveText('go_to_floor() ist ein Befehl des Aufzugs: Schreib elevator.go_to_floor(…) (Zeile 2).');
  await expect(page.getByTestId('lift-listing').locator('li.error')).toHaveText(/go_to_floor\(1\)/);
  await expect(page.getByTestId('lift-car-0')).not.toHaveAttribute('data-state', 'crashed');
});

test('a Python error: stepping reaches the call that crashes, then the elevator crashes', async ({ page }) => {
  await openLift(page);
  await status(page, '1').click();
  await page.getByTestId('lift-code').fill('elevator.go_to_floor(0)\nelevator.go_to_floor(1)\n\ndef on_floor_button(floor):\n    elevator.go_to_floor("1")\n');
  await page.getByTestId('lift-run').click();
  await pauseAtStart(page);
  // Step until the building calls on_floor_button: the elevator is still standing.
  for (let i = 0; i < 30 && !(await page.getByTestId('lift-caption').textContent())!.includes('on_floor_button'); i++) await page.getByTestId('lift-next-call').click();
  await expect(page.getByTestId('lift-caption')).toContainText(/Das Haus ruft on_floor_button\(\d\) auf./);
  await expect(page.getByTestId('lift-listing').locator('li.active')).toHaveText(/go_to_floor\("1"\)/);
  await expect(page.getByTestId('lift-outcome')).toHaveCount(0);
  // On to the crash.
  await page.getByTestId('lift-next-call').click();
  await expect(page.getByTestId('lift-outcome')).toHaveText("Dein Aufzug ist abgestürzt: go_to_floor() braucht eine ganze Zahl, nicht '1' (Zeile 5).", { timeout: 5000 });
  await expect(page.getByTestId('lift-car-0')).toHaveAttribute('data-state', 'crashed');
  await expect(page.getByTestId('lift-listing').locator('li.error')).toHaveText(/go_to_floor\("1"\)/);
});

test('a floor that does not exist: the elevator drives there in its turn and crashes through the roof', async ({ page }) => {
  await openLift(page);
  await status(page, '1').click();
  await page.getByTestId('lift-code').fill('elevator.go_to_floor(1)\nelevator.go_to_floor(9)\n');
  await runAndSkip(page);
  await expect(page.getByTestId('lift-outcome')).toHaveText('Dein Aufzug ist abgestürzt: Eine Etage 9 gibt es nicht, das Haus geht nur bis 1. Der Aufzug ist durchs Dach gekracht (Zeile 2).');
  await expect(page.getByTestId('lift-listing').locator('li.error')).toHaveText(/go_to_floor\(9\)/);
});

test('8, twenty floors: it opens with the loop from 7, which never reaches the floors above 5', async ({ page }) => {
  await unlockUpTo(page, '8');
  await status(page, '8').click();
  await expect(page.getByTestId('lift-title')).toHaveText('8 · Zwanzig Etagen');
  await page.getByTestId('lift-code').fill(REFERENCE['7']!);
  await runAndSkip(page);
  await expect(page.getByTestId('lift-outcome')).toHaveAttribute('data-state', 'failed');
  await expect(page.getByTestId('lift-outcome')).toContainText('Die Zeit ist um');
});

test('all challenges with their reference solutions: each passes, opens the next and fills its building', async ({ page }) => {
  test.setTimeout(90_000);
  await openLift(page);
  for (const id of IDS) {
    await status(page, id).click();
    await expect(page.getByTestId('lift-title')).toContainText(`${id} ·`);
    await page.getByTestId('lift-code').fill(REFERENCE[id]!);
    await runAndSkip(page);
    await expect(page.getByTestId('lift-outcome')).toHaveAttribute('data-state', 'passed');
    await expect(page.getByTestId('lift-goal')).toHaveClass(/met/);
    await page.getByTestId('lift-back').click();
    await expect(status(page, id)).toHaveAttribute('data-status', 'solved');
  }
  await expect(page.getByTestId('lift-building-progress-highrise')).toHaveText('3 von 3');
  const progress = (await stored(page, 'elevator')) as { solved: string[] };
  expect(progress.solved).toEqual(IDS.map(uuid));
  const points = (await stored(page, 'points')) as { awarded: string[] };
  expect(points.awarded).toContain(`l:elevator:${uuid('9')}`);
});
