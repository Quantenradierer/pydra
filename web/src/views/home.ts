import type { App, Screen } from '../app.ts';
import { LESSONS, type LessonId } from '../content/lessons.ts';
import { h, svg } from '../dom.ts';
import { logoArt } from '../hydra/view.ts';
import { GEAR, SPEECH_BUBBLE } from '../icons.ts';
import { percentCorrect } from '../stats.ts';

export function homeScreen(app: App): Screen {
  const { t } = app;
  const { storage, trainer } = app.services;

  /** One stats line per lesson, in the active language. */
  function stats(lesson: LessonId): string {
    const counters = storage.counters(lesson);
    if (lesson === 'functions') {
      const { done, total } = trainer.walkthroughProgress();
      return counters.totalAnswers === 0
        ? t('home.walk.noStats')
        : t('home.walk.stats', { done, total, percent: percentCorrect(counters) });
    }
    return counters.sessionsPlayed === 0
      ? t('home.noStats')
      : t(counters.sessionsPlayed === 1 ? 'home.stats.one' : 'home.stats.other', {
          sessions: counters.sessionsPlayed,
          best: counters.bestScore,
          percent: percentCorrect(counters),
        });
  }

  const lessonCard = (lesson: LessonId) =>
    h(
      'li',
      { class: 'lesson' },
      h(
        'button',
        {
          class: 'primary start',
          'data-testid': `start-${lesson}`,
          'aria-describedby': `stats-${lesson}`,
          onclick: () => {
            trainer.start(lesson);
            app.navigate('quiz');
          },
        },
        h('span', { class: 'lesson-title' }, t(`lesson.${lesson}.title`)),
        h('span', { class: 'lesson-description' }, t(`lesson.${lesson}.description`)),
      ),
      h('p', { class: 'stats', id: `stats-${lesson}`, 'data-testid': `stats-${lesson}` }, stats(lesson)),
    );

  /** The hydra games: not quiz lessons, each has its own screen and progress. */
  const gameCard = (route: 'game' | 'heads') => {
    const stats = app.services[route].stats();
    return h(
      'li',
      { class: 'lesson' },
      h(
        'button',
        {
          class: 'primary start',
          'data-testid': `start-${route}`,
          'aria-describedby': `stats-${route}`,
          onclick: () => app.navigate(route),
        },
        h('span', { class: 'lesson-title' }, t(`lesson.${route}.title`)),
        h('span', { class: 'lesson-description' }, t(`lesson.${route}.description`)),
      ),
      h(
        'p',
        { class: 'stats', id: `stats-${route}`, 'data-testid': `stats-${route}` },
        stats.picks === 0 ? t('home.game.noStats') : t('home.game.stats', stats),
      ),
    );
  };

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
    logoArt(),
    h('h1', { tabindex: -1 }, 'Pydra'),
    h('p', { class: 'tagline' }, t('app.tagline')),
    h('ul', { class: 'lessons', 'aria-label': t('home.lessons') }, ...LESSONS.map(lessonCard), gameCard('game'), gameCard('heads')),
  );
  return { root };
}
