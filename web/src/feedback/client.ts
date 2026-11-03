import { FEEDBACK_PATH, type FeedbackRequest } from '@pydra/shared';

export type SendResult = 'sent' | 'rejected' | 'rate-limited' | 'network';

/** Posts one feedback text; never throws. */
export async function postFeedback(text: string, fetchFn: typeof fetch = fetch): Promise<SendResult> {
  try {
    const res = await fetchFn(FEEDBACK_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text } satisfies FeedbackRequest),
    });
    if (res.ok) return 'sent';
    if (res.status === 429) return 'rate-limited';
    if (res.status >= 500) return 'network';
    return 'rejected';
  } catch {
    return 'network';
  }
}
