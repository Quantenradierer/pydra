import { expect, test, type Page } from '@playwright/test';
import { fillCode, runFight, zone, type ZoneName } from './helpers.ts';

/**
 * Dead-control smoke test: visits the Robot Battler screens (task map, the work screen in every zone, with drawers and the
 * before and after a fight, challenges, Training Grounds) and presses every visible, enabled button and
 * summary once. A press must change something (the DOM, the route, a text field or the saved game); a control that
 * does nothing has to be disabled instead.
 */

const SOLVED = [
  'first-contact', 'one-more-line', 'training-dummy', 'corner-dummy', 'u-turn', 'twin-dummies', 'wall-dummy', 'obstacle-course',
  'hello-robot', 'far-dummy', 'armored-dummy', 'counter', 'sign-dummy', 'math-dummy', 'twin-armor', 'name-tag', 'calibrator',
  'tank-dummy', 'dummy-row', 'step-counter', 'after-the-loop', 'double-loop', 'dummy-army',
];
const BUILD = { chassis: 'medium', locomotion: 'wheels', gear: ['blaster', 'eyes'], addons: [], blasterMark: 1 };

/** Starts on the Robot Battler task map with the first 23 steps done (so challenges and the Training Grounds are open). */
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
      // The tab of the zone being shown is the current one, and what an open panel covers cannot be pressed at all.
      if (el.getAttribute('aria-current') === 'true') continue;
      el.scrollIntoView({ block: 'nearest' });
      const box = el.getBoundingClientRect();
      const top = document.elementFromPoint(box.left + box.width / 2, box.top + Math.min(box.height / 2, 20));
      if (top !== el && !el.contains(top)) continue;
      // The many task tiles all do the same; one representative is enough.
      if (el.dataset.testid?.startsWith('robot-step-') && document.querySelector('[data-smoke-step]')) continue;
      if (el.dataset.testid?.startsWith('robot-step-')) el.setAttribute('data-smoke-step', '1');
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

/** All the work-screen scenarios for the zones that are visible together (desktop) or one at a time (phone). */
async function workScreens(page: Page, zones: ZoneName[]) {
  for (const z of zones) {
    const at = async (fn?: () => Promise<void>) => {
      await openStep(page, 'one-more-line')();
      await zone(page, 'task');
      if (fn) await fn();
      await zone(page, z);
    };
    await press(page, `work ${z}`, () => at());
    // After a lost fight (the starter script is one line short) and after a win.
    const fought = (code: string) => async () => {
      await openStep(page, 'one-more-line')();
      await fillCode(page, code);
      await runFight(page);
      await expect(page.getByTestId('robot-outcome')).toHaveAttribute('data-state', /won|lost/);
      await zone(page, z);
    };
    if (z === 'fight') await press(page, `lost fight ${z}`, fought('forward()\nfire()'));
    if (z === 'task' || z === 'fight') await press(page, `won fight ${z}`, fought('forward()\nfire()\nfire()'));
    const openers: Record<ZoneName, string[]> = { task: [], robot: ['robot-build-open'], code: ['robot-api-open', 'robot-history-open'], fight: ['robot-vq-open', 'robot-more-open'] };
    for (const opener of openers[z]) {
      await press(page, `drawer ${opener}`, async () => {
        await fought('forward()\nfire()\nfire()')();
        await page.getByTestId(opener).click();
      });
    }
  }
}

test('desktop: no control of the Robot Battler screens is a no-op', async ({ page }) => {
  test.setTimeout(900_000);
  dead.length = 0;
  page.setDefaultTimeout(8000);
  await page.setViewportSize({ width: 1280, height: 800 });
  if (!process.env.SKIPMAP) await press(page, 'task map', () => start(page));
  if (!process.env.SKIPMAP) await press(page, 'task map, chapter folds open', async () => {
    await start(page);
    await page.getByTestId('robot-fold-done').first().locator('summary').click().catch(() => {});
  });
  await workScreens(page, ['task']);
  await press(page, 'training grounds', async () => {
    await start(page);
    await page.getByTestId('robot-training').click();
  });
  await press(page, 'training fight', async () => {
    await start(page);
    await page.getByTestId('robot-training').click();
    await page.getByTestId('robot-train-daily').click();
  });
  for (const id of ['ws-step', 'gl-foward', 'ws-square', 'cn-row-3']) {
    await press(page, `challenge ${id}`, openStep(page, id));
  }
  await press(page, 'challenge after a check', async () => {
    await openStep(page, 'ws-step')();
    await page.getByTestId('robot-check').click();
  });
  expect(dead, dead.join('\n')).toEqual([]);
});

test('phone: no control of the zoned work screen is a no-op', async ({ page }) => {
  test.setTimeout(900_000);
  dead.length = 0;
  page.setDefaultTimeout(8000);
  await page.setViewportSize({ width: 360, height: 740 });
  await workScreens(page, ['task', 'robot', 'code', 'fight']);
  expect(dead, dead.join('\n')).toEqual([]);
});
