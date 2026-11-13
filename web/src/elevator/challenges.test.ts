import { describe, expect, it } from 'vitest';
import { BUILDINGS, CHALLENGES, CHALLENGE_IDS, numberOf, previous, spawnsOf } from './challenges.ts';
import { judge } from './game.ts';
import { precheck } from './run.ts';

/** The challenge shown as number `n`. */
const byNo = (n: string) => CHALLENGES[Number(n) - 1]!;
/** The code a challenge opens with for somebody who solved the one before with its reference. */
const startOf = (n: string) => byNo(n).starter ?? previous(byNo(n).id)!.reference;
const start = (n: string) => judge(byNo(n), startOf(n));

describe('the challenges', () => {
  it('are known by a UUID each, numbered by their place, grouped by building in the order of the buildings', () => {
    for (const id of CHALLENGE_IDS) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(new Set(CHALLENGE_IDS).size).toBe(CHALLENGES.length);
    expect(CHALLENGES.map((c) => numberOf(c.id))).toEqual(CHALLENGES.map((_, i) => i + 1));
    const order = CHALLENGES.map((c) => BUILDINGS.indexOf(c.building));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(new Set(CHALLENGES.map((c) => c.building))).toEqual(new Set(BUILDINGS));
  });

  it('start easy: two floors and one elevator', () => {
    expect(CHALLENGES[0]).toMatchObject({ floors: 2, cars: 1 });
  });

  it('plan the same people every time, inside the time limit, on floors that exist and are open', () => {
    for (const c of CHALLENGES) {
      const a = spawnsOf(c);
      expect(spawnsOf(c), c.id).toEqual(a);
      expect(a.length, c.id).toBeGreaterThanOrEqual(c.goal.people);
      for (const s of a) {
        expect(s.from, c.id).not.toBe(s.to);
        for (const f of [s.from, s.to]) {
          expect(f >= 0 && f < c.floors, c.id).toBe(true);
          expect(c.closed ?? [], c.id).not.toContain(f);
          if (c.stops) expect(c.stops, c.id).toContain(f);
        }
        expect(s.tick, c.id).toBeLessThanOrEqual(c.goal.seconds * 10);
        if (c.pattern === 'lobby') expect(s.from).toBe(0);
        if (c.pattern === 'down') expect(s.to).toBe(0);
        if (c.pattern === 'upward') expect(s.to > s.from || s.from === c.floors - 1).toBe(true);
        if (c.pattern === 'downward') expect(s.to < s.from || s.from === 0).toBe(true);
      }
    }
  });

  for (const c of CHALLENGES) {
    it(`${numberOf(c.id)}: the reference solution passes, with time to spare`, () => {
      expect(precheck(c.reference, c.cars), c.id).toBeUndefined();
      const r = judge(c, c.reference);
      expect(r.passed, `${c.id}: ${r.misses.join('+')}${r.problem?.kind ?? ''}`).toBe(true);
      // "Good enough for beginners": the reference needs at most 70 % of the time.
      expect(r.stats.elapsed, c.id).toBeLessThanOrEqual(c.goal.seconds * 0.7);
    });

    // The first one shows what the game is about: it starts with its solution.
    const n = String(numberOf(c.id));
    it(`${n}: the code it starts with ${n === '1' ? 'is the solution' : 'does not pass yet'}`, () => {
      expect(start(n).passed, n).toBe(n === '1');
    });
  }

  it('says for every challenge how its start code fails', () => {
    // The elevator moves once: it takes them upstairs, but never brings them down.
    expect(start('2')).toMatchObject({ misses: ['time'] });
    expect(start('2').stats).toMatchObject({ transported: 0, moves: 1 });
    expect(start('3')).toMatchObject({ misses: ['time'], neverVisited: 2 });
    expect(start('4').misses).toEqual(['time']);
    // 4's route goes upwards: whoever wants to go down rides up first, and in 6 the other way round.
    expect(start('5').misses).toEqual(['wait']);
    expect(start('6').misses).toEqual(['wait']);
    expect(start('7').misses).toEqual(['time']);
    // 7's loop only reaches six of the 20 floors: whoever waits higher up never gets fetched.
    expect(start('8').misses).toEqual(['time']);
    // 8's loop stops on all 20 floors: whoever waits upstairs waits too long.
    expect(start('9').misses).toEqual(['wait']);
  });

  it('have a title and a task in both languages, and a toolbox', () => {
    for (const c of CHALLENGES) {
      for (const lang of ['de', 'en'] as const) {
        expect(c.title[lang].trim(), c.id).not.toBe('');
        expect(c.task[lang].trim(), c.id).not.toBe('');
      }
      expect(c.toolbox.length, c.id).toBeGreaterThan(0);
    }
  });
});
