import { describe, expect, it } from 'vitest';
import { makeContent } from '../content/lessons.ts';
import { FeedbackQueue } from './queue.ts';
import { AppStorage, MemoryKeyValue } from '../storage.ts';
import type { SendResult } from './client.ts';

const newStorage = (kv = new MemoryKeyValue()) => new AppStorage(kv, makeContent([], []));

function fakeServer() {
  const server = { online: true, received: [] as string[] };
  const send = async (text: string): Promise<SendResult> => {
    if (!server.online) return 'network';
    server.received.push(text);
    return 'sent';
  };
  return { server, send };
}

describe('feedback queue', () => {
  it('sends directly when online', async () => {
    const { server, send } = fakeServer();
    const q = new FeedbackQueue(newStorage(), send);
    expect(await q.submit('hi')).toBe('sent');
    expect(server.received).toEqual(['hi']);
    expect(q.pending).toBe(0);
  });

  it('queues while offline and delivers in order after reconnecting', async () => {
    const { server, send } = fakeServer();
    const kv = new MemoryKeyValue();
    server.online = false;
    const q = new FeedbackQueue(newStorage(kv), send);
    const counts: number[] = [];
    q.subscribe((n) => counts.push(n));
    expect(await q.submit('one')).toBe('queued');
    expect(await q.submit('two')).toBe('queued');
    expect(q.pending).toBe(2);
    expect(counts).toEqual([1, 2]);

    server.online = true;
    // e.g. after a reload: a new queue on the same storage
    const q2 = new FeedbackQueue(newStorage(kv), send);
    await q2.flush();
    expect(server.received).toEqual(['one', 'two']);
    expect(q2.pending).toBe(0);
  });

  it('keeps order: new feedback waits behind queued feedback', async () => {
    const { server, send } = fakeServer();
    const q = new FeedbackQueue(newStorage(), send);
    server.online = false;
    await q.submit('old');
    server.online = true;
    expect(await q.submit('new')).toBe('sent');
    expect(server.received).toEqual(['old', 'new']);
  });

  it('stops at the first network failure and keeps the rest', async () => {
    const storage = newStorage();
    storage.setFeedbackQueue(['a', 'b', 'c']);
    const sent: string[] = [];
    const q = new FeedbackQueue(storage, async (text) => {
      if (text === 'b') return 'network';
      sent.push(text);
      return 'sent';
    });
    await q.flush();
    expect(sent).toEqual(['a']);
    expect(storage.feedbackQueue()).toEqual(['b', 'c']);
  });

  it('drops entries the server rejects', async () => {
    const storage = newStorage();
    storage.setFeedbackQueue(['bad', 'good']);
    const received: string[] = [];
    const q = new FeedbackQueue(storage, async (text) => {
      if (text === 'bad') return 'rejected';
      received.push(text);
      return 'sent';
    });
    await q.flush();
    expect(received).toEqual(['good']);
    expect(q.pending).toBe(0);
  });

  it('keeps entries when rate-limited', async () => {
    const storage = newStorage();
    storage.setFeedbackQueue(['one', 'two']);
    const q = new FeedbackQueue(storage, async () => 'rate-limited');
    await q.flush();
    expect(storage.feedbackQueue()).toEqual(['one', 'two']);
  });

  it('runs one flush at a time', async () => {
    const storage = newStorage();
    storage.setFeedbackQueue(['x']);
    const received: string[] = [];
    const q = new FeedbackQueue(storage, async (text) => {
      received.push(text);
      return 'sent';
    });
    await Promise.all([q.flush(), q.flush()]);
    expect(received).toEqual(['x']);
  });
});
