import type { AskRequest } from '@pydra/shared';

export const DEFAULT_MODEL = 'gpt-5-mini';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
export const DEFAULT_ASK_RATE_LIMIT = 30;
export const DEFAULT_ASK_DAILY_LIMIT = 1000;
export const ASK_WINDOW_MS = 10 * 60_000;
export const ASK_DAY_MS = 24 * 3600_000;
const MAX_OUTPUT_TOKENS = 3000;

export interface AskConfig {
  /** OpenAI API key; the endpoint answers 503 when empty. */
  apiKey?: string;
  model?: string;
  /** Requests per client IP per 10 minutes. Default 30. */
  rateLimit?: number;
  /** Requests over all clients per 24 hours. Default 1000. */
  dailyLimit?: number;
  /** Injected in tests; defaults to the global fetch. */
  fetch?: typeof fetch;
}

export function systemPrompt(req: AskRequest): string {
  const { question: q } = req;
  const letter = (i: number) => String.fromCharCode(65 + i);
  const lines = [
    'You are a friendly, patient Python tutor for absolute beginners. The learner is working through a multiple-choice quiz question and wants to chat about it.',
    `Answer in ${req.lang === 'de' ? 'German' : 'English'}. Keep answers short and simple, use small examples, avoid jargon, and put code in Markdown code fences.`,
    'Stay on the topic of this question and Python basics. Be encouraging and never condescending.',
    '',
    `Question: ${q.prompt}`,
    ...(q.code === undefined ? [] : ['Code:', '```python', q.code, '```']),
    'Choices:',
    ...q.choices.map((c, i) => `${letter(i)}) ${c}`),
  ];
  if (q.answered) {
    const { picked, correct, explanation } = q.answered;
    lines.push(
      '',
      `The learner has answered. They picked ${letter(picked)}; the right answer is ${letter(correct)}.`,
      `Official explanation: ${explanation}`,
      'Help them understand why, and clear up misunderstandings.',
    );
  } else {
    lines.push(
      '',
      'The learner has NOT answered yet. Do not reveal or confirm which choice is correct, and do not rule choices in or out in a way that gives it away. Give hints and explain the underlying concepts so they can work it out themselves, even if they ask directly for the answer.',
    );
  }
  return lines.join('\n');
}

/** Extracts the text deltas from an OpenAI chat-completions SSE stream. */
export function textStream(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  const reader = upstream.getReader();
  return new ReadableStream({
    async pull(controller) {
      // Loop until something is emitted so that an empty chunk does not stall.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n');
        buffer = events.pop() ?? '';
        let out = '';
        for (const line of events) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') continue;
          try {
            const delta = (JSON.parse(data) as { choices?: { delta?: { content?: string } }[] }).choices?.[0]?.delta?.content;
            if (delta) out += delta;
          } catch {
            // Ignore malformed events.
          }
        }
        if (out) {
          controller.enqueue(encoder.encode(out));
          return;
        }
      }
    },
    cancel: (reason) => reader.cancel(reason),
  });
}

/** Calls OpenAI; returns the answer as a stream of plain text, or null on failure before streaming. */
export async function askTutor(config: AskConfig, req: AskRequest): Promise<ReadableStream<Uint8Array> | null> {
  const doFetch = config.fetch ?? fetch;
  try {
    const res = await doFetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model || DEFAULT_MODEL,
        stream: true,
        max_completion_tokens: MAX_OUTPUT_TOKENS,
        messages: [{ role: 'system', content: systemPrompt(req) }, ...req.messages],
      }),
    });
    if (!res.ok || !res.body) {
      console.error(`OpenAI request failed: HTTP ${res.status}`);
      return null;
    }
    return textStream(res.body);
  } catch (err) {
    console.error('OpenAI request failed:', err instanceof Error ? err.message : 'unknown error');
    return null;
  }
}
