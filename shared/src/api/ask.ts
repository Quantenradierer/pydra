/** POST /api/ask: chat with a tutor about one quiz question. */

export const ASK_PATH = '/api/ask';

/** Payload size caps. Request-rate caps are server-side (ASK_RATE_LIMIT, ASK_DAILY_LIMIT). */
export const ASK_LIMITS = {
  /** Characters of one chat message. */
  message: 2000,
  /** Messages in the conversation so far. */
  messages: 40,
  /** Characters of the prompt, the code, the explanation and each choice. */
  questionText: 4000,
  choices: 8,
  /** Bytes of the whole request body. */
  body: 64 * 1024,
} as const;

export interface AskMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AskQuestion {
  prompt: string;
  code?: string;
  choices: string[];
  /**
   * Only sent once the question is answered: the right answer must not leak
   * before that. `picked` and `correct` index into `choices`.
   */
  answered?: { picked: number; correct: number; explanation: string };
}

export interface AskRequest {
  lang: 'de' | 'en';
  question: AskQuestion;
  /** The conversation so far; the last message is the user's new one. */
  messages: AskMessage[];
}

export type AskErrorCode = 'invalid' | 'too-long' | 'not-configured' | 'rate-limited' | 'upstream';

export interface AskError {
  error: AskErrorCode;
}

const isString = (v: unknown, max: number): v is string => typeof v === 'string' && [...v].length <= max;
const isIndex = (v: unknown, n: number): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < n;

/** Checks a request body; returns it typed or an error code. */
export function validateAsk(body: unknown): AskRequest | AskError {
  const invalid: AskError = { error: 'invalid' };
  if (typeof body !== 'object' || body === null) return invalid;
  const { lang, question: q, messages } = body as Record<string, unknown>;
  if (lang !== 'de' && lang !== 'en') return invalid;
  if (typeof q !== 'object' || q === null) return invalid;
  const { prompt, code, choices, answered } = q as Record<string, unknown>;
  if (typeof prompt !== 'string' || !Array.isArray(choices) || !Array.isArray(messages)) return invalid;
  if (choices.length === 0 || choices.length > ASK_LIMITS.choices) return invalid;
  if (messages.length === 0 || messages.length > ASK_LIMITS.messages) return invalid;
  if (code !== undefined && typeof code !== 'string') return invalid;

  const lengths = [prompt, code ?? '', ...choices];
  if (!lengths.every((s) => typeof s === 'string')) return invalid;
  if (!lengths.every((s) => isString(s, ASK_LIMITS.questionText))) return { error: 'too-long' };

  let ok: AskQuestion['answered'];
  if (answered !== undefined) {
    if (typeof answered !== 'object' || answered === null) return invalid;
    const { picked, correct, explanation } = answered as Record<string, unknown>;
    if (!isIndex(picked, choices.length) || !isIndex(correct, choices.length) || typeof explanation !== 'string') {
      return invalid;
    }
    if (!isString(explanation, ASK_LIMITS.questionText)) return { error: 'too-long' };
    ok = { picked, correct, explanation };
  }

  const checked: AskMessage[] = [];
  for (const m of messages) {
    if (typeof m !== 'object' || m === null) return invalid;
    const { role, content } = m as Record<string, unknown>;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') return invalid;
    if (content.trim().length === 0) return invalid;
    if (!isString(content, ASK_LIMITS.message * (role === 'assistant' ? 4 : 1))) return { error: 'too-long' };
    checked.push({ role, content });
  }
  if (checked.at(-1)!.role !== 'user') return invalid;

  return {
    lang,
    question: {
      prompt,
      ...(code === undefined ? {} : { code }),
      choices: choices as string[],
      ...(ok ? { answered: ok } : {}),
    },
    messages: checked,
  };
}
