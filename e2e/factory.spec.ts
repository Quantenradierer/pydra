import { expect, test, type Page } from '@playwright/test';
import { stored } from './helpers.ts';

/** The reference solution of every lesson (web/src/factory/lessons.ts). */
const G3 = 'grab()\nif is_coal():\n    turn()\n    drop()\n    turn()\n    turn()\n    turn()\nelse:\n    turn()\n    turn()\n    drop()\n    turn()\n    turn()';
const REFERENCE: Record<string, string> = {
  G1: 'grab()\nturn()\nturn()\ndrop()',
  G2: 'grab()\nturn()\nturn()\ndrop()\nturn()\nturn()',
  G3,
  G4: `def feed():\n${G3.replace(/^/gm, '    ')}\n\nfeed()`,
  S1: 'smelt()',
  S2: 'if ore >= 2:\n    smelt()',
  S3: 'if ore >= 2 and coal >= 1:\n    smelt()',
  S4: 'def make_plate(ore, coal):\n    if ore >= 2 and coal >= 1:\n        smelt()\n\nmake_plate(ore, coal)',
  B1: 'feed()\nfeed()\nfeed()\nmake_plate(ore, coal)',
  B2: 'for i in range(n):\n    feed()\n    feed()\n    feed()\n    make_plate(ore, coal)',
  B3: 'def make_plates(n):\n    for i in range(n):\n        feed()\n        feed()\n        feed()\n        make_plate(ore, coal)\n\nmake_plates(n)',
};

/** Opens Hydra Works directly (it is not listed on Home yet). */
async function openFactory(page: Page) {
  await page.goto('/#/factory');
  await expect(page.getByTestId('factory-map')).toBeVisible();
}

/** Runs the program and skips the playback to the verdict. */
async function runAndSkip(page: Page) {
  await page.getByTestId('factory-run').click();
  // A very short run may end before the skip button is pressed.
  await page.getByTestId('factory-skip').click({ timeout: 1500 }).catch(() => {});
  await expect(page.getByTestId('factory-outcome')).toBeVisible();
}

async function solve(page: Page, id: string) {
  await page.getByTestId(`factory-lesson-${id}`).click();
  await expect(page.getByTestId('factory-title')).toContainText(id);
  await page.getByTestId('factory-code').fill(REFERENCE[id]!);
  await runAndSkip(page);
  await expect(page.getByTestId('factory-outcome')).toHaveAttribute('data-state', 'passed');
  await expect(page.getByTestId('factory-order')).toHaveClass(/met/);
  await expect(page.getByTestId('factory-next')).toBeVisible();
  await page.getByTestId('factory-back').click();
  await expect(page.getByTestId(`factory-lesson-${id}`)).toHaveAttribute('data-status', 'solved');
}

const status = (page: Page, id: string) => page.getByTestId(`factory-lesson-${id}`);

test('Hydra Works is hidden on Home, but its route works when opened directly', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('start-factory')).toHaveCount(0);
  await openFactory(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hydra-Werk');
  await expect(status(page, 'G1')).toHaveAttribute('data-status', 'open');
  await expect(status(page, 'S1')).toHaveAttribute('data-status', 'open');
  // A locked node is focusable and says why (aria-disabled, not disabled).
  await expect(status(page, 'B1')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByTestId('factory-state-B1')).toHaveText('braucht G4 + S4');
});

test('all eleven lessons with their reference solutions: each passes and opens the next', async ({ page }) => {
  test.setTimeout(90_000);
  await openFactory(page);
  const branches: [string, string][] = [
    ['G1', 'G2'],
    ['G2', 'G3'],
    ['G3', 'G4'],
    ['G4', ''],
    ['S1', 'S2'],
    ['S2', 'S3'],
    ['S3', 'S4'],
    ['S4', 'B1'],
    ['B1', 'B2'],
    ['B2', 'B3'],
    ['B3', ''],
  ];
  for (const [id, next] of branches) {
    if (next) await expect(status(page, next)).toHaveAttribute('data-status', 'locked');
    await solve(page, id);
    if (next) await expect(status(page, next)).toHaveAttribute('data-status', 'open');
    // B1 needs both machines: after G4 alone it stays locked.
    if (id === 'G4') await expect(status(page, 'B1')).toHaveAttribute('data-status', 'locked');
  }
  const progress = (await stored(page, 'factory')) as { solved: string[] };
  expect(progress.solved).toEqual(['G1', 'G2', 'G3', 'G4', 'S1', 'S2', 'S3', 'S4', 'B1', 'B2', 'B3']);
  // The name plates of the solved machines stand on the block; points arrived.
  await page.getByTestId('factory-lesson-B3').click();
  await expect(page.getByTestId('factory-name-feed')).toBeVisible();
  await expect(page.getByTestId('factory-name-make_plate')).toBeVisible();
  await expect(page.getByTestId('factory-name-block')).toBeVisible();
  expect(((await stored(page, 'points')) as { awarded: string[] }).awarded.filter((a) => a.startsWith('l:factory:'))).toHaveLength(11);
});

test('a failing run: G2 starts with the G1 code, the second ore stays on the belt', async ({ page }) => {
  await openFactory(page);
  await solve(page, 'G1');
  await page.getByTestId('factory-lesson-G2').click();
  await expect(page.getByTestId('factory-code')).toHaveValue(REFERENCE.G1!);
  await runAndSkip(page);
  await expect(page.getByTestId('factory-outcome')).toHaveAttribute('data-state', 'failed');
  // The verdict names what is short: the second ore is still on the belt.
  await expect(page.getByTestId('factory-outcome')).toHaveText('Das Programm ist fertig, aber der Auftrag ist nicht erfüllt. Noch auf dem Band: 1 Erz. Der Greifer hat es nicht genommen.');
  await expect(page.getByTestId('factory-belt')).toHaveAttribute('data-count', '1');
  await expect(page.getByTestId('factory-heaps')).toHaveAttribute('data-ore', '1');
  await expect(page.getByTestId('factory-order')).not.toHaveClass(/met/);
  await page.getByTestId('factory-back').click();
  await expect(status(page, 'G3')).toHaveAttribute('data-status', 'locked');
});

test('an error run: the message appears and its line is highlighted', async ({ page }) => {
  await openFactory(page);
  await page.getByTestId('factory-lesson-G1').click();
  await page.getByTestId('factory-code').fill('grab()\nturn()\ndrop()');
  await runAndSkip(page);
  await expect(page.getByTestId('factory-outcome')).toHaveText('Erz gehört nicht in den Kohlebunker (Zeile 3).');
  // The reason is shown once (the verdict); the caption only says where the run stops.
  await expect(page.getByTestId('factory-caption')).toHaveText('Hier stoppt dein Programm.');
  await expect(page.getByText('Erz gehört nicht in den Kohlebunker')).toHaveCount(1);
  await expect(page.locator('[data-testid="factory-listing"] li.active')).toHaveAttribute('data-line', '3');
  await expect(page.locator('[data-testid="factory-listing"] li.error')).toHaveCount(1);
  await expect(page.getByTestId('factory-scene')).toHaveAttribute('data-error', 'bunker');
  // Changing the code brings the editor back with the text kept.
  await page.getByTestId('factory-improve').click();
  await expect(page.getByTestId('factory-code')).toHaveValue('grab()\nturn()\ndrop()');
});

test('stepping: one step per command, the grabber turns, the caption tells it', async ({ page }) => {
  await openFactory(page);
  await page.getByTestId('factory-lesson-G1').click();
  await page.getByTestId('factory-code').fill(REFERENCE.G1!);
  // The run starts paused on the block: ▶ plays it, → to the end.
  await page.getByTestId('factory-run').click();
  await expect(page.getByTestId('factory-play')).toHaveText('▶');
  await page.getByTestId('factory-end').click();
  await page.getByTestId('factory-restart').click();
  await expect(page.getByTestId('factory-grabber')).toHaveAttribute('data-facing', 'W');
  await page.getByTestId('factory-step').click();
  await expect(page.locator('[data-testid="factory-listing"] li.active')).toHaveAttribute('data-line', '1');
  await page.getByTestId('factory-step').click();
  await expect(page.getByTestId('factory-caption')).toHaveText('turn(): Der Greifer schaut jetzt nach Norden, zum Kohlebunker.');
  await expect(page.getByTestId('factory-grabber')).toHaveAttribute('data-facing', 'N');
});

test('B1 shows "Your machines": the passing feed and make_plate, read-only', async ({ page }) => {
  await openFactory(page);
  for (const id of ['G1', 'G2', 'G3', 'G4', 'S1', 'S2', 'S3', 'S4']) await solve(page, id);
  await page.getByTestId('factory-lesson-B1').click();
  const machines = page.getByTestId('factory-machines');
  await expect(machines).toBeVisible();
  await expect(machines.locator('summary')).toHaveText('Deine Maschinen');
  await machines.locator('summary').click();
  await expect(page.getByTestId('factory-machines-listing')).toContainText('def feed():');
  await expect(page.getByTestId('factory-machines-listing')).toContainText('def make_plate(ore, coal):');
  await expect(page.getByTestId('factory-code')).toHaveValue('');
  // A given command in the own code is refused.
  await page.getByTestId('factory-code').fill('grab()');
  await runAndSkip(page);
  await expect(page.getByTestId('factory-outcome')).toContainText('feed()');
});

test('a forgotten call in G4 is named in the verdict, not just "order not met"', async ({ page }) => {
  await openFactory(page);
  for (const id of ['G1', 'G2', 'G3']) await solve(page, id);
  await page.getByTestId('factory-lesson-G4').click();
  await page.getByTestId('factory-code').fill(`def feed():\n${G3.replace(/^/gm, '    ')}`);
  await runAndSkip(page);
  await expect(page.getByTestId('factory-outcome')).toHaveAttribute('data-state', 'failed');
  await expect(page.getByTestId('factory-outcome')).toHaveText('Du hast feed definiert, aber nie aufgerufen: Schreib feed() ganz links in eine Zeile unter der Funktion.');
});

test('a locked node is reached by keyboard and says why; clicking it does nothing', async ({ page }) => {
  await openFactory(page);
  const b1 = status(page, 'B1');
  await b1.focus();
  await expect(b1).toBeFocused();
  await expect(b1).toHaveAttribute('aria-label', /braucht G4 \+ S4/);
  // aria-disabled is not a disabled control for Playwright: the click is forced, and the map stays.
  await b1.click({ force: true });
  await expect(page.getByTestId('factory-map')).toBeVisible();
  await expect(page.getByTestId('factory-title')).toHaveCount(0);
});

test('the verdict names a forgotten make_plates() in B3 and the order sign stays off', async ({ page }) => {
  test.setTimeout(90_000);
  await openFactory(page);
  for (const id of ['G1', 'G2', 'G3', 'G4', 'S1', 'S2', 'S3', 'S4', 'B1', 'B2']) await solve(page, id);
  await page.getByTestId('factory-lesson-B3').click();
  // The B2 code: the blocks run it, but there is no make_plates(n) function.
  await page.getByTestId('factory-code').fill(REFERENCE.B2!);
  await runAndSkip(page);
  await expect(page.getByTestId('factory-outcome')).toHaveAttribute('data-state', 'failed');
  await expect(page.getByTestId('factory-outcome')).toContainText('make_plates fehlt');
  await expect(page.getByTestId('factory-order')).not.toHaveClass(/met/);
});

test('an empty program: the verdict says the ore is still on the belt', async ({ page }) => {
  await openFactory(page);
  await page.getByTestId('factory-lesson-G1').click();
  await page.getByTestId('factory-code').fill('');
  await runAndSkip(page);
  await expect(page.getByTestId('factory-outcome')).toContainText('Noch auf dem Band: 1 Erz');
});

test('the order sign is not green when the run ends in an error', async ({ page }) => {
  await openFactory(page);
  await solve(page, 'G1');
  await solve(page, 'G2');
  await solve(page, 'G3');
  await solve(page, 'G4');
  await page.getByTestId('factory-lesson-S1').click();
  // Two smelts: the first makes the plate the order asks for, the second has no ore left.
  await page.getByTestId('factory-code').fill('smelt()\nsmelt()');
  await runAndSkip(page);
  await expect(page.getByTestId('factory-outcome')).toHaveAttribute('data-state', 'failed');
  await expect(page.getByTestId('factory-order')).not.toHaveClass(/met/);
  await expect(page.getByText(/Der Ofen braucht 2 Erz/)).toHaveCount(1);
});

test('the feed() plate is not on the smelter lessons; the coal of G3 says it is in the smelter', async ({ page }) => {
  await openFactory(page);
  await solve(page, 'G1');
  await solve(page, 'G2');
  await page.getByTestId('factory-lesson-G3').click();
  await expect(page.getByTestId('factory-order')).toContainText('Kohle im Ofen (über den Bunker)');
  await expect(page.getByTestId('factory-label-ore')).toHaveText('Erz: 0');
  await expect(page.getByTestId('factory-label-coal')).toHaveText('Kohle: 0');
  await page.getByTestId('factory-back').click();
  await solve(page, 'G3');
  await solve(page, 'G4');
  await page.getByTestId('factory-lesson-S1').click();
  await expect(page.getByTestId('factory-name-feed')).toHaveCount(0);
});

test('the active line marker is light on dark (computed style)', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openFactory(page);
  await page.getByTestId('factory-lesson-G1').click();
  await page.getByTestId('factory-code').fill(REFERENCE.G1!);
  await page.getByTestId('factory-run').click();
  await page.getByTestId('factory-step').click();
  const active = page.locator('[data-testid="factory-listing"] li.active');
  await expect(active).toHaveAttribute('data-line', '1');
  const marker = await active.evaluate((li) => getComputedStyle(li, '::marker').color);
  const page_bg = await active.evaluate((li) => getComputedStyle(li).backgroundColor);
  expect(marker).toBe('rgb(231, 237, 244)');
  expect(page_bg).not.toBe(marker);
});

test('phone height: the block stays on screen while a line is highlighted (360x740)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await openFactory(page);
  await page.getByTestId('factory-lesson-G1').click();
  await page.getByTestId('factory-code').fill(REFERENCE.G1!);
  await page.getByTestId('factory-run').click();
  await page.getByTestId('factory-step').click();
  await page.getByTestId('factory-step').click();
  await expect(page.locator('[data-testid="factory-listing"] li.active')).toHaveAttribute('data-line', '2');
  const box = await page.getByTestId('factory-scene').boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(740);
  // The run button is still reachable at 360x400 (the keyboard is up): it can be scrolled to and clicked.
  await page.setViewportSize({ width: 360, height: 400 });
  await page.getByTestId('factory-skip').click();
  await expect(page.getByTestId('factory-outcome')).toBeVisible();
});

test('phone width: no horizontal scroll on the map and the lesson page', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await openFactory(page);
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(await overflow()).toBe(0);
  await page.getByTestId('factory-lesson-S1').click();
  await expect(page.getByTestId('factory-label-ore')).toHaveText('ore = 2');
  expect(await overflow()).toBe(0);
});
