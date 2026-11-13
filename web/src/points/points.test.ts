import { describe, expect, it } from 'vitest';
import { MemoryKeyValue, AppStorage } from '../storage.ts';
import { CONTENT } from '../content/lessons.ts';
import { ACHIEVEMENTS, newlyEarned, showcase } from './achievements.ts';
import { applyEvent, backfill, streakMultiplier, XP } from './engine.ts';
import { levelInfo, TITLE_COUNT, titleKey, xpForLevel } from './levels.ts';
import { MESSAGES } from '../i18n.ts';
import { PointsService } from './service.ts';
import { currentStreak, dayKey, emptyPoints, parsePoints, previousDay, type GameContext, type PointsEvent, type PointsState } from './state.ts';

const CTX: GameContext = {
  totals: { game: 10, hunt: 10, order: 10, predict: 10, robot: 10, factory: 10, elevator: 10 },
  remaining: { game: 10, hunt: 10, order: 10, predict: 10, robot: 10, factory: 10, elevator: 10 },
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
const level = (game: 'game' | 'hunt' | 'order' | 'predict' | 'robot', id: string, clean = false): PointsEvent => ({ type: 'level', game, id, clean });

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
      history: { '2026-03-10': { quizAnswers: 1 } },
      daily: { day: '2026-03-10', tasks: [] },
      achievements: { a: '2026-03-10T00:00:00Z', b: 4 },
    });
    expect(state.total).toBe(40);
    expect(state.awarded).toEqual(['q:a']);
    expect(state.streak).toEqual({ days: 0, last: '' });
    expect(state).not.toHaveProperty('history');
    expect(state).not.toHaveProperty('daily');
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

  it('is wiped by Reset progress, but the name stays', () => {
    const { service, storage } = setup();
    storage.setPlayerName('Ada');
    service.record(quiz('a'));
    storage.resetProgress();
    expect(storage.points()).toBeUndefined();
    expect(storage.playerName()).toBe('Ada');
  });
});
