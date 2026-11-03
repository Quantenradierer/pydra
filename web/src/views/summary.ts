import type { App, Screen } from '../app.ts';
import { h } from '../dom.ts';

export function summaryScreen(app: App): Screen {
  const { t } = app;
  const { storage, trainer } = app.services;
  const result = storage.lastResult()!;
  const root = h(
    'main',
    { class: 'screen summary' },
    h('img', { class: 'logo', src: '/icon.svg', alt: '', width: 120, height: 120 }),
    h('h1', { tabindex: -1 }, t('summary.headline', { score: result.score, total: result.total })),
    h(
      'div',
      { class: 'actions' },
      h(
        'button',
        {
          class: 'primary',
          onclick: () => {
            trainer.start();
            app.navigate('quiz');
          },
        },
        t('summary.again'),
      ),
      h(
        'button',
        {
          onclick: () => {
            storage.clearLastResult();
            app.navigate('home');
          },
        },
        t('summary.home'),
      ),
    ),
  );
  return { root };
}
