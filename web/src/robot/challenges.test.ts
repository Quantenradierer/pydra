import { describe, expect, it } from 'vitest';
import { START_BUILD } from './build.ts';
import { CHALLENGES, checkConstraint, checkGlitch, injectGlitch } from './challenges.ts';
import { ENEMIES } from './content/index.ts';
import { DEFAULT_BUILD } from './fight.ts';

describe('challenges', () => {
  it('have unique ids and sit after an existing enemy', () => {
    expect(new Set(CHALLENGES.map((c) => c.id)).size).toBe(CHALLENGES.length);
    for (const c of CHALLENGES) expect(ENEMIES.some((e) => e.id === c.after), c.id).toBe(true);
  });

  for (const c of CHALLENGES) {
    it(`${c.id} can be solved, and is not solved from the start`, () => {
      switch (c.kind) {
        case 'glitch': {
          const good = enemyScript(c.enemy);
          const buggy = injectGlitch(c, good);
          expect(buggy).not.toBe(good);
          const build = DEFAULT_BUILD;
          expect(checkGlitch(c, buggy, build)).toBe(false);
          expect(checkGlitch(c, good, build)).toBe(true);
          expect(checkGlitch(c, c.fallback, build), 'the fallback must be broken too').toBe(false);
          break;
        }
        case 'constraint': {
          const build = DEFAULT_BUILD;
          const breaking = c.violation ?? `${c.solution}\nwait()`;
          expect(checkConstraint(c, c.solution, build)).toBe(true);
          expect(checkConstraint(c, breaking, build)).toBe(false);
          break;
        }
      }
    });
  }

  it('injects the bug into the players own script when it fits, else uses the fallback', () => {
    const c = CHALLENGES.find((x) => x.id === 'gl-foward')!;
    if (c.kind !== 'glitch') throw new Error();
    expect(injectGlitch(c, 'forward()\nfire()')).toBe('foward()\nfire()');
    expect(injectGlitch(c, 'fire()')).toBe(c.fallback);
    expect(START_BUILD.gear).toContain('blaster');
  });
});

const enemyOf = (id: string) => ENEMIES.find((e) => e.id === id)!;
const enemyScript = (id: string) => enemyOf(id).solution;
