import type { App, Screen } from '../app.ts';
import { h } from '../dom.ts';
import { huntArena } from '../game/hunt-arena.ts';
import { parseHuntMap, simulateHunt, type HuntOutcome } from '../game/hunt.ts';
import type { HuntLevel } from '../game/hunt-levels.ts';
import { fill } from '../game/puzzle.ts';
import type { MessageKey, Params } from '../i18n.ts';
import { richText } from '../rich-text.ts';
import { puzzleScreen } from './puzzle.ts';

const COMMANDS: [string, MessageKey][] = [
  ['move_north() move_east() move_south() move_west()', 'hunt.cmd.moves'],
  ['attack()', 'hunt.cmd.attack'],
  ['body_here()', 'hunt.cmd.body'],
];

/** How a hunt ended, as one sentence. */
export function huntOutcomeText(outcome: HuntOutcome, t: (key: MessageKey, params?: Params) => string): string {
  switch (outcome.kind) {
    case 'success':
      return t('hunt.outcome.success');
    case 'crash':
      return t('hunt.outcome.crash', { line: outcome.line });
    case 'eaten':
      return t('hunt.outcome.eaten', { line: outcome.line });
    case 'air':
      return t('hunt.outcome.air', { line: outcome.line });
    case 'loop':
      return t('hunt.outcome.loop');
    case 'missed': {
      const left: string[] = [];
      if (outcome.hydras > 0) left.push(t(outcome.hydras === 1 ? 'hunt.hydras.one' : 'hunt.hydras.other', { n: outcome.hydras }));
      if (outcome.gold > 0) left.push(t(outcome.gold === 1 ? 'hunt.gold.one' : 'hunt.gold.other', { n: outcome.gold }));
      return t('hunt.outcome.missed', { left: left.join(t('hunt.and')) });
    }
    case 'error':
      return t('game.outcome.error', { line: outcome.line, message: outcome.message });
  }
}

/** The warrior's commands and the one rule, for the level info. */
export function huntInfo(t: (key: MessageKey, params?: Params) => string): Node[] {
  return [
    h('p', { class: 'info-commands' }, t('hunt.commands')),
    h(
      'dl',
      {},
      ...COMMANDS.flatMap(([names, key]) => [
        h('dt', {}, ...names.split(' ').flatMap((name, i) => [i > 0 ? ' ' : '', h('code', {}, name)])),
        h('dd', {}, ...richText(t(key))),
      ]),
    ),
    h('div', { class: 'info-rule' }, ...richText(t('hunt.rule'))),
  ];
}

/** "Hydra hunt": a warrior walks the map, slays the hydras and collects gold. */
export function huntScreen(app: App): Screen {
  const { t } = app;
  const world = (level: HuntLevel) => parseHuntMap(level.map);
  return puzzleScreen(app, {
    game: app.services.hunt,
    title: 'lesson.hunt.title',
    task: 'hunt.task',
    idle: 'hunt.idle',
    className: 'hunt',
    stage: (level) => huntArena(world(level)),
    initial: (level) => simulateHunt(world(level), '').steps[0]!,
    run: (level, choice) => simulateHunt(world(level), fill(level, choice)),
    outcomeText: (outcome) => huntOutcomeText(outcome, t),
    info: () => huntInfo(t),
  });
}
