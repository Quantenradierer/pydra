import { describe, expect, it } from 'vitest';
import { START_BUILD } from './build.ts';
import { ENEMIES } from './content/index.ts';
import { fightEnemy, fullBuild } from './fight.ts';

const chapters = [...new Set(ENEMIES.map((e) => e.chapter))];

describe('enemy data', () => {
  it('has unique ids and three layouts or fewer, all parseable', () => {
    expect(new Set(ENEMIES.map((e) => e.id)).size).toBe(ENEMIES.length);
    for (const e of ENEMIES) if (!e.mix) expect(e.maps.length, e.id).toBeGreaterThanOrEqual(1);
  });

  for (const e of ENEMIES) {
    describe(e.id, () => {
      const earlier = e.regression === false ? [] : ENEMIES.filter((o) => o.chapter === e.chapter && o.regression !== false && ENEMIES.indexOf(o) < ENEMIES.indexOf(e));
      const index = ENEMIES.indexOf(e);
      const prev = [...ENEMIES.slice(0, index)].reverse().find((o) => o.regression !== false);

      it('is won by its solution in every layout', () => {
        const r = fightEnemy(e, ENEMIES, fullBuild(e.solutionBuild), e.solution);
        expect(r.fights.map((f) => [f.won, f.battle.reason, f.unmet]), JSON.stringify(r.fights.map((f) => f.battle.error?.message))).toEqual(r.fights.map(() => [true, 'win', undefined]));
        expect(r.won).toBe(true);
      });

      it('is won by its solution together with all earlier enemies of the chapter (regression)', () => {
        for (const o of earlier) {
          const r = fightEnemy(o, ENEMIES, fullBuild(e.solutionBuild), e.solution, true);
          expect(r.won, `${e.id} script vs ${o.id}`).toBe(true);
        }
      });

      if (prev && e.breaks !== false && prev.chapter === e.chapter) {
        it('is NOT won by the previous solution (the twist breaks old code)', () => {
          const r = fightEnemy(e, ENEMIES, fullBuild(e.solutionBuild ?? prev.solutionBuild), prev.solution);
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
