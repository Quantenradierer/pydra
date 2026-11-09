import { expect, test, type Page } from '@playwright/test';
import { codeBox, fillCode, runFight } from './helpers.ts';

/** The script editor: fixed height, ONE suggestion strip under it, the help sheet behind "?"; on desktop (keys) and phone (taps). */

async function openFirstFight(page: Page) {
  await page.goto('/');
  await page.getByTestId('start-robot').click();
  await page.getByTestId('robot-step-first-contact').click();
}

const strip = (page: Page) => page.getByTestId('robot-code-strip');
const chips = (page: Page) => page.getByTestId('strip-chip');

/** Scroll heights that must not change while the help is closed or the strip changes. */
const heights = (page: Page) =>
  page.evaluate(() => {
    const q = (s: string) => document.querySelector(s) as HTMLElement;
    return { doc: document.documentElement.scrollHeight, editor: q('.robot-editor').getBoundingClientRect().height };
  });

for (const [device, viewport] of [
  ['phone', { width: 360, height: 740 }],
  ['desktop', { width: 1280, height: 800 }],
] as const) {
  test(`on a ${device}: line numbers; the strip suggests the next templates and a tap inserts`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openFirstFight(page);
    const box = await codeBox(page);
    await expect(page.getByTestId('robot-code-lines')).toContainText('1');
    await fillCode(page, 'forward()\nfire()\nwait()');
    await expect(page.getByTestId('robot-code-lines')).toContainText('3');

    // Nothing is typed: the strip shows the next templates of the gear (moving, weapon, eyes, Python).
    await fillCode(page, '');
    await expect(chips(page).first()).toHaveText('forward(1)');
    await expect(chips(page).filter({ hasText: /^see\(\)$/ })).toHaveCount(1);
    await expect(chips(page).filter({ hasText: /^for$/ })).toHaveCount(1);
    await chips(page).filter({ hasText: /^for$/ }).click();
    await expect(box).toHaveValue('for i in range(3):\n    ');
    await chips(page).first().click();
    await expect(box).toHaveValue('for i in range(3):\n    forward()');
    await expect(box).toBeFocused();
    await expect(page.getByTestId('robot-code-lines')).toContainText('2');
    // The text reaches the saved script and runs.
    await fillCode(page, 'forward()\nfire()');
    await runFight(page);
    await expect(page.getByTestId('robot-outcome')).toContainText('Gewonnen!');
  });

  test(`on a ${device}: while typing the strip completes parts, methods and keywords (keys)`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openFirstFight(page);
    const box = await codeBox(page);
    await fillCode(page, '');
    await box.focus();

    await box.pressSequentially('fo');
    await expect(chips(page).first()).toHaveText('forward(steps)');
    await expect(strip(page)).toHaveAttribute('data-mode', 'complete');
    // Esc clears the completions (the strip falls back to the next templates) without touching the text.
    await page.keyboard.press('Escape');
    await expect(strip(page)).toHaveAttribute('data-mode', 'next');
    await expect(box).toHaveValue('fo');

    // Arrows move through the chips, Enter accepts (caret behind `()` of a call without arguments, inside otherwise).
    await box.pressSequentially('r');
    await expect(chips(page).first()).toHaveText('forward(steps)');
    await page.keyboard.press('ArrowDown');
    await expect(chips(page).nth(1)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await expect(box).toHaveValue('forward()');
    expect(await box.evaluate((e: HTMLTextAreaElement) => e.selectionStart)).toBe(8);

    // After a dot the methods of that part are offered; Tab accepts the first chip.
    await fillCode(page, '');
    await box.focus();
    await box.pressSequentially('\nblaster.');
    await expect(chips(page)).toHaveText(['blaster.fire()', 'blaster.is_charged()', 'blaster.cooldown()', 'blaster.mark()']);
    await page.keyboard.press('Tab');
    await expect(box).toHaveValue('\nblaster.fire()');

    // Local names; with the completions cleared Tab indents again.
    await fillCode(page, 'count = 3\n');
    await box.focus();
    await box.press('Control+End');
    await box.pressSequentially('co');
    await expect(chips(page).first()).toHaveText('count');
    await page.keyboard.press('Escape');
    await box.press('Tab');
    await expect(box).toHaveValue('count = 3\nco    ');
  });

  test(`on a ${device}: the editor has a fixed height and the strip is one row that never wraps`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openFirstFight(page);
    const box = await codeBox(page);
    await fillCode(page, '');
    const before = await heights(page);
    const row = (await strip(page).boundingBox())!;
    expect(row.height).toBeLessThanOrEqual(44);
    const first = (await chips(page).first().boundingBox())!;
    expect(first.height).toBeGreaterThanOrEqual(44 - 1);
    // Twenty lines: the text scrolls inside, nothing grows.
    await fillCode(page, Array.from({ length: 30 }, (_, i) => `wait()  # ${i}`).join('\n'));
    await box.focus();
    await box.pressSequentially('\nfo');
    await expect(strip(page)).toHaveAttribute('data-mode', 'complete');
    expect(await heights(page)).toEqual(before);
    expect((await strip(page).boundingBox())!.height).toBeLessThanOrEqual(44);
    // The strip scrolls sideways instead of wrapping.
    expect(await strip(page).evaluate((e) => e.scrollWidth >= e.clientWidth)).toBe(true);
    const ys = await chips(page).evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().y))).size);
    expect(ys).toBe(1);
    // Focusing opens nothing else: no dialog, no popup.
    await expect(page.getByTestId('robot-code-sheet')).toBeHidden();
    await expect(page.locator('.robot-suggest')).toHaveCount(0);
  });

  test(`on a ${device}: the help sheet holds the command list and all templates, opens and closes without moving the page`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openFirstFight(page);
    const box = await codeBox(page);
    await fillCode(page, '');
    const before = await heights(page);
    // The list is not inline.
    await expect(page.getByTestId('robot-code-help')).toBeHidden();
    await expect(page.getByTestId('robot-code-hint')).toHaveCount(0);

    const more = page.getByTestId('robot-code-more');
    await expect(more).toBeVisible();
    await more.click();
    const sheet = page.getByTestId('robot-code-sheet');
    await expect(sheet).toBeVisible();
    const bb = (await sheet.boundingBox())!;
    expect(bb.y + bb.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(bb.height).toBeLessThanOrEqual(viewport.height * 0.75);
    await expect(page.getByTestId('robot-code-help')).toContainText('forward(steps)');
    await expect(page.getByTestId('robot-code-help')).toContainText('fährt Felder vorwärts');
    await expect(page.getByTestId('snippet-group-eyes')).toBeVisible();
    await expect(page.getByTestId('snippet-group-cannon')).toHaveCount(0);
    // A tap on a command inserts and closes.
    await page.getByTestId('cmd').filter({ hasText: 'backward(steps)' }).click();
    await expect(sheet).toBeHidden();
    await expect(box).toHaveValue('backward()');
    expect(await box.evaluate((e: HTMLTextAreaElement) => e.selectionStart)).toBe(9);
    // Templates by group; Esc and the close button close without inserting.
    await box.press('Control+End');
    await more.click();
    await page.getByTestId('snippet-group-flow').click();
    await page.getByTestId('snippet').filter({ hasText: /^while$/ }).click();
    await expect(sheet).toBeHidden();
    await expect(box).toHaveValue('backward()\nwhile alive():\n    ');
    await more.click();
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await more.click();
    await page.getByTestId('robot-code-sheet-close').click();
    await expect(sheet).toBeHidden();
    await expect(box).toHaveValue('backward()\nwhile alive():\n    ');
    expect(await heights(page)).toEqual(before);
  });
}

test('on a phone: tapping a chip completes the word', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await openFirstFight(page);
  const box = await codeBox(page);
  await fillCode(page, '');
  await box.focus();
  await box.pressSequentially('see');
  await expect(strip(page)).toHaveAttribute('data-mode', 'complete');
  await chips(page).filter({ hasText: 'see_left()' }).tap();
  await expect(box).toHaveValue('see_left()');
  await expect(box).toBeFocused();
});

test('on a phone with the keyboard open (360x420) the editor and the strip stay in view together', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 420 });
  await openFirstFight(page);
  const box = await codeBox(page);
  await fillCode(page, 'forward()\nfire()');
  await box.focus();
  await box.pressSequentially('\nfo');
  await expect(chips(page).first()).toBeVisible();
  const e = (await box.boundingBox())!;
  const s = (await strip(page).boundingBox())!;
  expect(e.height).toBeGreaterThanOrEqual(60);
  expect(e.y).toBeGreaterThanOrEqual(0);
  expect(s.y + s.height).toBeLessThanOrEqual(420);
  expect(s.y).toBeGreaterThanOrEqual(e.y + e.height - 1);
  // The sheet fits above the keyboard as well and scrolls inside itself.
  await page.getByTestId('robot-code-more').click();
  const sb = (await page.getByTestId('robot-code-sheet').boundingBox())!;
  expect(sb.y).toBeGreaterThanOrEqual(0);
  expect(sb.y + sb.height).toBeLessThanOrEqual(421);
});

test('in English: the strip, the button and the sheet are translated', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pydra.v1.language', JSON.stringify('en')));
  await page.setViewportSize({ width: 1280, height: 800 });
  await openFirstFight(page);
  const box = await codeBox(page);
  await fillCode(page, '');
  await box.focus();
  await expect(page.getByTestId('robot-code-more')).toHaveText('?');
  await page.getByTestId('robot-code-more').click();
  await expect(page.getByTestId('robot-code-help')).toContainText('drives tiles forward');
  await expect(page.getByTestId('snippet-group-compare')).toHaveText('Comparisons');
});
