import { expect, test, type Page } from '@playwright/test';
import { closeSheets, fillCode, runFight } from './helpers.ts';
import { CH0, CH1, CH2 } from './robot-ids.ts';

/**
 * Dead-control smoke test: visits the Robot Battler screens (task map, the task page with its sheets,
 * before and after a fight, challenges, Training Grounds) and presses every visible, enabled button and
 * summary once. A press must change something (the DOM, the route, a text field or the saved game); a control that
 * does nothing has to be disabled instead.
 */

const SOLVED = [...CH0, ...CH1, ...CH2];
const BUILD = { chassis: 'medium', locomotion: 'wheels', gear: ['blaster', 'eyes'], addons: [], blasterMark: 1 };

/** Starts on the Robot Battler task map with the first 19 challenges done (so the Training Grounds are open). */
async function start(page: Page, solved: string[] = SOLVED) {
  await page.addInitScript(([s, b]) => localStorage.setItem('pydra.v1.robot', JSON.stringify({ solved: s, script: 'forward()\nfire()', build: b, runs: 40, wins: 40 })), [solved, BUILD] as const);
  await page.goto('/');
  await page.getByTestId('start-robot').click();
  await expect(page.getByTestId('robot-map')).toBeVisible();
}

const snapshot = (page: Page) =>
  page.evaluate(() =>
    JSON.stringify([location.hash, document.querySelector('main')?.innerHTML, [...document.querySelectorAll('textarea,input')].map((e) => (e as HTMLInputElement).value), localStorage.getItem('pydra.v1.robot')]),
  );

/** Marks every visible, enabled, uncovered button / summary of the Robot Battler screen with data-smoke and returns their labels. */
const mark = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    document.querySelectorAll('[data-smoke],[data-smoke-step]').forEach((e) => (e.removeAttribute('data-smoke'), e.removeAttribute('data-smoke-step')));
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('main.robot button, main.robot summary')) {
      const style = getComputedStyle(el);
      if (el.getClientRects().length === 0 || style.visibility === 'hidden' || el.closest('[hidden]') || !el.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true })) continue;
      if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') continue;
      // The current level pill and already show what they are, and what an open sheet covers cannot be pressed at all.
      if (el.getAttribute('aria-current') === 'step') continue;
      el.scrollIntoView({ block: 'nearest' });
      const box = el.getBoundingClientRect();
      const top = document.elementFromPoint(box.left + box.width / 2, box.top + Math.min(box.height / 2, 20));
      if (top !== el && !el.contains(top)) continue;
      // The many task tiles and level pills all do the same; one representative is enough.
      const tile = el.dataset.testid?.startsWith('robot-step-') || el.dataset.testid?.startsWith('level-');
      if (tile && document.querySelector('[data-smoke-step]')) continue;
      if (tile) el.setAttribute('data-smoke-step', '1');
      el.setAttribute('data-smoke', String(out.length));
      out.push(`${el.dataset.testid ?? el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}"`);
    }
    return out;
  });

const dead: string[] = [];

/** Presses each marked control after `setup` has built the screen again, and records the ones that change nothing. */
async function press(page: Page, name: string, setup: () => Promise<void>) {
  await setup();
  const labels = await mark(page);
  expect(labels.length, `${name}: no controls found`).toBeGreaterThan(0);
  let fresh = true;
  for (let i = 0; i < labels.length; i++) {
    if (!fresh) {
      // A control that changed nothing (or only toggled something) leaves the screen as it was; only rebuild when the controls differ.
      if (JSON.stringify(await mark(page)) !== JSON.stringify(labels)) {
        await setup();
        await mark(page);
      }
    }
    fresh = false;
    const before = await snapshot(page);
    await page.locator(`[data-smoke="${i}"]`).click({ timeout: 4000 }).catch(() => dead.push(`${name}: ${labels[i]} cannot be clicked`));
    await page.waitForTimeout(120);
    if ((await snapshot(page)) === before) dead.push(`${name}: ${labels[i]}`);
  }
}

const openStep = (page: Page, id: string) => async () => {
  await start(page);
  const step = page.getByTestId(`robot-step-${id}`);
  await step.evaluate((el) => { for (let d = el.closest('details'); d; d = d.parentElement?.closest('details') ?? null) d.open = true; });
  await step.click();
};

/** All the scenarios of the task page: before a fight, after a lost and a won fight, and every sheet. */
async function workScreens(page: Page) {
  await press(page, 'task page', openStep(page, 'one-more-line'));
  // After a lost fight (the starter script is one line short) and after a win.
  const fought = (code: string) => async () => {
    await openStep(page, 'one-more-line')();
    await fillCode(page, code);
    await runFight(page);
    await expect(page.getByTestId('robot-outcome')).toHaveAttribute('data-state', /won|lost/);
  };
  await press(page, 'lost fight', fought('forward()\nfire()'));
  await press(page, 'won fight', fought('forward()\nfire()\nfire()'));
  // The two sheets: the equipment and the help (the help button belongs to the editor).
  for (const opener of ['robot-build-open', 'robot-code-more']) {
    await press(page, `sheet ${opener}`, async () => {
      await openStep(page, 'one-more-line')();
      await closeSheets(page);
      await page.getByTestId(opener).click();
    });
  }
}

test('desktop: no control of the Robot Battler screens is a no-op', async ({ page }) => {
  test.setTimeout(900_000);
  dead.length = 0;
  page.setDefaultTimeout(8000);
  await page.setViewportSize({ width: 1280, height: 800 });
  if (!process.env.SKIPMAP) await press(page, 'task map', () => start(page));
  if (!process.env.SKIPMAP) await press(page, 'task map, a finished chapter opened', async () => {
    await start(page);
    await page.getByTestId('robot-chapter-1').locator('summary').click();
  });
  await workScreens(page);
  await press(page, 'training grounds', async () => {
    await start(page);
    await page.getByTestId('robot-training').click();
  });
  await press(page, 'training fight', async () => {
    await start(page);
    await page.getByTestId('robot-training').click();
    await page.getByTestId('robot-train-daily').click();
  });
  await press(page, 'a later challenge', openStep(page, 'dummy-army'));
  await press(page, 'a later challenge after a fight', async () => {
    await openStep(page, 'dummy-army')();
    await runFight(page);
  });
  expect(dead, dead.join('\n')).toEqual([]);
});

test('phone: no control of the task page is a no-op', async ({ page }) => {
  test.setTimeout(900_000);
  dead.length = 0;
  page.setDefaultTimeout(8000);
  await page.setViewportSize({ width: 360, height: 740 });
  await workScreens(page);
  expect(dead, dead.join('\n')).toEqual([]);
});
