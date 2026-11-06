import type { App, Screen } from '../app.ts';
import { ACHIEVEMENTS, showcase, type Achievement } from '../points/achievements.ts';
import { streakMultiplier, XP } from '../points/engine.ts';
import { levelInfo, titleKey } from '../points/levels.ts';
import { currentStreak, dayKey } from '../points/state.ts';
import { h } from '../dom.ts';
import type { MessageKey } from '../i18n.ts';
import { subpageHeader } from './header.ts';

export const MAX_NAME_LENGTH = 20;

/** Name, level, today's tasks and the achievements. */
export function profileScreen(app: App): Screen {
  const { t } = app;
  const { storage, points } = app.services;
  const state = points.state();
  const info = levelInfo(state.total);
  const streak = currentStreak(state, dayKey(new Date()));
  const title = showcase(state);

  const input = h('input', {
    id: 'player-name',
    type: 'text',
    autocomplete: 'nickname',
    maxlength: MAX_NAME_LENGTH,
    placeholder: t('profile.namePlaceholder'),
    'data-testid': 'player-name',
  });
  input.value = storage.playerName();
  const status = h('p', { class: 'status', role: 'status' });
  const greeting = h('p', { class: 'greeting', 'data-testid': 'greeting' });
  const showGreeting = () => {
    const name = storage.playerName();
    greeting.textContent = name ? t('profile.greeting', { name }) : '';
    greeting.hidden = !name;
  };
  showGreeting();

  const form = h(
    'form',
    {
      class: 'name-form',
      onsubmit: (event: Event) => {
        event.preventDefault();
        storage.setPlayerName([...input.value.trim()].slice(0, MAX_NAME_LENGTH).join(''));
        input.value = storage.playerName();
        showGreeting();
        status.textContent = t('profile.saved');
      },
    },
    h('label', { for: 'player-name' }, t('profile.name')),
    h('div', { class: 'row' }, input, h('button', { type: 'submit', class: 'primary', 'data-testid': 'save-name' }, t('profile.save'))),
    h('p', { class: 'hint' }, t('profile.nameHint')),
    status,
  );

  const levelCard = h(
    'section',
    { class: 'level-card', 'aria-labelledby': 'level-heading' },
    h('h2', { id: 'level-heading', 'data-testid': 'profile-level' }, t('home.level', { n: info.level, title: t(titleKey(info.title)) })),
    title ? h('p', { class: 'showcase' }, t(`ach.${title.id}.title` as MessageKey)) : null,
    h('progress', { max: info.span, value: info.into, 'aria-label': t('profile.xp', { into: info.into, span: info.span }) }),
    h('p', { class: 'hint' }, t('profile.xp', { into: info.into, span: info.span })),
    h('p', { class: 'hint', 'data-testid': 'profile-total' }, t('profile.total', { total: state.total })),
    h(
      'p',
      { class: 'hint' },
      streak === 0
        ? t('profile.streak.none')
        : t('profile.streak', { n: streak, bonus: Math.round((streakMultiplier(streak) - 1) * 100) }),
    ),
  );

  const tasks = h(
    'section',
    { 'aria-labelledby': 'daily-heading' },
    h('h2', { id: 'daily-heading' }, t('profile.daily')),
    h('p', { class: 'hint' }, t('profile.dailyHint', { xp: XP.task })),
    h(
      'ul',
      { class: 'tasks', 'data-testid': 'tasks' },
      ...(state.daily?.tasks ?? []).map((task) =>
        h(
          'li',
          { class: task.done ? 'task done' : 'task', 'data-testid': `task-${task.id}` },
          h('span', { class: 'task-label' }, app.taskLabel(task)),
          h('span', { class: 'task-count' }, task.done ? t('profile.taskDone') : `${task.progress}/${task.target}`),
          h('progress', { max: task.target, value: task.progress, 'aria-hidden': 'true' }),
        ),
      ),
    ),
  );

  const describe = (a: Achievement) =>
    a.desc.key === 'ach.desc.master'
      ? t(a.desc.key, { game: t(`lesson.${a.desc.game}.title`) })
      : t(a.desc.key, { n: a.desc.n });
  const earned = ACHIEVEMENTS.filter((a) => a.id in state.achievements).length;
  const achievements = h(
    'section',
    { 'aria-labelledby': 'ach-heading' },
    h('h2', { id: 'ach-heading' }, t('profile.achievements')),
    h('p', { class: 'hint', 'data-testid': 'ach-count' }, t('profile.achievementsCount', { n: earned, total: ACHIEVEMENTS.length })),
    h(
      'ul',
      { class: 'achievements' },
      ...ACHIEVEMENTS.map((a) => {
        const at = state.achievements[a.id];
        return h(
          'li',
          { class: `achievement ${a.tier}${at ? ' earned' : ''}`, 'data-testid': `ach-${a.id}` },
          h('strong', {}, t(`ach.${a.id}.title` as MessageKey)),
          h('span', { class: 'tier' }, t(`tier.${a.tier}`)),
          h('span', { class: 'desc' }, describe(a)),
          at ? h('time', { datetime: at }, new Date(at).toLocaleDateString(app.lang)) : h('span', { class: 'locked' }, t('profile.locked')),
        );
      }),
    ),
  );

  const root = h('main', { class: 'screen profile' }, subpageHeader(app, t('profile.title')), greeting, levelCard, form, tasks, achievements);
  return { root };
}
