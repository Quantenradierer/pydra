import { expect, test } from '@playwright/test';
import { FEEDBACK_TOKEN } from './paths.mjs';
import { waitForServiceWorker } from './helpers.ts';

async function storedFeedback(request: import('@playwright/test').APIRequestContext) {
  const res = await request.get('/api/feedback', { headers: { authorization: `Bearer ${FEEDBACK_TOKEN}` } });
  expect(res.ok()).toBe(true);
  return ((await res.json()) as { text: string }[]).map((e) => e.text);
}

test('sends feedback from the speech-bubble screen', async ({ page, request }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Feedback' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Feedback');
  const send = page.getByRole('button', { name: 'Senden' });
  await expect(send).toBeDisabled();

  const text = `Tolle App ${Date.now()} 🐍`;
  await page.fill('textarea', text);
  await expect(page.locator('.count')).toHaveText(`${[...text].length}/2000`);
  await send.click();
  await expect(page.getByTestId('feedback-result')).toHaveText('Danke! Dein Feedback ist angekommen.');
  await expect(page.locator('textarea')).toHaveValue('');
  expect(await storedFeedback(request)).toContain(text);

  await page.fill('textarea', 'x'.repeat(2001));
  await expect(page.locator('.meta')).toContainText('Höchstens 2000 Zeichen.');
  await expect(send).toBeDisabled();

  await page.getByRole('button', { name: 'Zurück' }).click();
  await expect(page.getByTestId('start-mixed')).toBeVisible();
});

test('delivers feedback written offline after reconnecting', async ({ page, context, request }) => {
  await page.goto('/#/feedback');
  await waitForServiceWorker(page);
  const texts = [`offline one ${Date.now()}`, `offline two ${Date.now()}`];

  await context.setOffline(true);
  for (const text of texts) {
    await page.fill('textarea', text);
    await page.getByRole('button', { name: 'Senden' }).click();
    await expect(page.getByTestId('feedback-result')).toHaveText(/Gerade keine Verbindung/);
  }
  await expect(page.getByTestId('feedback-pending')).toHaveText('2 Feedbacks warten auf den Versand.');

  const delivered = page.waitForResponse((r) => r.url().endsWith('/api/feedback') && r.status() === 201);
  await context.setOffline(false);
  await delivered;
  await expect(page.getByTestId('feedback-pending')).toBeHidden();

  const stored = await storedFeedback(request);
  // Newest first: sent in the order they were written.
  expect(stored.indexOf(texts[1]!)).toBeLessThan(stored.indexOf(texts[0]!));
  expect(stored.indexOf(texts[0]!)).toBeGreaterThanOrEqual(0);
});
