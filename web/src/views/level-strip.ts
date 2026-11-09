import { h } from '../dom.ts';
import type { MessageKey, Params } from '../i18n.ts';

export interface LevelPill {
  solved: boolean;
  open: boolean;
  current: boolean;
  /** Opens this level. */
  go(): void;
}

/** The row of level pills (1..N) in the header of every game: solved ticked, locked greyed, current filled. */
export function levelStrip(t: (key: MessageKey, params?: Params) => string, pills: readonly LevelPill[]): HTMLElement {
  return h(
    'nav',
    { class: 'level-strip', 'aria-label': t('game.levels'), 'data-testid': 'level-strip' },
    ...pills.map((p, i) => {
      const label = t(p.solved ? 'game.levelSolved' : p.open ? 'game.level' : 'game.levelLocked', { n: i + 1 });
      return h('button', { class: `level-dot${p.solved ? ' solved' : ''}`, 'aria-label': label, title: label, 'aria-current': p.current ? 'step' : undefined, disabled: !p.open, 'data-testid': `level-${i + 1}`, onclick: p.go }, String(i + 1));
    }),
  );
}
