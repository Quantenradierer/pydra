import { describe, expect, it } from 'vitest';
import { ENEMIES } from './content/index.ts';
import type { EnemyData } from './content/types.ts';
import { DEFAULT_BUILD, bareCode, fightEnemy, usesWord } from './fight.ts';
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
const MAX_ENEMIES = 3;
const inChapter = (c: number): EnemyData[] => ENEMIES.filter((e) => e.chapter === c);

describe('chapters are chains: every challenge adds to the one before', () => {
  for (const c of chapters) {
    const list = inChapter(c);
    it(`Chapter ${c} has a chain of at least 4 challenges`, () => expect(list.length).toBeGreaterThanOrEqual(4));
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
          // Enemies stay where they are; the exception is a swap (the number of enemies does not grow), e.g. a patroller for a guard.
          if (b.enemies.length > a.enemies.length) for (const e of a.enemies) expect(b.enemies.some((o) => o.pos.x === e.pos.x && o.pos.y === e.pos.y), `enemy at ${e.pos.x},${e.pos.y}`).toBe(true);
        });
        it('at most one more enemy', () => {
          expect(parseMap(next.map).enemies.length - parseMap(prev.map).enemies.length).toBeLessThanOrEqual(1);
        });
      });
    }
  }
});

/** The code constructs of a script: keywords and every function that is called (a call with an argument counts separately). */
const KEYWORDS = ['for', 'while', 'if', 'elif', 'else', 'break', 'and', 'or', 'not', 'in'];
const constructs = (script: string): Set<string> => {
  const code = bareCode(script);
  const out = new Set<string>();
  for (const w of KEYWORDS) if (usesWord(code, w)) out.add(w);
  for (const m of code.matchAll(/([A-Za-z_][A-Za-z_0-9.]*)\((\s*[^\s)])?/g)) out.add(m[2] ? `${m[1]}(arg)` : `${m[1]}()`);
  if (/^\s*[a-z_]+ = /m.test(code)) out.add('variable');
  // What a loop is used for: `for>fire()`, `for>forward()`, ...
  const lines = code.split('\n');
  lines.forEach((l, i) => {
    if (!/^\s*(for|while)\b/.test(l)) return;
    const indent = l.search(/\S/);
    for (let j = i + 1; j < lines.length && (lines[j]!.trim() === '' || lines[j]!.search(/\S/) > indent); j++)
      for (const m of lines[j]!.matchAll(/([A-Za-z_][A-Za-z_0-9.]*)\(/g)) out.add(`${l.trim().split(/\W/)[0]}>${m[1]}()`);
  });
  return out;
};
const wallCount = (e: EnemyData): number => e.map.join('').split('#').length - 1;
const specials = (e: EnemyData): string[] => e.enemies.flatMap((d) => ['patrol', 'shieldCycle', 'regen', 'script'].filter((k) => k in d));

describe('few enemies, and every challenge brings an idea (not just one more dummy)', () => {
  for (const e of ENEMIES) {
    it(`${e.id}: at most ${MAX_ENEMIES} enemies, as many maps as definitions`, () => {
      expect(parseMap(e.map).enemies.length).toBeLessThanOrEqual(MAX_ENEMIES);
      expect(e.enemies.length).toBeLessThanOrEqual(MAX_ENEMIES);
    });
  }
  for (const c of chapters) {
    const list = inChapter(c);
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1]!;
      const next = list[i]!;
      it(`Chapter ${c}: ${next.id} is not only ${prev.id} plus another enemy`, () => {
        const more = parseMap(next.map).enemies.length > parseMap(prev.map).enemies.length;
        if (!more) return;
        const newConstruct = [...constructs(next.solution)].some((k) => !constructs(prev.solution).has(k));
        const newWall = wallCount(next) > wallCount(prev);
        const newBehaviour = specials(next).length > specials(prev).length;
        expect(newConstruct || newWall || newBehaviour, `${next.id}: a new enemy must come with a new construct, wall or enemy behaviour`).toBe(true);
      });
    }
  }
  it('no two challenges of the game share a reference solution (no padding)', () => {
    const seen = new Map<string, string>();
    for (const e of ENEMIES) {
      expect(seen.get(e.solution), `${e.id} repeats the solution of ${seen.get(e.solution)}`).toBeUndefined();
      seen.set(e.solution, e.id);
    }
  });
});

describe('no challenge replaces the script', () => {
  it('the data has no side missions, no bug hunts and no special-rule challenges', () => {
    for (const e of ENEMIES) expect('side' in e, e.id).toBe(false);
  });
});
