/** POST /api/feedback body. */
export interface FeedbackRequest {
  text: string;
}

/** A stored feedback entry, as returned by GET /api/feedback (newest first). */
export interface FeedbackEntry {
  id: number;
  text: string;
  /** ISO 8601 timestamp set by the server. */
  createdAt: string;
}

/** POST /api/feedback response (201). */
export type FeedbackCreated = Pick<FeedbackEntry, 'id' | 'createdAt'>;

/** Error body for 4xx responses. */
export interface ApiError {
  error: 'invalid' | 'too-long' | 'empty' | 'rate-limited' | 'unauthorized';
}

export const FEEDBACK_PATH = '/api/feedback';
export const FEEDBACK_MAX_LENGTH = 2000;

/** Checks a feedback body; returns the trimmed text or an error code. */
export function validateFeedback(body: unknown): { text: string } | ApiError {
  if (typeof body !== 'object' || body === null || typeof (body as FeedbackRequest).text !== 'string') {
    return { error: 'invalid' };
  }
  const text = (body as FeedbackRequest).text.trim();
  if (text.length === 0) return { error: 'empty' };
  if ([...text].length > FEEDBACK_MAX_LENGTH) return { error: 'too-long' };
  return { text };
}
