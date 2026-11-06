import { describe, expect, it } from 'vitest';
import { DAILY_SNIPPETS } from '../content/daily.ts';
import { cycleOrder, dailyIndex, dayNumber, INTRO_START, type PoolItem } from './select.ts';

const pool: readonly PoolItem[] = DAILY_SNIPPETS;
const intro = DAILY_SNIPPETS.filter((s) => s.level === 0);
const regular = DAILY_SNIPPETS.filter((s) => s.level > 0);
const addDays = (day: string, n: number) => {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d + n));
  return date.toISOString().slice(0, 10);
};
const pick = (day: string) => DAILY_SNIPPETS[dailyIndex(day, pool)]!;
/** First day after the intro week. */
const FIRST_REGULAR = addDays(INTRO_START, intro.length);

describe('dayNumber', () => {
  it('counts calendar days', () => {
    expect(dayNumber('1970-01-01')).toBe(0);
    expect(dayNumber('2026-03-29') - dayNumber('2026-03-28')).toBe(1); // a daylight saving switch
    expect(dayNumber('2027-01-01') - dayNumber('2026-01-01')).toBe(365);
  });
});

describe('the intro week', () => {
  it('starts on the launch date with 7 intro snippets', () => {
    expect(INTRO_START).toBe('2026-11-06');
    expect(intro.map((s) => s.id)).toEqual(['intro-01', 'intro-02', 'intro-03', 'intro-04', 'intro-05', 'intro-06', 'intro-07']);
  });

  it('plays intro-01 to intro-07 on 2026-11-06 to 2026-11-12', () => {
    const days = ['2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'];
    expect(days.map((d) => pick(d).id)).toEqual(intro.map((s) => s.id));
  });

  it('continues with an easy regular snippet on 2026-11-13, of another topic than the last intro day', () => {
    const s = pick('2026-11-13');
    expect(FIRST_REGULAR).toBe('2026-11-13');
    expect(s.level).toBe(1);
    expect(s.topic).not.toBe(pick('2026-11-12').topic);
  });

  it('is never played again after the week', () => {
    for (let i = 0; i < 800; i++) expect(pick(addDays(FIRST_REGULAR, i)).level, `day ${i}`).toBeGreaterThan(0);
  });

  it('follows the calendar over month and year borders', () => {
    // A pool with a 3-day intro week starting on the launch date, to cross borders; the real pool is checked above.
    const small: PoolItem[] = [{ topic: 'a', level: 0 }, { topic: 'b', level: 0 }, { topic: 'c', level: 0 }, { topic: 'a', level: 1 }, { topic: 'b', level: 1 }];
    expect([0, 1, 2].map((i) => dailyIndex(addDays(INTRO_START, i), small))).toEqual([0, 1, 2]);
    // Month, year and leap day: one calendar day is one step.
    for (const start of ['2026-12-31', '2028-02-28', '2027-02-28']) {
      const a = dailyIndex(start, pool);
      const b = dailyIndex(addDays(start, 1), pool);
      const c = dailyIndex(addDays(start, 2), pool);
      expect(pool[a]!.topic).not.toBe(pool[b]!.topic);
      expect(pool[b]!.topic).not.toBe(pool[c]!.topic);
    }
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(dayNumber('2028-03-01') - dayNumber('2028-02-28')).toBe(2);
  });
});

describe('dailyIndex', () => {
  it('is deterministic and in range', () => {
    expect(dailyIndex('2026-11-20', pool)).toBe(dailyIndex('2026-11-20', pool));
    for (let i = 0; i < 400; i++) {
      const index = dailyIndex(addDays('2026-01-01', i), pool);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(pool.length);
    }
  });

  it('uses every regular snippet once per cycle before any repeats', () => {
    for (let cycle = 0; cycle < 5; cycle++) {
      const seen = new Set<string>();
      for (let i = 0; i < regular.length; i++) seen.add(pick(addDays(FIRST_REGULAR, cycle * regular.length + i)).id);
      expect(seen.size).toBe(regular.length);
    }
  });

  it('goes easy to hard inside every cycle, starting each cycle with level 1', () => {
    for (let cycle = 0; cycle < 5; cycle++) {
      const levels: number[] = [];
      for (let i = 0; i < regular.length; i++) levels.push(pick(addDays(FIRST_REGULAR, cycle * regular.length + i)).level);
      expect(levels[0]).toBe(1);
      expect(levels).toEqual([...levels].sort((a, b) => a - b));
      expect(new Set(levels)).toEqual(new Set([1, 2, 3]));
    }
  });

  it('never gives two days in a row the same topic, also across the intro week and the cycle borders', () => {
    let day = INTRO_START;
    let before = pick(day).topic;
    for (let i = 0; i < 1500; i++) {
      day = addDays(day, 1);
      const topic = pick(day).topic;
      expect(topic, day).not.toBe(before);
      before = topic;
    }
  });

  it('is the same pick for the same date and still works before the launch date', () => {
    for (const day of ['2026-01-01', '2026-11-05', '2020-02-29']) {
      expect(dailyIndex(day, pool)).toBe(dailyIndex(day, pool));
      expect(pick(day).level).toBeGreaterThan(0);
    }
  });

  it('shuffles differently in different cycles', () => {
    expect(cycleOrder(regular, 1)).not.toEqual(cycleOrder(regular, 2));
  });

  it('rejects an empty pool and copes with tiny ones', () => {
    expect(() => dailyIndex('2026-01-01', [])).toThrow();
    expect(dailyIndex('2026-01-01', [{ topic: 'a', level: 1 }])).toBe(0);
    const two: PoolItem[] = [{ topic: 'a', level: 1 }, { topic: 'b', level: 1 }];
    expect(new Set([0, 1, 2, 3].map((i) => dailyIndex(addDays('2026-11-20', i), two)))).toEqual(new Set([0, 1]));
    expect(dailyIndex('2026-12-24', [{ topic: 'a', level: 0 }])).toBe(0); // only intro snippets: they repeat
  });
});
