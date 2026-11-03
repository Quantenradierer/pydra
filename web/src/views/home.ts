import type { App, Screen } from '../app.ts';
import { h, svg } from '../dom.ts';
import { GEAR, SPEECH_BUBBLE } from '../icons.ts';
import { percentCorrect } from '../stats.ts';

export function homeScreen(app: App): Screen {
  const { t } = app;
  const { storage, trainer } = app.services;
  const counters = storage.counters();
  const stats =
    counters.sessionsPlayed === 0
      ? t('home.noStats')
      : t(counters.sessionsPlayed === 1 ? 'home.stats.one' : 'home.stats.other', {
          sessions: counters.sessionsPlayed,
          best: counters.bestScore,
          percent: percentCorrect(counters),
        });

  const iconButton = (label: string, icon: string, onclick: () => void, testId: string) =>
    h('button', { class: 'icon-button', 'aria-label': label, title: label, 'data-testid': testId, onclick }, svg(icon));

  const root = h(
    'main',
    { class: 'screen home' },
    h(
      'nav',
      { class: 'toolbar' },
      iconButton(t('home.feedback'), SPEECH_BUBBLE, () => app.navigate('feedback'), 'open-feedback'),
      iconButton(t('home.settings'), GEAR, () => app.navigate('settings'), 'open-settings'),
    ),
    h('img', { class: 'logo', src: '/icon.svg', alt: '', width: 160, height: 160 }),
    h('h1', { tabindex: -1 }, 'Pydra'),
    h('p', { class: 'tagline' }, t('app.tagline')),
    h(
      'button',
      {
        class: 'primary start',
        onclick: () => {
          trainer.start();
          app.navigate('quiz');
        },
      },
      t('home.start'),
    ),
    h('p', { class: 'stats', 'data-testid': 'stats' }, stats),
  );
  return { root };
}
