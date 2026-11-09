import { expect, test, type Page } from '@playwright/test';
import { codeBox, fillCode, runFight, zone } from './helpers.ts';

/** The script editor's suggestions: popup while typing, insert bar, line numbers; on desktop (keys) and phone (taps). */

async function openFirstFight(page: Page) {
  await page.goto('/');
  await page.getByTestId('start-robot').click();
  await page.getByTestId('robot-step-first-contact').click();
  await zone(page, 'code');
}

for (const [device, viewport] of [
  ['phone', { width: 360, height: 640 }],
  ['desktop', { width: 1280, height: 800 }],
] as const) {
  test(`on a ${device}: line numbers and the insert bar`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openFirstFight(page);
    const box = await codeBox(page);
    await expect(page.getByTestId('robot-code-lines')).toContainText('1');
    await fillCode(page, 'forward()\nfire()\nwait()');
    await expect(page.getByTestId('robot-code-lines')).toContainText('3');

    // The bar is always open: pick a group by what the gear offers, tap a template.
    await expect(page.getByTestId('snippet-group-eyes')).toBeVisible();
    await expect(page.getByTestId('snippet-group-cannon')).toHaveCount(0);
    await fillCode(page, '');
    await page.getByTestId('snippet-group-flow').click();
    await page.getByTestId('snippet').filter({ hasText: /^for$/ }).click();
    await expect(box).toHaveValue('for i in range(3):\n    ');
    await page.getByTestId('snippet-group-move').click();
    await page.getByTestId('snippet').filter({ hasText: 'forward(1)' }).click();
    await expect(box).toHaveValue('for i in range(3):\n    forward()');
    await expect(box).toBeFocused();
    await expect(page.getByTestId('robot-code-lines')).toContainText('2');
    // The text reaches the saved script and runs.
    await fillCode(page, 'forward()\nfire()');
    await runFight(page);
    await expect(page.getByTestId('robot-outcome')).toContainText('Gewonnen!');
  });

  test(`on a ${device}: the popup completes parts, methods and keywords`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openFirstFight(page);
    const box = await codeBox(page);
    const popup = page.getByTestId('robot-code-suggest');
    await fillCode(page, '');
    await box.focus();

    // Typing a prefix opens the popup with the commands and a short description.
    await box.pressSequentially('fo');
    await expect(popup).toBeVisible();
    await expect(popup.getByRole('option').first()).toContainText('forward(steps)');
    await expect(popup.getByRole('option').first()).toContainText('fährt Felder vorwärts');
    // Esc closes it without touching the text.
    await page.keyboard.press('Escape');
    await expect(popup).toBeHidden();
    await expect(box).toHaveValue('fo');

    // Arrows move, Enter accepts (the caret sits behind the parentheses of a call without arguments, inside otherwise).
    await box.pressSequentially('r');
    await expect(popup.getByRole('option').first()).toContainText('forward(steps)');
    await page.keyboard.press('ArrowDown');
    await expect(popup.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await expect(box).toHaveValue('forward()');
    expect(await box.evaluate((e: HTMLTextAreaElement) => e.selectionStart)).toBe(8);

    // After a dot the methods of that part are offered; Tab accepts.
    await fillCode(page, '');
    await box.focus();
    await box.pressSequentially('\nblaster.');
    await expect(popup.getByRole('option')).toContainText(['blaster.fire()', 'blaster.is_charged()', 'blaster.cooldown()', 'blaster.mark()']);
    await page.keyboard.press('Tab');
    await expect(box).toHaveValue('\nblaster.fire()');

    // Local names and keywords; with the popup closed Tab indents again.
    await fillCode(page, 'count = 3\n');
    await box.focus();
    await box.press('Control+End');
    await box.pressSequentially('co');
    await expect(popup.getByRole('option').first()).toContainText('count');
    await page.keyboard.press('Escape');
    await box.press('Tab');
    await expect(box).toHaveValue('count = 3\nco    ');
  });
}

test('on a phone: tapping a suggestion accepts it, tapping elsewhere closes the popup', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await openFirstFight(page);
  const box = await codeBox(page);
  await fillCode(page, '');
  await box.focus();
  await box.pressSequentially('see');
  const popup = page.getByTestId('robot-code-suggest');
  await expect(popup).toBeVisible();
  const bb = await popup.boundingBox();
  expect(bb!.x).toBeGreaterThanOrEqual(0);
  expect(bb!.x + bb!.width).toBeLessThanOrEqual(360);
  await popup.getByRole('option').filter({ hasText: 'see_left()' }).tap();
  await expect(box).toHaveValue('see_left()');
  await expect(popup).toBeHidden();
  await box.pressSequentially('\nwh');
  await expect(popup).toBeVisible();
  await page.getByTestId('robot-run').evaluate((b) => (b as HTMLElement).focus());
  await expect(popup).toBeHidden();
});

test('in English: suggestions and the bar are translated', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pydra.v1.language', JSON.stringify('en')));
  await page.setViewportSize({ width: 1280, height: 800 });
  await openFirstFight(page);
  const box = await codeBox(page);
  await fillCode(page, '');
  await box.focus();
  await box.pressSequentially('fo');
  await expect(page.getByTestId('robot-code-suggest').getByRole('option').first()).toContainText('drives tiles forward');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('snippet-group-compare')).toHaveText('Comparisons');
});

for (const [device, viewport] of [
  ['phone', { width: 360, height: 740 }],
  ['desktop', { width: 1280, height: 800 }],
] as const) {
  test(`on a ${device}: the help is visible on load, and a fresh line suggests the next commands`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openFirstFight(page);
    const inView = async (id: string) => {
      const el = page.getByTestId(id);
      await expect(el).toBeVisible();
      const bb = (await el.boundingBox())!;
      expect(bb.y + bb.height).toBeLessThanOrEqual(viewport.height);
    };
    await inView('robot-code-bar');
    await inView('robot-code-hint');
    await expect(page.getByTestId('robot-code-hint')).toHaveText('Tippe oder tippe auf einen Baustein');
    await expect(page.getByTestId('robot-code-bar').locator('details')).toHaveCount(0);
    const help = page.getByTestId('robot-code-help');
    await expect(help).toBeVisible();
    await expect(help).toContainText('Hilfe: Befehle');
    await expect(help).toContainText('forward(steps)');
    await expect(help).toContainText('fährt Felder vorwärts');
    const chip = (await page.getByTestId('snippet').first().boundingBox())!;
    expect(chip.height).toBeGreaterThanOrEqual(44);

    // Entering the editor on an empty script, and a new line, open the popup by themselves; Enter still makes a new line.
    const box = await codeBox(page);
    const popup = page.getByTestId('robot-code-suggest');
    await fillCode(page, '');
    await page.getByTestId('robot-run').focus();
    await box.focus();
    await expect(popup).toBeVisible();
    await expect(popup.getByRole('option').first()).toContainText('forward(steps)');
    await box.pressSequentially('forward()\n');
    await expect(popup).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(box).toHaveValue('forward()\n\n');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(box).toHaveValue('forward()\n\nbackward()');
  });
}
