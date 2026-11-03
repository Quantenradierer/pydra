import { postFeedback, type SendResult } from './client.ts';

export type SubmitResult = Exclude<SendResult, 'network'> | 'queued';

/** Where queued texts are kept; AppStorage (localStorage) in the app. */
export interface QueueStore {
  feedbackQueue(): string[];
  setFeedbackQueue(queue: string[]): void;
}

/**
 * Feedback that could not be sent (offline, server down) is kept in
 * localStorage and sent by flush(), e.g. when the connection returns.
 */
export class FeedbackQueue {
  private listeners = new Set<(pending: number) => void>();
  private flushing?: Promise<void>;

  constructor(
    private store: QueueStore,
    private send: (text: string) => Promise<SendResult> = postFeedback,
  ) {}

  get pending(): number {
    return this.store.feedbackQueue().length;
  }

  /** Calls the listener whenever the number of queued texts changes; returns an unsubscribe function. */
  subscribe(listener: (pending: number) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private save(queue: string[]) {
    this.store.setFeedbackQueue(queue);
    for (const listener of this.listeners) listener(queue.length);
  }

  async submit(text: string): Promise<SubmitResult> {
    await this.flush();
    if (this.pending === 0) {
      const result = await this.send(text);
      if (result !== 'network') return result;
    }
    this.save([...this.store.feedbackQueue(), text]);
    return 'queued';
  }

  /** Sends queued feedback in order; stops at the first network failure or rate limit. */
  flush(): Promise<void> {
    this.flushing ??= this.doFlush().finally(() => (this.flushing = undefined));
    return this.flushing;
  }

  private async doFlush() {
    while (this.pending > 0) {
      const result = await this.send(this.store.feedbackQueue()[0]!);
      if (result === 'network' || result === 'rate-limited') break;
      // 'sent', or 'rejected' (would never succeed): drop it.
      this.save(this.store.feedbackQueue().slice(1));
    }
  }
}
