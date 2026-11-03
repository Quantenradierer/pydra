import { ASK_LIMITS, type AskMessage, type AskQuestion } from '@pydra/shared';
import { askTutor, type AskResult } from '../ask/client.ts';
import { chatText } from '../ask/format.ts';
import type { App } from '../app.ts';
import { h } from '../dom.ts';
import type { MessageKey } from '../i18n.ts';

const ERRORS: Record<Exclude<AskResult, 'ok'>, MessageKey> = {
  'not-configured': 'ask.notConfigured',
  'too-long': 'ask.tooLong',
  'rate-limited': 'ask.rateLimited',
  upstream: 'ask.error',
  offline: 'ask.offline',
};

/**
 * "Ask about this question": a chat with the tutor under the question. The
 * history lives only in this panel, so the next question starts fresh.
 * `context` is read on every send, so it reflects whether the question has
 * been answered by then.
 */
export function askPanel(app: App, context: () => AskQuestion): { root: HTMLElement; dispose: () => void } {
  const { t, lang } = app;
  const history: AskMessage[] = [];
  let busy = false;
  let abort: AbortController | null = null;

  const log = h('div', { class: 'chat-log', 'aria-live': 'polite', 'data-testid': 'ask-log' });
  const status = h('p', { class: 'chat-status', role: 'status', 'data-testid': 'ask-status' });
  const input = h('input', {
    type: 'text',
    class: 'chat-input',
    placeholder: t('ask.placeholder'),
    'aria-label': t('ask.title'),
    maxlength: ASK_LIMITS.message,
    autocomplete: 'off',
    enterkeyhint: 'send',
  });
  const send = h('button', { class: 'primary', type: 'submit' }, t('ask.send'));

  const update = () => {
    const offline = !navigator.onLine;
    send.disabled = busy || offline || input.value.trim() === '';
    send.textContent = busy ? t('ask.thinking') : t('ask.send');
    if (offline) status.textContent = t('ask.offline');
    else if (status.textContent === t('ask.offline')) status.textContent = '';
  };

  const bubble = (role: AskMessage['role']) => {
    const el = h('div', { class: `chat-msg ${role}` });
    log.append(el);
    return el;
  };

  async function submit(event: Event) {
    event.preventDefault();
    const text = input.value.trim();
    if (busy || text === '' || !navigator.onLine) return;
    busy = true;
    status.textContent = '';
    input.value = '';
    history.push({ role: 'user', content: text });
    const userBubble = bubble('user');
    userBubble.textContent = text;
    const answer = bubble('assistant');
    update();

    abort = new AbortController();
    let reply = '';
    const result = await askTutor(
      { lang, question: context(), messages: [...history] },
      (partial) => {
        reply = partial;
        answer.replaceChildren(...chatText(partial));
      },
      { signal: abort.signal },
    );
    busy = false;
    if (result === 'ok') {
      history.push({ role: 'assistant', content: reply });
    } else if (!abort.signal.aborted) {
      // Drop the failed turn, so a retry does not send a dangling message.
      history.pop();
      answer.remove();
      userBubble.remove();
      status.textContent = t(ERRORS[result]);
      input.value = text;
    }
    update();
    input.focus();
  }

  const form = h('form', { class: 'chat-form', onsubmit: submit }, input, send);
  input.addEventListener('input', update);
  const onNet = () => update();
  window.addEventListener('online', onNet);
  window.addEventListener('offline', onNet);
  update();

  const root = h(
    'details',
    { class: 'ask', 'data-testid': 'ask' },
    h('summary', {}, t('ask.title')),
    h('p', { class: 'chat-intro' }, t('ask.intro')),
    log,
    form,
    status,
  );
  return {
    root,
    dispose: () => {
      abort?.abort();
      window.removeEventListener('online', onNet);
      window.removeEventListener('offline', onNet);
    },
  };
}
