import { describe, expect, it } from 'vitest';
import { START_BUILD } from './build.ts';
import { ENEMIES } from './content/index.ts';
import { fightEnemy, DEFAULT_BUILD } from './fight.ts';

const chapters = [...new Set(ENEMIES.map((e) => e.chapter))];

describe('enemy data', () => {
  it('has unique ids and every challenge has exactly one map', () => {
    expect(new Set(ENEMIES.map((e) => e.id)).size).toBe(ENEMIES.length);
    for (const e of ENEMIES) expect(e.map.length, e.id).toBeGreaterThanOrEqual(1);
  });

  for (const e of ENEMIES) {
    describe(e.id, () => {
      const index = ENEMIES.indexOf(e);
      const prev = ENEMIES[index - 1];

      it('is won by its solution', () => {
        const r = fightEnemy(e, DEFAULT_BUILD, e.solution);
        expect([r.fight.won, r.fight.battle.reason, r.fight.unmet], JSON.stringify(r.fight.battle.error?.message)).toEqual([true, 'win', undefined]);
        expect(r.won).toBe(true);
      });

      if (prev && e.breaks !== false && prev.chapter === e.chapter) {
        it('is NOT won by the previous solution (the catch breaks old code)', () => {
          const r = fightEnemy(e, DEFAULT_BUILD, prev.solution);
          expect(r.won).toBe(false);
        });
      }
    });
  }

  it('covers the chapters in order', () => {
    expect(chapters).toEqual([...chapters].sort((a, b) => a - b));
    expect(START_BUILD.gear).toContain('eyes');
  });
});
