import { readdirSync, readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

const QUESTIONS_DIR = new URL('../web/src/content/questions/', import.meta.url);
/** Right answer (index into the unshuffled choices) by question id. */
const ANSWERS = new Map<string, number>(
  readdirSync(QUESTIONS_DIR).flatMap((file) =>
    (JSON.parse(readFileSync(new URL(file, QUESTIONS_DIR), 'utf8')) as { id: string; answerIndex: number }[]).map(
      (q) => [q.id, q.answerIndex] as const,
    ),
  ),
);

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
