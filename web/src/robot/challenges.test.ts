import { describe, expect, it } from 'vitest';
import { START_BUILD } from './build.ts';
import { CHALLENGES, checkConstraint, checkGlitch, checkLineUp, checkPredict, checkWorkshop, injectGlitch, predictAnswer, shuffledLines } from './challenges.ts';
import { ENEMIES } from './content/index.ts';
import { fullBuild } from './fight.ts';

describe('challenges', () => {
  it('have unique ids and sit after an existing enemy', () => {
    expect(new Set(CHALLENGES.map((c) => c.id)).size).toBe(CHALLENGES.length);
    for (const c of CHALLENGES) expect(ENEMIES.some((e) => e.id === c.after), c.id).toBe(true);
  });

  for (const c of CHALLENGES) {
    it(`${c.id} can be solved, and is not solved from the start`, () => {
      switch (c.kind) {
        case 'lineup': {
          const shuffled = shuffledLines(c);
          expect(shuffled.slice().sort()).toEqual(c.lines.slice().sort());
          expect(shuffled).not.toEqual(c.lines);
          expect(checkLineUp(c, shuffled)).toBe(false);
          expect(checkLineUp(c, c.lines)).toBe(true);
          break;
        }
        case 'predict': {
          const answer = predictAnswer(c);
          expect(answer).not.toBe('');
          expect(checkPredict(c, answer)).toBe(true);
          expect(checkPredict(c, 'nope')).toBe(false);
          break;
        }
        case 'glitch': {
          const good = enemyScript(c.enemy);
          const buggy = injectGlitch(c, good);
          expect(buggy).not.toBe(good);
          expect(checkGlitch(c, buggy, fullBuild(undefined))).toBe(false);
          expect(checkGlitch(c, good, fullBuild(undefined))).toBe(true);
          break;
        }
        case 'workshop': {
          expect(checkWorkshop(c, '').ok).toBe(false);
          expect(checkWorkshop(c, c.solution).ok).toBe(true);
          break;
        }
        case 'constraint': {
          const long = `${enemyScript(c.enemy)}\nwait()`;
          expect(checkConstraint(c, c.solution, fullBuild(undefined))).toBe(true);
          expect(checkConstraint(c, long, fullBuild(undefined))).toBe(false);
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

const enemyScript = (id: string) => ENEMIES.find((e) => e.id === id)!.solution;
