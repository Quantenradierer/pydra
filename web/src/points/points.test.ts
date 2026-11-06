import { describe, expect, it } from 'vitest';
import { MemoryKeyValue, AppStorage } from '../storage.ts';
import { CONTENT } from '../content/lessons.ts';
import { ACHIEVEMENTS, newlyEarned, showcase } from './achievements.ts';
import { applyEvent, backfill, streakMultiplier, XP } from './engine.ts';
import { levelInfo, TITLE_COUNT, titleKey, xpForLevel } from './levels.ts';
import { MESSAGES } from '../i18n.ts';
import { PointsService } from './service.ts';
import { currentStreak, dayKey, emptyPoints, parsePoints, previousDay, type PointsEvent, type PointsState } from './state.ts';
import { generateTasks, median, type GameContext } from './tasks.ts';

const CTX: GameContext = {
  totals: { game: 10, hunt: 10, order: 10, predict: 10 },
  remaining: { game: 10, hunt: 10, order: 10, predict: 10 },
};
const at = (day: string, hour = 12) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`);

function play(state: PointsState, events: PointsEvent[], now: Date, ctx = CTX) {
  let gained = 0;
  for (const event of events) {
    const out = applyEvent(state, event, now, ctx);
    state = out.state;
    gained += out.result.gained;
  }
  return { state, gained };
}
const quiz = (id: string, correct = true): PointsEvent => ({ type: 'quiz', id, correct });
const level = (game: 'game' | 'hunt' | 'order' | 'predict', id: string, clean = false): PointsEvent => ({ type: 'level', game, id, clean });

describe('levels', () => {
  it('needs more XP for each level', () => {
    expect(xpForLevel(1)).toBe(0);
    for (let n = 2; n < 30; n++) expect(xpForLevel(n)).toBeGreaterThan(xpForLevel(n - 1));
  });

  it('finds the level of a total', () => {
    expect(levelInfo(0)).toMatchObject({ level: 1, title: 1, into: 0, span: 180 });
    expect(levelInfo(179).level).toBe(1);
    expect(levelInfo(180)).toMatchObject({ level: 2, into: 0 });
    expect(levelInfo(xpForLevel(12)).title).toBe(12);
    expect(levelInfo(xpForLevel(TITLE_COUNT + 5)).title).toBe(TITLE_COUNT);
  });

  it('has a title for every level in both languages, all different', () => {
    for (const lang of ['de', 'en'] as const) {
      const names = Array.from({ length: TITLE_COUNT }, (_, i) => MESSAGES[lang][titleKey(i + 1)]);
      expect(new Set(names).size, lang).toBe(TITLE_COUNT);
    }
  });

  it('reaches level 10 after a month and the last title after a year of 10 right answers a day', () => {
    // Each answer pays 10 XP times the streak bonus; the streak is never broken.
    let total = 0;
    const reached: Record<number, number> = {};
    for (let day = 1; day <= 365; day++) {
      total += 10 * Math.round(XP.quiz * streakMultiplier(day));
      for (const level of [10, TITLE_COUNT]) if (total >= xpForLevel(level)) reached[level] ??= day;
    }
    expect(reached[10]).toBeLessThanOrEqual(30);
    expect(reached[TITLE_COUNT]).toBe(365);
  });
});

describe('earning XP', () => {
  const day = '2026-03-10';

  it('pays the first right answer of a question only', () => {
    const first = play(emptyPoints(), [quiz('a')], at(day));
    expect(first.gained).toBe(Math.round(XP.quiz * streakMultiplier(1)));
    const again = play(first.state, [quiz('a')], at(day));
    expect(again.gained).toBe(0);
    expect(again.state.total).toBe(first.state.total);
  });

  it('pays nothing for a wrong answer, and a later right one still pays', () => {
    const wrong = play(emptyPoints(), [quiz('a', false)], at(day));
    expect(wrong.gained).toBe(0);
    expect(wrong.state.streak.days).toBe(0);
    expect(wrong.state.history[day]).toEqual({ quizAnswers: 1, quizCorrect: 0, levels: 0 });
    expect(play(wrong.state, [quiz('a')], at(day)).gained).toBeGreaterThan(0);
  });

  it('pays more for a level solved without a wrong try', () => {
    const plain = play(emptyPoints(), [level('hunt', 'x')], at(day)).state.total;
    const clean = play(emptyPoints(), [level('hunt', 'x', true)], at(day)).state.total;
    expect(clean).toBeGreaterThan(plain);
  });

  it('pays a perfect session once a day', () => {
    const one = play(emptyPoints(), [{ type: 'session', perfect: true }], at(day));
    expect(one.gained).toBe(XP.perfectSession);
    expect(one.state.perfectSessions).toBe(1);
    expect(play(one.state, [{ type: 'session', perfect: true }], at(day)).gained).toBe(0);
    expect(play(one.state, [{ type: 'session', perfect: false }], at(day)).gained).toBe(0);
    expect(play(one.state, [{ type: 'session', perfect: true }], at(previousDay(day) === day ? day : '2026-03-11')).gained).toBe(
      XP.perfectSession,
    );
  });

  it('applies the streak bonus, up to a week', () => {
    expect(streakMultiplier(1)).toBeCloseTo(1.1);
    expect(streakMultiplier(7)).toBeCloseTo(1.7);
    expect(streakMultiplier(50)).toBeCloseTo(1.7);
  });
});

describe('streak', () => {
  it('grows per day, resets after a gap, and does not grow twice a day', () => {
    let s = play(emptyPoints(), [quiz('a')], at('2026-03-10')).state;
    s = play(s, [quiz('b')], at('2026-03-10', 20)).state;
    expect(s.streak.days).toBe(1);
    s = play(s, [quiz('c')], at('2026-03-11')).state;
    expect(s.streak.days).toBe(2);
    s = play(s, [quiz('d')], at('2026-03-14')).state;
    expect(s.streak.days).toBe(1);
    expect(s.bestStreak).toBe(2);
  });

  it('reads as broken when neither today nor yesterday was played', () => {
    const s = play(emptyPoints(), [quiz('a')], at('2026-03-10')).state;
    expect(currentStreak(s, '2026-03-10')).toBe(1);
    expect(currentStreak(s, '2026-03-11')).toBe(1);
    expect(currentStreak(s, '2026-03-12')).toBe(0);
  });

  it('works across month and year ends', () => {
    expect(previousDay('2026-03-01')).toBe('2026-02-28');
    expect(previousDay('2026-01-01')).toBe('2025-12-31');
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('daily tasks', () => {
  const day = '2026-03-10';

  it('gives new players the default targets', () => {
    const tasks = generateTasks(day, {}, CTX);
    expect(tasks.map((t) => t.id)).toEqual(expect.arrayContaining(['quiz', 'levels']));
    expect(tasks.find((t) => t.id === 'quiz')!.target).toBe(5);
    expect(tasks.find((t) => t.id === 'levels')!.target).toBe(3);
    expect(tasks.every((t) => t.progress === 0 && !t.done)).toBe(true);
  });

  it('gives the same tasks for the same day', () => {
    expect(generateTasks(day, {}, CTX)).toEqual(generateTasks(day, {}, CTX));
  });

  it('follows the pace of the last week', () => {
    const history = {
      '2026-03-09': { quizAnswers: 12, quizCorrect: 10, levels: 0 },
      '2026-03-08': { quizAnswers: 12, quizCorrect: 10, levels: 0 },
      '2026-03-07': { quizAnswers: 12, quizCorrect: 10, levels: 0 },
    };
    expect(generateTasks(day, history, CTX).find((t) => t.id === 'quiz')!.target).toBe(12);
  });

  it('does not raise the bar when most answers were wrong', () => {
    const history = { '2026-03-09': { quizAnswers: 30, quizCorrect: 10, levels: 0 } };
    expect(generateTasks(day, history, CTX).find((t) => t.id === 'quiz')!.target).toBe(10);
  });

  it('keeps the targets within bounds', () => {
    const big = { '2026-03-09': { quizAnswers: 500, quizCorrect: 500, levels: 90 } };
    const small = { '2026-03-09': { quizAnswers: 1, quizCorrect: 1, levels: 1 } };
    const t = (h: Record<string, never> | typeof big) => generateTasks(day, h, CTX);
    expect(t(big).find((x) => x.id === 'quiz')!.target).toBe(20);
    expect(t(small).find((x) => x.id === 'quiz')!.target).toBe(3);
    expect(t(big).find((x) => x.id === 'levels')!.target).toBeLessThanOrEqual(7);
  });

  it('ignores days older than a week', () => {
    const old = { '2026-02-01': { quizAnswers: 50, quizCorrect: 50, levels: 0 } };
    expect(generateTasks(day, old, CTX).find((t) => t.id === 'quiz')!.target).toBe(5);
  });

  it('only offers games that still have levels', () => {
    const ctx: GameContext = { ...CTX, remaining: { game: 0, hunt: 0, order: 0, predict: 0 } };
    expect(generateTasks(day, {}, ctx).map((t) => t.id)).toEqual(['quiz']);
    const one: GameContext = { ...CTX, remaining: { game: 0, hunt: 4, order: 0, predict: 0 } };
    expect(generateTasks(day, {}, one).map((t) => t.id)).toEqual(['quiz', 'levels']);
    const two: GameContext = { ...CTX, remaining: { game: 0, hunt: 4, order: 1, predict: 0 } };
    const game = generateTasks(day, {}, two).find((t) => t.kind === 'game')!;
    expect(['hunt', 'order']).toContain(game.game);
  });

  it('computes medians', () => {
    expect(median([])).toBe(0);
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 10])).toBe(2.5);
  });

  it('counts progress, pays on completion and rolls over at midnight', () => {
    const start = applyEvent(emptyPoints(), quiz('q0'), at(day), CTX).state;
    const target = start.daily!.tasks.find((t) => t.id === 'quiz')!.target;
    const events = Array.from({ length: target - 1 }, (_, i) => quiz(`q${i + 1}`));
    let finished = 0;
    let state = start;
    for (const event of events) {
      const out = applyEvent(state, event, at(day), CTX);
      state = out.state;
      finished += out.result.tasks.length;
    }
    expect(finished).toBe(1);
    expect(state.tasksDone).toBe(1);
    expect(state.daily!.tasks.find((t) => t.id === 'quiz')).toMatchObject({ done: true, progress: target });
    // More answers do not complete it again.
    const more = applyEvent(state, quiz('extra'), at(day), CTX);
    expect(more.result.tasks).toEqual([]);
    expect(more.state.tasksDone).toBe(1);
    // A new day, new tasks.
    const next = applyEvent(state, quiz('next'), at('2026-03-11'), CTX).state;
    expect(next.daily!.day).toBe('2026-03-11');
    expect(next.daily!.tasks.find((t) => t.id === 'quiz')!.progress).toBe(1);
  });

  it('counts a level for the any-game task and its game task', () => {
    const state = applyEvent(emptyPoints(), quiz('seed'), at(day), CTX).state;
    const gameTask = state.daily!.tasks.find((t) => t.kind === 'game')!;
    const after = applyEvent(state, level(gameTask.game!, 'l1'), at(day), CTX).state;
    expect(after.daily!.tasks.find((t) => t.id === 'levels')!.progress).toBe(1);
    expect(after.daily!.tasks.find((t) => t.id === gameTask.id)!.progress).toBe(1);
    const other = (['game', 'hunt', 'order', 'predict'] as const).find((g) => g !== gameTask.game)!;
    const third = applyEvent(after, level(other, 'l2'), at(day), CTX).state;
    expect(third.daily!.tasks.find((t) => t.id === gameTask.id)!.progress).toBe(1);
  });

  it('prunes old history', () => {
    const old = { ...emptyPoints(), history: { '2025-01-01': { quizAnswers: 1, quizCorrect: 1, levels: 0 } } };
    expect(Object.keys(applyEvent(old, quiz('a'), at('2026-03-10'), CTX).state.history)).toEqual(['2026-03-10']);
  });
});

describe('achievements', () => {
  it('unlocks the first one after the first right answer, once', () => {
    const first = applyEvent(emptyPoints(), quiz('a'), at('2026-03-10'), CTX);
    expect(first.result.achievements).toEqual(['first-answer']);
    expect(first.state.achievements['first-answer']).toBeDefined();
    expect(applyEvent(first.state, quiz('b'), at('2026-03-10'), CTX).result.achievements).toEqual([]);
    expect(showcase(first.state)?.id).toBe('first-answer');
  });

  it('has unique ids', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });

  it('unlocks game mastery when all levels of a game are solved', () => {
    const ctx: GameContext = { ...CTX, totals: { ...CTX.totals, hunt: 2 }, remaining: { ...CTX.remaining, hunt: 2 } };
    const { state } = play(emptyPoints(), [level('hunt', 'a'), level('hunt', 'b')], at('2026-03-10'), ctx);
    expect(state.achievements['master-hunt']).toBeDefined();
    expect(state.achievements['master-game']).toBeUndefined();
  });

  it('prefers the highest tier for the showcase', () => {
    const state = { ...emptyPoints(), achievements: { 'first-answer': '2026-03-10T10:00:00Z', 'streak-30': '2026-03-09T10:00:00Z' } };
    expect(showcase(state)?.id).toBe('streak-30');
    expect(showcase(emptyPoints())).toBeUndefined();
  });

  it('unlocks the player level achievements', () => {
    const state = { ...emptyPoints(), total: xpForLevel(10) };
    expect(newlyEarned(state, CTX)).toContain('level-10');
    expect(newlyEarned(state, CTX)).not.toContain('level-50');
  });
});

describe('backfill', () => {
  it('credits earlier progress once, silently', () => {
    const state = backfill(emptyPoints(), ['q:a', 'q:b', 'l:hunt:x', 'q:a'], at('2026-03-10'), CTX);
    expect(state.total).toBe(2 * XP.quiz + XP.level);
    expect(state.streak.days).toBe(0);
    expect(state.achievements['first-answer']).toBeDefined();
    expect(backfill(state, ['q:a'], at('2026-03-10'), CTX).total).toBe(state.total);
  });
});

describe('parsePoints', () => {
  it('reads garbage as empty', () => {
    for (const raw of [undefined, null, 5, 'x', [], {}, { total: -1 }, { total: 1.5 }]) expect(parsePoints(raw)).toEqual(emptyPoints());
  });

  it('round-trips a real state', () => {
    const state = play(emptyPoints(), [quiz('a'), level('order', 'o1')], at('2026-03-10')).state;
    expect(parsePoints(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it('drops malformed parts but keeps the rest', () => {
    const state = parsePoints({
      total: 40,
      awarded: ['q:a', 7, 'q:a'],
      streak: { days: 'x' },
      history: { 'not-a-day': { quizAnswers: 1, quizCorrect: 1, levels: 1 }, '2026-03-10': { quizAnswers: 1 } },
      daily: { day: '2026-03-10', tasks: [{ id: 'quiz', kind: 'nope', target: 3, progress: 0, done: false }] },
      achievements: { a: '2026-03-10T00:00:00Z', b: 4 },
    });
    expect(state.total).toBe(40);
    expect(state.awarded).toEqual(['q:a']);
    expect(state.streak).toEqual({ days: 0, last: '' });
    expect(state.history).toEqual({});
    expect(state.daily).toBeUndefined();
    expect(state.achievements).toEqual({ a: '2026-03-10T00:00:00Z' });
  });
});

describe('PointsService', () => {
  const setup = (legacy: string[] = []) => {
    const kv = new MemoryKeyValue();
    const storage = new AppStorage(kv, CONTENT);
    let now = at('2026-03-10');
    const service = new PointsService(storage, () => CTX, () => legacy, () => now);
    return { kv, storage, service, setNow: (d: Date) => (now = d) };
  };

  it('credits earlier progress on the first start only', () => {
    const { service, storage } = setup(['q:a', 'l:game:x']);
    expect(service.state().total).toBe(XP.quiz + XP.level);
    expect(storage.points()?.total).toBe(XP.quiz + XP.level);
    service.record(quiz('a'));
    expect(service.state().total).toBe(XP.quiz + XP.level);
  });

  it('saves every event and tells the listeners', () => {
    const { service, storage } = setup();
    const seen: number[] = [];
    const off = service.subscribe((r) => seen.push(r.gained));
    service.record(quiz('a'));
    service.record(quiz('a'));
    expect(seen).toEqual([11]);
    expect(storage.points()?.awarded).toEqual(['q:a']);
    off();
    service.record(quiz('b'));
    expect(seen).toEqual([11]);
  });

  it('rolls the tasks over on a new day without an event', () => {
    const { service, setNow } = setup();
    service.record(quiz('a'));
    setNow(at('2026-03-11'));
    expect(service.state().daily?.day).toBe('2026-03-11');
    expect(service.state().daily?.tasks.every((t) => t.progress === 0)).toBe(true);
  });

  it('is wiped by Reset progress, but the name stays', () => {
    const { service, storage } = setup();
    storage.setPlayerName('Ada');
    service.record(quiz('a'));
    storage.resetProgress();
    expect(storage.points()).toBeUndefined();
    expect(storage.playerName()).toBe('Ada');
  });
});
