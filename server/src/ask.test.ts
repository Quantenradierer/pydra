import { describe, expect, it, vi } from 'vitest';
import type { AskRequest } from '@pydra/shared';
import { createApp } from './app.ts';
import { systemPrompt } from './ask.ts';

const SECRET = 'test-key-not-real';

const request = (over: Partial<AskRequest> = {}): AskRequest => ({
  lang: 'en',
  question: { prompt: 'What does print(1 + 1) show?', choices: ['1', '2', '11', 'Error'] },
  messages: [{ role: 'user', content: 'Why not 11?' }],
  ...over,
});

const sse = (...deltas: string[]) =>
  new Response(
    [...deltas.map((d) => `data: ${JSON.stringify({ choices: [{ delta: { content: d } }] })}\n\n`), 'data: [DONE]\n\n'].join(''),
    { headers: { 'content-type': 'text/event-stream' } },
  );

const post = (app: ReturnType<typeof createApp>, body: unknown) =>
  app.request('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('POST /api/ask', () => {
  it('answers 503 when no key is configured', async () => {
    const fetchMock = vi.fn();
    const res = await post(createApp({ ask: { apiKey: '', fetch: fetchMock } }), request());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'not-configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('streams the answer as plain text and sends context to OpenAI', async () => {
    const fetchMock = vi.fn(async () => sse('Because ', '1 + 1 is ', 'a sum.'));
    const app = createApp({ ask: { apiKey: SECRET, model: 'm1', fetch: fetchMock as unknown as typeof fetch } });
    const res = await post(app, request());
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Because 1 + 1 is a sum.');

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${SECRET}`);
    const sent = JSON.parse(init.body as string);
    expect(sent.model).toBe('m1');
    expect(sent.stream).toBe(true);
    expect(sent.messages[0].role).toBe('system');
    expect(sent.messages[0].content).toContain('What does print(1 + 1) show?');
    expect(sent.messages.at(-1)).toEqual({ role: 'user', content: 'Why not 11?' });
  });

  const okFetch = (async () => sse('ok')) as unknown as typeof fetch;
  const fromIp = (app: ReturnType<typeof createApp>, ip: string) =>
    app.request('/api/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify(request()),
    });

  it('limits requests per client IP', async () => {
    const app = createApp({ ask: { apiKey: SECRET, rateLimit: 3, fetch: okFetch } });
    for (let i = 0; i < 3; i++) expect((await fromIp(app, '1.1.1.1')).status).toBe(200);
    const limited = await fromIp(app, '1.1.1.1');
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: 'rate-limited' });
    expect((await fromIp(app, '2.2.2.2')).status).toBe(200);
  });

  it('applies a global daily cap across clients and frees it after 24 hours', async () => {
    let time = new Date('2026-01-01T00:00:00Z');
    const app = createApp({ now: () => time, ask: { apiKey: SECRET, dailyLimit: 2, fetch: okFetch } });
    expect((await fromIp(app, '1.1.1.1')).status).toBe(200);
    expect((await fromIp(app, '2.2.2.2')).status).toBe(200);
    expect((await fromIp(app, '3.3.3.3')).status).toBe(429);
    time = new Date('2026-01-02T00:00:01Z');
    expect((await fromIp(app, '3.3.3.3')).status).toBe(200);
  });

  it('maps upstream failures to 502 without leaking details', async () => {
    const fail = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bad = createApp({ ask: { apiKey: SECRET, fetch: (async () => new Response('{"error":"nope"}', { status: 401 })) as unknown as typeof fetch } });
    const res = await post(bad, request());
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'upstream' });
    const down = createApp({ ask: { apiKey: SECRET, fetch: (async () => { throw new Error('offline'); }) as unknown as typeof fetch } });
    expect((await post(down, request())).status).toBe(502);
    expect(JSON.stringify(fail.mock.calls)).not.toContain(SECRET);
    fail.mockRestore();
  });

  it('rejects invalid and oversized payloads', async () => {
    const fetchMock = vi.fn();
    const app = createApp({ ask: { apiKey: SECRET, fetch: fetchMock } });
    expect((await post(app, { nope: 1 })).status).toBe(400);
    expect((await post(app, request({ messages: [] }))).status).toBe(400);
    expect((await post(app, request({ messages: [{ role: 'assistant', content: 'hi' }] }))).status).toBe(400);
    expect((await post(app, request({ messages: [{ role: 'user', content: 'x'.repeat(2001) }] }))).status).toBe(413);
    const huge = await post(app, request({ messages: [{ role: 'user', content: 'x'.repeat(100_000) }] }));
    expect(huge.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('systemPrompt', () => {
  it('does not reveal the answer before the question is answered', () => {
    const p = systemPrompt(request());
    expect(p).toContain('NOT answered');
    expect(p).not.toContain('right answer is');
  });

  it('includes the answer and explanation once answered', () => {
    const p = systemPrompt(
      request({ question: { ...request().question, answered: { picked: 0, correct: 1, explanation: 'Plus adds numbers.' } } }),
    );
    expect(p).toContain('They picked A; the right answer is B');
    expect(p).toContain('Plus adds numbers.');
  });
});
