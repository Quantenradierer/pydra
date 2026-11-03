import { ASK_PATH, type AskRequest } from '@pydra/shared';

export type AskResult = 'ok' | 'not-configured' | 'too-long' | 'rate-limited' | 'upstream' | 'offline';

/**
 * Posts the conversation and reports the streamed answer through `onText`
 * (called with the full text so far). Never throws.
 */
export async function askTutor(
  req: AskRequest,
  onText: (text: string) => void,
  options: { fetchFn?: typeof fetch; signal?: AbortSignal } = {},
): Promise<AskResult> {
  const fetchFn = options.fetchFn ?? fetch;
  try {
    const res = await fetchFn(ASK_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
      signal: options.signal,
    });
    if (res.status === 503) return 'not-configured';
    if (res.status === 429) return 'rate-limited';
    if (res.status === 413) return 'too-long';
    if (!res.ok || !res.body) return 'upstream';
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      onText(text);
    }
    text += decoder.decode();
    if (text.trim() === '') return 'upstream';
    onText(text);
    return 'ok';
  } catch {
    return 'offline';
  }
}
