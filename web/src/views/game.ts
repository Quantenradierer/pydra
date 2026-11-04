import type { App, Screen } from '../app.ts';
import { h } from '../dom.ts';
import { arena } from '../game/arena.ts';
import { fill } from '../game/puzzle.ts';
import { parseMap, simulate, type Outcome } from '../game/world.ts';
import type { MessageKey } from '../i18n.ts';
import { richText } from '../rich-text.ts';
import { puzzleScreen } from './puzzle.ts';

const COMMANDS: [string, MessageKey][] = [
  ['move()', 'game.cmd.move'],
  ['turn_left()', 'game.cmd.turnLeft'],
  ['turn_right()', 'game.cmd.turnRight'],
  ['wall_ahead()', 'game.cmd.wallAhead'],
  ['fish_ahead()', 'game.cmd.fishAhead'],
];

/** "Hydra goes fishing": the hydra swims through a pool and eats fish. */
export function gameScreen(app: App): Screen {
  const { t } = app;
  return puzzleScreen(app, {
    game: app.services.game,
    title: 'lesson.game.title',
    task: 'game.task',
    idle: 'game.idle',
    className: 'fishing',
    stage: (level) => {
      const world = parseMap(level.map);
      return { ...arena(world), ratio: (world.width * 10 + 2) / (world.height * 10 + 2) };
    },
    initial: (level) => simulate(parseMap(level.map), '').steps[0]!,
    run: (level, choice) => simulate(parseMap(level.map), fill(level, choice)),
    outcomeText: (outcome: Outcome) => {
      switch (outcome.kind) {
        case 'success':
          return t('game.outcome.success');
        case 'crash':
          return t('game.outcome.crash', { line: outcome.line });
        case 'loop':
          return t('game.outcome.loop');
        case 'missed':
          return t(outcome.left === 1 ? 'game.outcome.missed.one' : 'game.outcome.missed.other', { left: outcome.left });
        case 'error':
          return t('game.outcome.error', { line: outcome.line, message: outcome.message });
      }
    },
    info: () => [
      h('p', { class: 'info-commands' }, t('game.commands')),
      h('dl', {}, ...COMMANDS.flatMap(([name, key]) => [h('dt', {}, h('code', {}, name)), h('dd', {}, ...richText(t(key)))])),
    ],
  });
}
