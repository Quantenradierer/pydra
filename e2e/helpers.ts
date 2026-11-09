import { readdirSync, readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

const QUESTIONS_DIR = new URL('../web/src/content/questions/', import.meta.url);
const DIFF_DIR = new URL('../web/src/content/diff/', import.meta.url);
const DAILY_DIR = new URL('../web/src/content/daily/', import.meta.url);
const WALKTHROUGHS_DIR = new URL('../web/src/content/walkthroughs/', import.meta.url);
const readJson = (dir: URL) => readdirSync(dir).map((file) => JSON.parse(readFileSync(new URL(file, dir), 'utf8')) as unknown);

interface Walkthrough {
  id: string;
  lines: { line: number; answerIndex: number }[];
  whole: { answerIndex: number };
}

/** Right answer (index into the unshuffled choices) by question id; step ids as in walkthroughs.ts. */
const ANSWERS = new Map<string, number>([
  ...(readJson(QUESTIONS_DIR) as { id: string; answerIndex: number }[][]).flat().map((q) => [q.id, q.answerIndex] as const),
  ...(readJson(DIFF_DIR) as { id: string; answerIndex: number }[][]).flat().map((q) => [q.id, q.answerIndex] as const),
  ...(readJson(WALKTHROUGHS_DIR) as Walkthrough[]).flatMap((w) => [
    ...w.lines.map((s) => [`walk-${w.id}-${String(s.line).padStart(2, '0')}`, s.answerIndex] as const),
    [`walk-${w.id}-whole`, w.whole.answerIndex] as const,
  ]),
]);

/** Waits until a service worker controls the page (reloading once if needed). */
export async function waitForServiceWorker(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) {
    await page.reload();
    await page.evaluate(() => navigator.serviceWorker.ready);
  }
}

/** Answers the current question with the given choice (0-3); returns whether it was right. */
export async function answer(page: Page, slot = 0): Promise<boolean> {
  await page.locator('.choice').nth(slot).click();
  await expect(page.getByTestId('feedback')).toBeVisible();
  return (await page.locator('.choice.wrong').count()) === 0;
}

/** Reads a value from the app's localStorage namespace. */
export function stored(page: Page, key: string): Promise<unknown> {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(`pydra.v1.${k}`) ?? 'null'), key);
}

/** The choice slot of the current question's right answer, read from the saved session. */
export async function correctSlot(page: Page): Promise<number> {
  const session = (await stored(page, 'session')) as { index: number; items: { id: string; order: number[] }[] };
  const item = session.items[session.index]!;
  return item.order.indexOf(ANSWERS.get(item.id)!);
}

interface DailyJson {
  id: string;
  steps: { answerIndex: number }[];
}

/** Right answers of the daily challenge by question id (`daily-<snippet>-<n>`). */
const DAILY_ANSWERS = new Map<string, number>(
  (readJson(DAILY_DIR) as DailyJson[][]).flat().flatMap((s) => s.steps.map((st, i) => [`daily-${s.id}-${i + 1}`, st.answerIndex] as const)),
);

/** The choice slot of the current daily question's right answer, read from the saved run. */
export async function dailyCorrectSlot(page: Page): Promise<number> {
  const data = (await stored(page, 'daily')) as { run: { index: number; items: { id: string; order: number[] }[] } };
  const item = data.run.items[data.run.index]!;
  return item.order.indexOf(DAILY_ANSWERS.get(item.id)!);
}

/** Closes the open sheet (parts, more, help), if any: a modal sheet makes the page behind it inert. */
export async function closeSheets(page: Page) {
  while ((await page.locator('dialog[open]').count()) > 0) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(30);
  }
}

/** The script editor; after a fight the listing shows the run, a tap on it brings the editor back. */
export async function codeBox(page: Page) {
  await closeSheets(page);
  const code = page.getByTestId('robot-code');
  if (!(await code.isVisible())) await page.getByTestId('robot-view-toggle').click();
  return code;
}

export async function fillCode(page: Page, text: string) {
  await (await codeBox(page)).fill(text);
}

/** Presses "Kampf starten": the fight starts playing on the arena at once and the verdict is hidden until it ends. */
export async function startFight(page: Page) {
  await closeSheets(page);
  await page.getByTestId('robot-run').click();
}

/** Starts the fight and skips to its result ("Zum Ergebnis"), for tests that only care about the verdict. */
export async function runFight(page: Page) {
  await startFight(page);
  const skip = page.getByTestId('robot-skip');
  // A script with a typo shows its error instead of a fight.
  await skip.or(page.getByTestId('robot-error')).first().waitFor();
  if (await skip.isVisible()) {
    await skip.click();
    await expect(page.getByTestId('robot-outcome')).toBeVisible();
  }
}

/** Opens a sheet by its opener button and returns the sheet; close it with `closeSheets`. */
export async function openSheet(page: Page, opener: string) {
  await closeSheets(page);
  await page.getByTestId(opener).click();
  return page.locator('dialog[open]');
}
