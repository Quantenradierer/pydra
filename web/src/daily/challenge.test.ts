import { describe, expect, it } from 'vitest';
import { DAILY_SNIPPETS, dailyQuestions } from '../content/daily.ts';
import { CONTENT } from '../content/lessons.ts';
import { AppStorage, MemoryKeyValue } from '../storage.ts';
import { applyEvent, XP } from '../points/engine.ts';
import { emptyPoints, parsePoints, type PointsEvent } from '../points/state.ts';
import { PointsService } from '../points/service.ts';
import { ACHIEVEMENTS } from '../points/achievements.ts';
import { present } from '../session.ts';
import { DailyChallenge, parseDaily, scoreOf, shareLine } from './challenge.ts';

function setup(day = '2026-11-07') {
  const storage = new AppStorage(new MemoryKeyValue(), CONTENT);
  const events: PointsEvent[] = [];
  let now = new Date(`${day}T12:00:00`);
  const daily = new DailyChallenge(storage, DAILY_SNIPPETS, () => now, () => 0.3, (e) => events.push(e));
  return { storage, events, daily, setDay: (d: string) => (now = new Date(`${d}T12:00:00`)) };
}

/** Plays the run to the end, answering right on the steps in `rightOn`. */
function playAll(daily: DailyChallenge, rightOn: boolean[]) {
  for (const right of rightOn) {
    const run = daily.session();
    const item = run.items[run.index]!;
    const correct = present(daily.question(item.id), item.order).answerIndex;
    daily.answer(right ? correct : (correct + 1) % 4);
    daily.next();
  }
}

describe('the daily challenge flow', () => {
  it('starts with today\'s snippet and five questions, and picks the same one on the same day', () => {
    const a = setup();
    const b = setup();
    expect(a.daily.state()).toEqual({ kind: 'new' });
    const run = a.daily.begin();
    expect(run.items).toHaveLength(5);
    expect(run.practice).toBe(false);
    expect(a.daily.snippetOf('2026-11-07').id).toBe(b.daily.snippetOf('2026-11-07').id);
    expect(run.snippet).toBe(a.daily.snippetOf('2026-11-07').id);
  });

  it('resumes a run in progress and reports the progress', () => {
    const { storage, daily } = setup();
    daily.begin();
    playAll(daily, [true, false]);
    expect(daily.state()).toEqual({ kind: 'running', answered: 2 });
    const again = new DailyChallenge(storage, DAILY_SNIPPETS, () => new Date('2026-11-07T20:00:00'));
    expect(again.isRunning()).toBe(true);
    expect(again.run().index).toBe(2);
  });

  it('locks the result, reports to the points once, and plays on as practice without effect', () => {
    const { events, daily } = setup();
    daily.begin();
    playAll(daily, [true, true, false, true, false]);
    expect(daily.isRunning()).toBe(false);
    expect(daily.state()).toEqual({ kind: 'done', score: 3 });
    expect(events).toEqual([{ type: 'daily', day: '2026-11-07', right: [true, true, false, true, false] }]);
    expect(shareLine(daily.result()!)).toBe('Pydra Daily 2026-11-07 🐉🐉🐲🐉🐲 3/5');

    const practice = daily.begin();
    expect(practice.practice).toBe(true);
    playAll(daily, [true, true, true, true, true]);
    expect(events).toHaveLength(1);
    expect(daily.state()).toEqual({ kind: 'done', score: 3 });
    expect(scoreOf(daily.practiceResult()!.right)).toBe(5);
  });

  it('drops a run of an earlier day and offers the new day\'s challenge', () => {
    const { daily, setDay } = setup('2026-11-07');
    daily.begin();
    setDay('2026-11-08');
    expect(daily.isRunning()).toBe(false);
    expect(daily.state()).toEqual({ kind: 'new' });
    expect(daily.begin().day).toBe('2026-11-08');
  });

  it('shows yesterday\'s result as not played today', () => {
    const { daily, setDay } = setup('2026-11-07');
    daily.begin();
    playAll(daily, [true, true, true, true, true]);
    setDay('2026-11-08');
    expect(daily.state()).toEqual({ kind: 'new' });
  });
});

describe('parsing saved daily data', () => {
  const snippet = DAILY_SNIPPETS[0]!;
  const ids = dailyQuestions(snippet).map((q) => q.id);
  const items = ids.map((id, i) => ({ id, order: [0, 1, 2, 3], picked: i < 2 ? 0 : null }));
  const run = { day: '2026-11-07', snippet: snippet.id, practice: false, items, index: 2 };

  it('accepts a good run and result', () => {
    const right = [true, false, true, true, false];
    expect(parseDaily({ run, result: { day: '2026-11-06', snippet: snippet.id, right } })).toEqual({
      run,
      result: { day: '2026-11-06', snippet: snippet.id, right },
    });
  });

  it.each([
    ['not an object', 'x'],
    ['an array', []],
    ['a run of an unknown snippet', { run: { ...run, snippet: 'nope-99' } }],
    ['a run with a bad day', { run: { ...run, day: 'today' } }],
    ['a run with shuffled steps', { run: { ...run, items: [...items].reverse() } }],
    ['a run with too few items', { run: { ...run, items: items.slice(0, 3) } }],
    ['a run with an answered later question', { run: { ...run, items: items.map((it) => ({ ...it, picked: 0 })) } }],
    ['a run with a bad order', { run: { ...run, items: items.map((it) => ({ ...it, order: [0, 0, 1, 2] })) } }],
    ['a result with the wrong length', { result: { day: '2026-11-07', snippet: snippet.id, right: [true] } }],
    ['a result with non-booleans', { result: { day: '2026-11-07', snippet: snippet.id, right: [1, 0, 1, 0, 1] } }],
  ])('drops %s', (_name, raw) => {
    const data = parseDaily(raw);
    expect(data.run).toBeUndefined();
    expect(data.result).toBeUndefined();
  });

  it('keeps a good result next to a bad run', () => {
    const data = parseDaily({ run: { ...run, day: 1 }, result: { day: '2026-11-07', snippet: snippet.id, right: [true, true, true, true, true] } });
    expect(data.run).toBeUndefined();
    expect(data.result?.right).toHaveLength(5);
  });

  it('reads corrupt storage as nothing saved', () => {
    const kv = new MemoryKeyValue();
    kv.setItem('pydra.v1.daily', '{not json');
    const storage = new AppStorage(kv, CONTENT);
    const daily = new DailyChallenge(storage, DAILY_SNIPPETS, () => new Date('2026-11-07T12:00:00'));
    expect(daily.state()).toEqual({ kind: 'new' });
    expect(daily.begin().items).toHaveLength(5);
  });

  it('is wiped by Reset progress', () => {
    const { storage, daily } = setup();
    daily.begin();
    storage.resetProgress();
    expect(daily.state()).toEqual({ kind: 'new' });
  });
});

describe('daily challenge points', () => {
  const ctx = {
    totals: { game: 10, hunt: 10, order: 10, predict: 10 },
    remaining: { game: 10, hunt: 10, order: 10, predict: 10 },
  };
  const at = (day: string) => new Date(`${day}T12:00:00`);
  const event = (day: string, n: number): PointsEvent => ({ type: 'daily', day, right: [0, 1, 2, 3, 4].map((i) => i < n) });

  it('pays 50 XP plus 10 per right step, once per day, with the streak bonus', () => {
    const first = applyEvent(emptyPoints(), event('2026-11-07', 3), at('2026-11-07'), ctx);
    expect(first.result.gained).toBe(Math.round((XP.daily + 3 * XP.dailyStep) * 1.1));
    expect(first.state.awarded).toContain('d:2026-11-07');
    expect(first.state.challenges).toBe(1);
    const again = applyEvent(first.state, event('2026-11-07', 5), at('2026-11-07'), ctx);
    expect(again.result.gained).toBe(0);
    expect(again.state.total).toBe(first.state.total);
    expect(again.state.challenges).toBe(1);
  });

  it('pays nothing for the quiz questions and keeps the daily tasks untouched', () => {
    const { state } = applyEvent(emptyPoints(), event('2026-11-07', 5), at('2026-11-07'), ctx);
    expect(state.awarded.filter((id) => id.startsWith('q:'))).toEqual([]);
    expect(state.daily!.tasks.every((t) => t.progress === 0)).toBe(true);
    expect(state.history['2026-11-07']).toBeUndefined();
  });

  it('counts as activity for the practice streak', () => {
    const { state } = applyEvent(emptyPoints(), event('2026-11-07', 0), at('2026-11-07'), ctx);
    expect(state.streak).toEqual({ days: 1, last: '2026-11-07' });
  });

  it('builds a challenge streak over consecutive days and restarts after a gap', () => {
    let state = emptyPoints();
    for (const day of ['2026-11-05', '2026-11-06', '2026-11-07']) state = applyEvent(state, event(day, 2), at(day), ctx).state;
    expect(state.challenge).toEqual({ days: 3, last: '2026-11-07' });
    expect(state.bestChallenge).toBe(3);
    state = applyEvent(state, event('2026-11-09', 2), at('2026-11-09'), ctx).state;
    expect(state.challenge).toEqual({ days: 1, last: '2026-11-09' });
    expect(state.bestChallenge).toBe(3);
  });

  it('unlocks the three daily achievements', () => {
    expect(ACHIEVEMENTS).toHaveLength(24);
    let state = emptyPoints();
    const out = applyEvent(state, event('2026-01-01', 5), at('2026-01-01'), ctx);
    expect(out.result.achievements).toContain('daily-1');
    state = out.state;
    for (let i = 2; i <= 30; i++) {
      const day = `2026-01-${String(i).padStart(2, '0')}`;
      const step = applyEvent(state, event(day, 1), at(day), ctx);
      state = step.state;
      if (i === 7) expect(step.result.achievements).toContain('daily-streak-7');
      if (i === 29) expect(step.result.achievements).not.toContain('daily-30');
    }
    expect(state.achievements['daily-streak-7']).toBeDefined();
    expect(state.achievements['daily-30']).toBeDefined();
    expect(ACHIEVEMENTS.find((a) => a.id === 'daily-streak-7')!.tier).toBe('gold');
    expect(ACHIEVEMENTS.find((a) => a.id === 'daily-30')!.tier).toBe('gold');
  });

  it('parses the new fields defensively and saves through the service', () => {
    expect(parsePoints({ total: 5, challenge: { days: -1, last: 3 }, bestChallenge: 'x', challenges: 1.5 })).toMatchObject({
      challenge: { days: 0, last: '' },
      bestChallenge: 0,
      challenges: 0,
    });
    expect(parsePoints({ total: 5, challenge: { days: 4, last: '2026-01-01' }, challenges: 9 })).toMatchObject({
      challenge: { days: 4, last: '2026-01-01' },
      bestChallenge: 4,
      challenges: 9,
    });
    const storage = new AppStorage(new MemoryKeyValue(), CONTENT);
    const points = new PointsService(storage, () => ctx, () => [], () => at('2026-11-07'));
    points.record(event('2026-11-07', 5));
    points.record(event('2026-11-07', 5));
    expect(points.state().challenges).toBe(1);
    expect(points.state().total).toBe(Math.round(100 * 1.1));
  });
});
