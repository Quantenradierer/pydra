import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FeedbackEntry } from '@pydra/shared';
import { createApp } from './app.ts';
import { FeedbackStore } from './feedback-store.ts';
import { RateLimiter } from './rate-limit.ts';

const TOKEN = 'secret-token';

function setup(now = () => new Date('2026-10-31T12:00:00Z')) {
  const feedback = new FeedbackStore(':memory:');
  const app = createApp({ feedback, feedbackToken: TOKEN, now });
  const post = (text: unknown, ip = '1.2.3.4') =>
    app.request('/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify({ text }),
    });
  const list = (auth?: string) =>
    app.request('/api/feedback', { headers: auth ? { authorization: auth } : {} });
  return { app, post, list, feedback };
}

describe('POST /api/feedback', () => {
  it('stores the text with a server timestamp', async () => {
    const { post, list } = setup();
    const res = await post('Great app!');
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: 1, createdAt: '2026-10-31T12:00:00.000Z' });
    const entries = (await (await list(`Bearer ${TOKEN}`)).json()) as FeedbackEntry[];
    expect(entries).toEqual([{ id: 1, text: 'Great app!', createdAt: '2026-10-31T12:00:00.000Z' }]);
  });

  it('enforces the 2000-character limit', async () => {
    const { post } = setup();
    expect((await post('a'.repeat(2000))).status).toBe(201);
    const res = await post('a'.repeat(2001));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'too-long' });
  });

  it('rejects empty and malformed bodies', async () => {
    const { post, app } = setup();
    expect((await post('  ')).status).toBe(400);
    expect((await post(42)).status).toBe(400);
    const res = await app.request('/api/feedback', { method: 'POST', body: 'not json' });
    expect(res.status).toBe(400);
  });

  it('rejects huge bodies before parsing', async () => {
    const { post } = setup();
    expect((await post('a'.repeat(100_000))).status).toBe(413);
  });

  it('allows 5 posts per minute per IP', async () => {
    let t = Date.parse('2026-10-31T12:00:00Z');
    const { post } = setup(() => new Date(t));
    for (let i = 0; i < 5; i++) expect((await post(`n${i}`)).status).toBe(201);
    const limited = await post('sixth');
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: 'rate-limited' });
    // other IPs are unaffected
    expect((await post('other', '5.6.7.8')).status).toBe(201);
    // a minute later the first IP may post again
    t += 60_000;
    expect((await post('later')).status).toBe(201);
  });

  it('uses the address appended by the proxy, not a spoofed first entry', async () => {
    const { post } = setup();
    for (let i = 0; i < 5; i++) expect((await post('x', `${i}.0.0.1, 9.9.9.9`)).status).toBe(201);
    expect((await post('x', '7.7.7.7, 9.9.9.9')).status).toBe(429);
  });

  it('falls back to X-Real-IP when there is no X-Forwarded-For', async () => {
    const { app } = setup();
    const post = (ip: string) =>
      app.request('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-real-ip': ip },
        body: JSON.stringify({ text: 'hi' }),
      });
    for (let i = 0; i < 5; i++) expect((await post('4.4.4.4')).status).toBe(201);
    expect((await post('4.4.4.4')).status).toBe(429);
    expect((await post('6.6.6.6')).status).toBe(201);
  });
});

describe('GET /api/feedback', () => {
  it('rejects requests without a token', async () => {
    const { list } = setup();
    const res = await list();
    expect(res.status).toBe(401);
  });

  it('rejects a wrong token', async () => {
    const { list } = setup();
    expect((await list('Bearer nope')).status).toBe(401);
    expect((await list(TOKEN)).status).toBe(401);
  });

  it('is disabled when no token is configured', async () => {
    const app = createApp({ feedback: new FeedbackStore(':memory:'), feedbackToken: '' });
    expect((await app.request('/api/feedback', { headers: { authorization: 'Bearer ' } })).status).toBe(401);
  });

  it('returns JSON newest first with the right token', async () => {
    const { post, list } = setup();
    await post('first');
    await post('second');
    const res = await list(`Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const entries = (await res.json()) as FeedbackEntry[];
    expect(entries.map((e) => e.text)).toEqual(['second', 'first']);
  });
});

describe('feedback store', () => {
  it('keeps entries in the database file across reopen', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'fb-')), 'feedback.db');
    const a = new FeedbackStore(file);
    a.add('persisted', new Date());
    a.close();
    const b = new FeedbackStore(file);
    expect(b.list().map((e) => e.text)).toEqual(['persisted']);
    b.close();
  });
});

describe('rate limiter', () => {
  it('slides its window', () => {
    let t = 0;
    const r = new RateLimiter(2, 1000, () => t);
    expect([r.allow('a'), r.allow('a'), r.allow('a')]).toEqual([true, true, false]);
    t = 999;
    expect(r.allow('a')).toBe(false);
    t = 1000;
    expect(r.allow('a')).toBe(true);
  });
});
