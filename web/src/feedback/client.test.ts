import { describe, expect, it } from 'vitest';
import { postFeedback } from './client.ts';

const respond = (status: number) => (async () => new Response('{}', { status })) as typeof fetch;

describe('feedback client', () => {
  it('maps responses to results', async () => {
    expect(await postFeedback('hi', respond(201))).toBe('sent');
    expect(await postFeedback('hi', respond(400))).toBe('rejected');
    expect(await postFeedback('hi', respond(429))).toBe('rate-limited');
    expect(await postFeedback('hi', respond(502))).toBe('network');
  });

  it('reports network failures instead of throwing', async () => {
    const failing = (async () => {
      throw new TypeError('offline');
    }) as typeof fetch;
    expect(await postFeedback('hi', failing)).toBe('network');
  });

  it('posts JSON to /api/feedback', async () => {
    let request: [string, RequestInit] | undefined;
    const capture = (async (url: string, init: RequestInit) => {
      request = [url, init];
      return new Response('{}', { status: 201 });
    }) as unknown as typeof fetch;
    await postFeedback('hello', capture);
    expect(request![0]).toBe('/api/feedback');
    expect(JSON.parse(request![1].body as string)).toEqual({ text: 'hello' });
  });
});
