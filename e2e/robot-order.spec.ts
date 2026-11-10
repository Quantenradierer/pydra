import { expect, test, type Page } from '@playwright/test';
import { startFight } from './helpers.ts';

/** rb21: one list of challenges (the level pills), one fight per challenge, the equipment row right under the pills, a short goal line. */

const SOLVED = ['first-contact', 'one-more-line', 'training-dummy'];

async function open(page: Page, step: string, lang: 'de' | 'en', solved = SOLVED) {
  await page.goto('/');
  await page.evaluate(([l, s]) => {
    localStorage.setItem('pydra.v1.language', JSON.stringify(l));
    localStorage.setItem('pydra.v1.robot', JSON.stringify({ solved: s, script: 'forward()\nfire()', runs: 1, wins: 1 }));
  }, [lang, solved] as const);
  await page.reload();
  await page.getByTestId('start-robot').click();
  await page.locator('details.robot-chapter').first().evaluate((d) => ((d as HTMLDetailsElement).open = true));
  await page.getByTestId(`robot-step-${step}`).click();
}

/** The elements of the task page from top to bottom, as the player meets them. */
const PARTS = [
  ['header', '.subpage-header'],
  ['challenge pills', '[data-testid="level-strip"]'],
  ['equipment', '[data-testid="robot-equipment"]'],
  ['goal', '[data-testid="robot-catch"]'],
  ['arena', '.rb-arena'],
  ['run controls', '.rb-controlrow'],
  ['script editor', '[data-testid="robot-code"]'],
  ['suggestion strip', '[data-testid="robot-code-strip"]'],
  ['primary button', '[data-testid="robot-run"]'],
] as const;

for (const lang of ['de', 'en'] as const) {
  test(`phone 360x740 (${lang}): header, pills, equipment, goal, arena, run controls, editor + strip, primary - top to bottom`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await open(page, 'one-more-line', lang);
    const tops: number[] = [];
    for (const [name, selector] of PARTS) {
      const box = await page.locator(selector).first().boundingBox();
      expect(box, name).not.toBeNull();
      tops.push(box!.y);
    }
    // (The pills share the header row with the back arrow, so they start at the same height.)
    for (let i = 1; i < tops.length; i++) expect(tops[i], `${PARTS[i]![0]} below ${PARTS[i - 1]![0]}`).toBeGreaterThanOrEqual(i === 1 ? tops[0]! : tops[i - 1]! + 1);
    // The same order in the DOM.
    const domOrder = await page.evaluate((selectors) => {
      const els = selectors.map((s) => document.querySelector(s)!);
      return els.every((e, i) => i === 0 || !!(els[i - 1]!.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING));
    }, PARTS.map((p) => p[1]));
    expect(domOrder).toBe(true);
    // Everything fits one screen: the page does not scroll before the fight.
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(740);
    // The goal is at most two lines.
    const goal = page.getByTestId('robot-catch');
    const { height, line } = await goal.evaluate((e) => ({ height: e.getBoundingClientRect().height, line: parseFloat(getComputedStyle(e).lineHeight) }));
    expect(height).toBeLessThanOrEqual(line * 2 + 1);
  });
}

test('desktop 1280x800: pills, equipment, goal, arena in this order; the editor and the primary button are on the right', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, 'one-more-line', 'de');
  const box = async (selector: string) => (await page.locator(selector).first().boundingBox())!;
  const [pills, equip, goal, arena, controls, editor, primary] = await Promise.all(PARTS.filter(([n]) => !['header', 'suggestion strip'].includes(n)).map(([, s]) => box(s)));
  expect(equip!.y).toBeGreaterThan(pills!.y);
  expect(goal!.y).toBeGreaterThan(equip!.y);
  expect(arena!.y).toBeGreaterThan(goal!.y);
  expect(controls!.y).toBeGreaterThan(arena!.y);
  expect(primary!.y).toBeGreaterThan(editor!.y);
  expect(editor!.x).toBeGreaterThan(arena!.x + arena!.width);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(800);
});

test('exactly one list of challenges, no list of fights, no fight counter - before, during and after the fight', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await open(page, 'one-more-line', 'de');
  await page.getByTestId('robot-code').fill('forward()\nfire()\nfire()');
  const check = async (when: string) => {
    await expect(page.getByTestId('level-strip'), when).toHaveCount(1);
    // The pills are the challenges of the chapter: one pill each, none of them a fight.
    const chapter = await page.evaluate(() => document.querySelectorAll('[data-testid="level-strip"] .level-dot').length);
    expect(chapter, when).toBeGreaterThanOrEqual(4);
    await expect(page.locator('.level-dot'), when).toHaveCount(chapter);
    await expect(page.locator('.rb-chips, .robot-layouts, .robot-queue, [data-testid^="robot-vq"], [data-testid^="robot-layout"]'), when).toHaveCount(0);
    const text = await page.locator('main.robot').innerText();
    expect(text, when).not.toMatch(/Kampf \d+ von|Fight \d+ of|Kämpfe|Spielfeld \d/);
  };
  await check('before');
  await startFight(page);
  await check('playing');
  await page.getByTestId('robot-skip').click();
  await expect(page.getByTestId('robot-outcome')).toContainText('Gewonnen!');
  await check('after');
});

test('the equipment row shows the equipped parts as small icons and opens the sheet', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await open(page, 'one-more-line', 'en');
  const row = page.getByTestId('robot-equipment');
  await expect(row.locator('svg')).toHaveCount(3);
  const beside = await page.getByTestId('robot-build-open').boundingBox();
  const pills = await page.getByTestId('level-strip').boundingBox();
  expect(beside!.y).toBeGreaterThan(pills!.y + pills!.height - 1);
  expect(beside!.y - (pills!.y + pills!.height)).toBeLessThan(20);
  await page.getByTestId('robot-build-open').click();
  await expect(page.locator('dialog[open]')).toBeVisible();
});

test('the pills of a chapter are 1..N in order, with no gaps, no dashed side pills and no bug hunts', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await open(page, 'training-dummy', 'de');
  const pills = page.locator('[data-testid="level-strip"] .level-dot');
  const n = await pills.count();
  expect(n).toBe(4);
  expect(await pills.allInnerTexts()).toEqual(Array.from({ length: n }, (_, i) => String(i + 1)));
  await expect(page.locator('.level-dot.side')).toHaveCount(0);
  // The map: every chapter counts its challenges, none is missing or extra.
  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  for (const [chapter, count] of [[0, 4], [1, 3], [2, 3]] as const) {
    const section = page.getByTestId(`robot-chapter-${chapter}`);
    await section.evaluate((d) => ((d as HTMLDetailsElement).open = true));
    await expect(section.locator('.level-dot')).toHaveCount(count);
    expect(await section.locator('.level-dot').allInnerTexts()).toEqual(Array.from({ length: count }, (_, i) => String(i + 1)));
  }
  expect(await page.getByText(/Fehlersuche|Sonderregel|Nebenmission/).count()).toBe(0);
});
