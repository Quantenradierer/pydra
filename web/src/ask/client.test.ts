import { describe, expect, it } from 'vitest';
import type { AskRequest } from '@pydra/shared';
import { askTutor } from './client.ts';

const req: AskRequest = {
  lang: 'de',
  question: { prompt: 'p', choices: ['a', 'b'] },
  messages: [{ role: 'user', content: 'hi' }],
};

const streaming = (...chunks: string[]) =>
  (async () =>
    new Response(
      new ReadableStream({
        start(c) {
          for (const chunk of chunks) c.enqueue(new TextEncoder().encode(chunk));
          c.close();
        },
      }),
    )) as typeof fetch;

describe('ask client', () => {
  it('reports the growing text and succeeds', async () => {
    const seen: string[] = [];
    expect(await askTutor(req, (t) => seen.push(t), { fetchFn: streaming('Hal', 'lo') })).toBe('ok');
    expect(seen.at(-1)).toBe('Hallo');
    expect(seen[0]).toBe('Hal');
  });

  it('maps errors', async () => {
    const status = (s: number) => (async () => new Response('{}', { status: s })) as typeof fetch;
    expect(await askTutor(req, () => {}, { fetchFn: status(503) })).toBe('not-configured');
    expect(await askTutor(req, () => {}, { fetchFn: status(413) })).toBe('too-long');
    expect(await askTutor(req, () => {}, { fetchFn: status(429) })).toBe('rate-limited');
    expect(await askTutor(req, () => {}, { fetchFn: status(502) })).toBe('upstream');
    expect(await askTutor(req, () => {}, { fetchFn: streaming('') })).toBe('upstream');
  });

  it('reports network failures instead of throwing', async () => {
    const failing = (async () => {
      throw new TypeError('offline');
    }) as typeof fetch;
    expect(await askTutor(req, () => {}, { fetchFn: failing })).toBe('offline');
  });
});
