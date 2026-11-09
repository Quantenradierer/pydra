import { describe, expect, it } from 'vitest';
import { ENEMIES } from './content/index.ts';
import type { EnemyData } from './content/types.ts';
import { DEFAULT_BUILD, fightEnemy } from './fight.ts';
import { parseMap } from './layout.ts';
import { precheck } from './battle.ts';

/**
 * The player's script is ONE script that grows. Inside a chapter every challenge adds exactly one thing, so the reference
 * solution of challenge n contains the solution of challenge n-1 (its lines, in order, indentation aside) and the old
 * solution still runs on the new map. The arena stays the same frame and only gets more things in it.
 */
const lines = (s: string) => s.split('\n').map((l) => l.trim()).filter((l) => l !== '');
const isSubsequence = (small: string[], big: string[]): boolean => {
  let i = 0;
  for (const l of big) if (i < small.length && l === small[i]) i++;
  return i === small.length;
};
const chapters = [0, 1, 2, 3, 4];
const inChapter = (c: number): EnemyData[] => ENEMIES.filter((e) => e.chapter === c);

describe('chapters are chains: every challenge adds to the one before', () => {
  for (const c of chapters) {
    const list = inChapter(c);
    it(`Chapter ${c} has a chain of at least 5 challenges`, () => expect(list.length).toBeGreaterThanOrEqual(5));
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1]!;
      const next = list[i]!;
      describe(`Chapter ${c}: ${prev.id} -> ${next.id}`, () => {
        it('the new solution contains the old one, line by line in order', () => {
          expect(isSubsequence(lines(prev.solution), lines(next.solution))).toBe(true);
          expect(lines(next.solution).length, 'a step adds something').toBeGreaterThan(lines(prev.solution).length);
        });
        it('the old solution still runs on the new map without an error', () => {
          expect(precheck(DEFAULT_BUILD, prev.solution)).toBeUndefined();
          const r = fightEnemy(next, DEFAULT_BUILD, prev.solution);
          expect(r.fight.battle.error?.message).toBeUndefined();
        });
        it('the arena is the same frame: same size, same start, nothing taken away', () => {
          const a = parseMap(prev.map);
          const b = parseMap(next.map);
          expect([b.tiles.length, b.tiles[0]!.length, b.player]).toEqual([a.tiles.length, a.tiles[0]!.length, a.player]);
          for (let y = 0; y < a.tiles.length; y++) for (let x = 0; x < a.tiles[0]!.length; x++) if (a.tiles[y]![x] !== 'floor') expect(b.tiles[y]![x], `tile ${x},${y}`).toBe(a.tiles[y]![x]);
          for (const e of a.enemies) expect(b.enemies.some((o) => o.pos.x === e.pos.x && o.pos.y === e.pos.y), `enemy at ${e.pos.x},${e.pos.y}`).toBe(true);
        });
        it('at most one more enemy', () => {
          expect(parseMap(next.map).enemies.length - parseMap(prev.map).enemies.length).toBeLessThanOrEqual(1);
        });
      });
    }
  }
});

describe('the review chapters keep one script', () => {
  for (const c of [25, 45]) {
    it(`chapter ${c}: one solution for every fight, and it runs on all of them`, () => {
      const list = inChapter(c);
      expect(new Set(list.map((e) => e.solution)).size).toBe(1);
      for (let i = 1; i < list.length; i++) expect(fightEnemy(list[i]!, DEFAULT_BUILD, list[i - 1]!.solution).fight.battle.error?.message).toBeUndefined();
    });
  }
});

describe('no challenge replaces the script', () => {
  it('the data has no side missions, no bug hunts and no special-rule challenges', () => {
    for (const e of ENEMIES) expect('side' in e, e.id).toBe(false);
  });
});
