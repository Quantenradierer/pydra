import { FEEDBACK_MAX_LENGTH } from '@pydra/shared';
import type { App, Screen } from '../app.ts';
import { h } from '../dom.ts';
import type { SubmitResult } from '../feedback/queue.ts';
import type { MessageKey } from '../i18n.ts';
import { subpageHeader } from './header.ts';

const MESSAGES: Record<SubmitResult, MessageKey> = {
  sent: 'feedback.sent',
  rejected: 'feedback.rejected',
  'rate-limited': 'feedback.rateLimited',
  queued: 'feedback.queued',
};

export function feedbackScreen(app: App): Screen {
  const { t } = app;
  const queue = app.services.feedback;

  const textarea = h('textarea', { rows: 8, placeholder: t('feedback.placeholder'), 'aria-label': t('feedback.title') });
  const tooLong = h('span', { class: 'too-long' });
  const counter = h('span', { class: 'count', 'aria-live': 'polite' });
  const send = h('button', { class: 'primary', type: 'submit' }, t('feedback.send'));
  const result = h('p', { class: 'result', role: 'status', 'data-testid': 'feedback-result' });
  const pending = h('p', { class: 'pending', 'data-testid': 'feedback-pending' });
  let sending = false;

  const length = () => [...textarea.value.trim()].length;
  const update = () => {
    const n = length();
    const over = n > FEEDBACK_MAX_LENGTH;
    counter.textContent = t('feedback.count', { n, max: FEEDBACK_MAX_LENGTH });
    tooLong.textContent = over ? t('feedback.tooLong', { max: FEEDBACK_MAX_LENGTH }) : '';
    meta.classList.toggle('over', over);
    send.disabled = sending || n === 0 || over;
    send.textContent = sending ? t('feedback.sending') : t('feedback.send');
  };
  const showPending = (n: number) => {
    pending.hidden = n === 0;
    pending.textContent = n === 1 ? t('feedback.pending.one') : t('feedback.pending.other', { n });
  };

  const meta = h('div', { class: 'meta' }, tooLong, counter);
  const form = h(
    'form',
    {
      onsubmit: async (event: Event) => {
        event.preventDefault();
        const n = length();
        if (sending || n === 0 || n > FEEDBACK_MAX_LENGTH) return;
        sending = true;
        update();
        const outcome = await queue.submit(textarea.value.trim());
        sending = false;
        if (outcome === 'sent' || outcome === 'queued') textarea.value = '';
        result.textContent = t(MESSAGES[outcome]);
        result.classList.toggle('ok', outcome === 'sent' || outcome === 'queued');
        update();
      },
    },
    textarea,
    meta,
    send,
  );
  textarea.addEventListener('input', () => {
    result.textContent = '';
    update();
  });
  update();
  showPending(queue.pending);

  const root = h(
    'main',
    { class: 'screen feedback' },
    subpageHeader(app, t('feedback.title')),
    h('p', {}, t('feedback.intro')),
    form,
    result,
    pending,
  );
  return { root, dispose: queue.subscribe(showPending) };
}
