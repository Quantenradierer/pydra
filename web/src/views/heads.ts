import type { App, Screen } from '../app.ts';
import { headsStage } from '../game/heads-view.ts';
import { simulateHeads, type HeadsOutcome } from '../game/heads.ts';
import { fill } from '../game/puzzle.ts';
import { puzzleScreen } from './puzzle.ts';

/** "The hydra's heads": every function call grows a head that holds its variables. */
export function headsScreen(app: App): Screen {
  const { t } = app;
  return puzzleScreen(app, {
    game: app.services.heads,
    title: 'lesson.heads.title',
    task: 'heads.task',
    idle: 'heads.idle',
    className: 'heads-game',
    stage: (level) => headsStage(level, t),
    initial: (level) => simulateHeads(level, '').steps[0]!,
    run: (level, choice) => simulateHeads(level, fill(level, choice)),
    outcomeText: (outcome: HeadsOutcome) => {
      switch (outcome.kind) {
        case 'success':
          return t('heads.outcome.success');
        case 'wrong':
          return outcome.got === null
            ? t('heads.outcome.missing', { name: outcome.name, want: outcome.want })
            : t('heads.outcome.wrong', { name: outcome.name, got: outcome.got, want: outcome.want });
        case 'output':
          return t('heads.outcome.output');
        case 'loop':
          return t('heads.outcome.loop');
        case 'error':
          return outcome.message.startsWith('RecursionError')
            ? t('heads.outcome.recursion', { line: outcome.line })
            : t('game.outcome.error', { line: outcome.line, message: outcome.message });
      }
    },
  });
}
