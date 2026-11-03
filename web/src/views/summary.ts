import type { App, Screen } from '../app.ts';
import { h } from '../dom.ts';
import { resultHeads } from '../hydra/heads.ts';
import { hydra } from '../hydra/view.ts';

export function summaryScreen(app: App): Screen {
  const { t } = app;
  const { storage, trainer } = app.services;
  const result = storage.lastResult()!;
  const root = h(
    'main',
    { class: 'screen summary' },
    hydra(resultHeads(result.score, result.total)).root,
    h('h1', { tabindex: -1 }, t('summary.headline', { score: result.score, total: result.total })),
    h(
      'div',
      { class: 'actions' },
      h(
        'button',
        {
          class: 'primary',
          onclick: () => {
            trainer.start(result.lesson);
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
