import { GAME_ROUTES, type App, type GameRoute, type Screen } from '../app.ts';
import { LESSONS, type LessonId } from '../content/lessons.ts';
import { h, svg } from '../dom.ts';
import { iconEl, specOf } from '../robot/art/compose.ts';
import { logoArt } from '../hydra/view.ts';
import { GEAR, SPEECH_BUBBLE } from '../icons.ts';
import { levelInfo, titleKey } from '../points/levels.ts';
import { percentCorrect } from '../stats.ts';

/** Games not listed on the home screen for now (the route itself still works). */
const HIDDEN_GAMES: readonly GameRoute[] = ['robot', 'factory'];

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
          class: 'start',
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
  const gameCard = (route: GameRoute) => {
    let statsText: string;
    if (route === 'predict') {
      const stats = app.services.predict.stats();
      statsText = stats.checks === 0 ? t('home.game.noStats') : t('home.game.stats', stats);
    } else if (route === 'robot') {
      const stats = app.services.robot.stats();
      statsText = stats.runs === 0 ? t('home.robot.noStats') : t('home.robot.stats', stats);
    } else if (route === 'factory') {
      const stats = app.services.factory.stats();
      statsText = stats.runs === 0 ? t('home.factory.noStats') : t('home.factory.stats', stats);
    } else if (route === 'elevator') {
      const stats = app.services.elevator.stats();
      statsText = stats.runs === 0 ? t('home.elevator.noStats') : t('home.elevator.stats', stats);
    } else if (route === 'order') {
      const stats = app.services.order.stats();
      statsText = stats.runs === 0 ? t('home.order.noStats') : t(stats.runs === 1 ? 'home.order.stats.one' : 'home.order.stats.other', stats);
    } else {
      const stats = app.services[route].stats();
      statsText = stats.picks === 0 ? t('home.game.noStats') : t('home.game.stats', stats);
    }
    return h(
      'li',
      { class: 'lesson' },
      h(
        'button',
        {
          class: 'start',
          'data-testid': `start-${route}`,
          'aria-describedby': `stats-${route}`,
          onclick: () => app.navigate(route),
        },
        h('span', { class: 'lesson-title' }, route === 'robot' ? iconEl(specOf(app.services.robot.build()), 40, { label: () => t('robot.you') }) : null, t(`lesson.${route}.title`)),
        h('span', { class: 'lesson-description' }, t(`lesson.${route}.description`)),
      ),
      h(
        'p',
        { class: 'stats', id: `stats-${route}`, 'data-testid': `stats-${route}` },
        statsText,
      ),
    );
  };

  /** The daily challenge: one card above the lessons with today's state. */
  const dailyCard = () => {
    const state = app.services.daily.state();
    const text =
      state.kind === 'done'
        ? t('home.daily.done', { score: state.score })
        : state.kind === 'running'
          ? t('home.daily.running', { n: state.answered })
          : t('home.daily.new');
    return h(
      'li',
      { class: 'lesson daily-card' },
      h(
        'button',
        { class: 'start', 'data-testid': 'start-daily', 'aria-describedby': 'stats-daily', onclick: () => app.navigate('daily') },
        h('span', { class: 'lesson-title' }, t('lesson.daily.title')),
        h('span', { class: 'lesson-description' }, t('lesson.daily.description')),
      ),
      h('p', { class: 'stats', id: 'stats-daily', 'data-testid': 'stats-daily' }, text),
    );
  };

  const iconButton = (label: string, icon: string, onclick: () => void, testId: string) =>
    h('button', { class: 'icon-button', 'aria-label': label, title: label, 'data-testid': testId, onclick }, svg(icon));

  const { points } = app.services;
  const state = points.state();
  const info = levelInfo(state.total);
  const name = storage.playerName();
  const profile = h(
    'button',
    { class: 'profile-chip', 'data-testid': 'open-profile', 'aria-label': t('home.profile'), onclick: () => app.navigate('profile') },
    h(
      'span',
      { class: 'chip-text' },
      name ? h('strong', {}, name) : null,
      h('span', { 'data-testid': 'home-level' }, t('home.level', { n: info.level, title: t(titleKey(info.title)) })),
    ),
    h('progress', { max: info.span, value: info.into, 'aria-hidden': 'true' }),
    h('span', { class: 'chip-xp' }, `${state.total} XP`),
  );

  const root = h(
    'main',
    { class: 'screen home' },
    h(
      'div',
      { class: 'home-top' },
      profile,
      h(
        'nav',
        { class: 'toolbar' },
        iconButton(t('home.feedback'), SPEECH_BUBBLE, () => app.navigate('feedback'), 'open-feedback'),
        iconButton(t('home.settings'), GEAR, () => app.navigate('settings'), 'open-settings'),
      ),
    ),
    logoArt(),
    h('h1', { tabindex: -1 }, 'Pydra'),
    h('p', { class: 'tagline' }, t('app.tagline')),
    h(
      'section',
      { class: 'lesson-group', 'aria-label': t('lesson.daily.title') },
      h('ul', { class: 'lessons' }, dailyCard()),
    ),
    h(
      'section',
      { class: 'lesson-group' },
      h('h2', { id: 'home-lessons' }, t('home.lessons')),
      h('ul', { class: 'lessons', 'aria-labelledby': 'home-lessons' }, ...LESSONS.map(lessonCard)),
    ),
    h(
      'section',
      { class: 'lesson-group' },
      h('h2', { id: 'home-games' }, t('home.games')),
      h('ul', { class: 'lessons', 'aria-labelledby': 'home-games' }, ...GAME_ROUTES.filter((route) => !HIDDEN_GAMES.includes(route)).map(gameCard)),
    ),
  );
  return { root };
}
