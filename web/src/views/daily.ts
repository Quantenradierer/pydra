import type { App, Screen } from '../app.ts';
import type { DailyQuestion } from '../content/daily.ts';
import { h } from '../dom.ts';
import { codeBlock } from '../highlight.ts';
import { resultHeads } from '../hydra/heads.ts';
import { hydra } from '../hydra/view.ts';
import type { MessageKey } from '../i18n.ts';
import { currentChallengeStreak } from '../points/state.ts';
import { DAILY_LENGTH, scoreOf, shareLine, type DailyOutcome } from '../daily/challenge.ts';
import { diffPair, runScreen } from './quiz.ts';

/** Copies text; falls back to a hidden textarea where the clipboard API is missing or refuses. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = h('textarea', { 'aria-hidden': 'true', tabindex: -1, style: 'position:fixed;opacity:0' });
    area.value = text;
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

/** The Tages-Challenge: the question screen while it runs, the locked result afterwards. */
export function dailyScreen(app: App): Screen {
  const { daily } = app.services;
  if (!daily.isRunning() && daily.result()) return resultScreen(app);
  const run = daily.begin();
  const { t } = app;
  const code = (question: import('../content/types.ts').Question): Node | null => {
    const q = question as DailyQuestion;
    if (q.codeB !== undefined) return diffPair(t, q.code!, q.codeB);
    const caption = q.kind === 'requirement' || q.kind === 'whatif' || q.kind === 'extend' || q.kind === 'trace' ? t(`daily.cap.${q.kind}` as MessageKey) : '';
    return h(
      'figure',
      { class: 'daily-code', 'data-testid': `daily-code-${q.kind}` },
      h('figcaption', {}, caption),
      codeBlock(q.code!, { changedLines: q.changed, addedLines: q.added }),
    );
  };
  return runScreen(app, {
    driver: {
      session: () => daily.session(),
      question: (id) => daily.question(id),
      answer: (slot) => daily.answer(slot),
      next: () => daily.next(),
      leave: () => daily.leave(),
    },
    route: 'daily',
    done: 'daily',
    quitLabel: t('daily.leave'),
    meta: (question) =>
      `${run.practice ? `${t('daily.practiceBadge')} · ` : ''}${t(`daily.kind.${(question as DailyQuestion).kind}` as MessageKey)}`,
    code,
    className: 'daily',
  });
}

function resultScreen(app: App): Screen {
  const { t } = app;
  const { daily, points } = app.services;
  const result = daily.result()!;
  const practice = daily.practiceResult();
  const line = shareLine(result);
  const streak = currentChallengeStreak(points.state(), result.day);
  const status = h('p', { class: 'status', role: 'status', 'data-testid': 'daily-copy-status' });
  const row = (outcome: DailyOutcome) =>
    outcome.right.map((r, i) => `${i + 1} ${r ? t('daily.result.right') : t('daily.result.wrong')}`).join(', ');

  const share = h('output', { class: 'share-line', 'data-testid': 'daily-share' }, line);
  const root = h(
    'main',
    { class: 'screen summary daily-result' },
    hydra(resultHeads(scoreOf(result.right), DAILY_LENGTH)).root,
    h('h1', { tabindex: -1, 'data-testid': 'daily-headline' }, t('daily.result.headline', { score: scoreOf(result.right), total: DAILY_LENGTH })),
    h('p', { class: 'hint' }, t('daily.result.date', { day: result.day })),
    h('p', { class: 'sr-only' }, t('daily.result.row', { answers: row(result) })),
    streak > 0 ? h('p', { class: 'hint', 'data-testid': 'daily-streak' }, t(streak === 1 ? 'daily.result.streak.one' : 'daily.result.streak.other', { n: streak })) : null,
    h(
      'section',
      { class: 'share', 'aria-label': t('daily.share') },
      share,
      h(
        'button',
        {
          class: 'primary',
          'data-testid': 'daily-copy',
          onclick: async () => {
            status.textContent = (await copyText(line)) ? t('daily.copied') : t('daily.copyFailed');
          },
        },
        t('daily.copy'),
      ),
      status,
    ),
    h('p', { class: 'hint' }, t('daily.result.locked')),
    practice ? h('p', { class: 'hint', 'data-testid': 'daily-practice-result' }, t('daily.practice.result', { score: scoreOf(practice.right), total: DAILY_LENGTH })) : null,
    h(
      'div',
      { class: 'actions' },
      h(
        'button',
        {
          'data-testid': 'daily-practice',
          onclick: () => {
            daily.begin();
            app.navigate('daily');
          },
        },
        t('daily.again'),
      ),
      h('button', { class: 'primary', onclick: () => app.navigate('home') }, t('daily.home')),
    ),
    h('p', { class: 'hint' }, t('daily.againHint')),
  );
  return { root };
}

