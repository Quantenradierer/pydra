import { newlyEarned } from './achievements.ts';
import { levelInfo } from './levels.ts';
import {
  currentStreak,
  dayKey,
  previousDay,
  type DailyTask,
  type DayStats,
  type PointsEvent,
  type PointsState,
} from './state.ts';
import { generateTasks, type GameContext } from './tasks.ts';

export const XP = {
  quiz: 10,
  level: 20,
  cleanLevel: 10,
  perfectSession: 25,
  task: 50,
  /** Finishing the daily challenge, plus `dailyStep` for every step answered right. */
  daily: 50,
  dailyStep: 10,
} as const;

/** The streak bonus: +10 % per day, up to a week. */
const STREAK_CAP = 7;
export const streakMultiplier = (days: number) => 1 + Math.min(days, STREAK_CAP) / 10;

/** Days of history kept. */
const KEEP_DAYS = 14;

/** What an event changed, for the toast. */
export interface PointsResult {
  gained: number;
  /** The new player level, if it went up. */
  levelUp?: number;
  tasks: DailyTask[];
  achievements: string[];
}

const NOTHING: PointsResult = { gained: 0, tasks: [], achievements: [] };

/** Makes sure the state holds today's tasks. */
export function rollDay(state: PointsState, day: string, ctx: GameContext): PointsState {
  if (state.daily?.day === day) return state;
  const keep = new Set<string>();
  for (let key = day, i = 0; i < KEEP_DAYS; i++, key = previousDay(key)) keep.add(key);
  const history = Object.fromEntries(Object.entries(state.history).filter(([d]) => keep.has(d)));
  return { ...state, history, daily: { day, tasks: generateTasks(day, state.history, ctx) } };
}

function bump(history: Record<string, DayStats>, day: string, add: Partial<DayStats>): Record<string, DayStats> {
  const old = history[day] ?? { quizAnswers: 0, quizCorrect: 0, levels: 0 };
  return {
    ...history,
    [day]: {
      quizAnswers: old.quizAnswers + (add.quizAnswers ?? 0),
      quizCorrect: old.quizCorrect + (add.quizCorrect ?? 0),
      levels: old.levels + (add.levels ?? 0),
    },
  };
}

/** The state with the achievements that are earned now unlocked. */
function unlockAchievements(state: PointsState, now: Date, ctx: GameContext): { state: PointsState; unlocked: string[] } {
  const unlocked = newlyEarned(state, ctx);
  if (unlocked.length === 0) return { state, unlocked };
  const at = now.toISOString();
  return { state: { ...state, achievements: { ...state.achievements, ...Object.fromEntries(unlocked.map((id) => [id, at])) } }, unlocked };
}

/**
 * The daily challenge: pays once per day (`d:<day>`), 50 XP plus 10 per step
 * answered right, with the streak bonus. It keeps the practice streak going,
 * extends the challenge streak, and touches neither the daily tasks nor the
 * per-question XP.
 */
function applyDaily(
  state: PointsState,
  event: Extract<PointsEvent, { type: 'daily' }>,
  now: Date,
  ctx: GameContext,
): { state: PointsState; result: PointsResult } {
  const id = `d:${event.day}`;
  if (state.awarded.includes(id)) return { state, result: NOTHING };
  const today = dayKey(now);

  let { streak, bestStreak } = state;
  if (streak.last !== today) {
    streak = { days: streak.last === previousDay(today) ? streak.days + 1 : 1, last: today };
    bestStreak = Math.max(bestStreak, streak.days);
  }
  let { challenge } = state;
  if (challenge.last !== event.day) {
    challenge = { days: challenge.last === previousDay(event.day) ? challenge.days + 1 : 1, last: event.day };
  }

  const base = XP.daily + XP.dailyStep * event.right.filter(Boolean).length;
  const gained = Math.round(base * streakMultiplier(currentStreak({ ...state, streak }, today)));
  const total = state.total + gained;
  const paid: PointsState = {
    ...state,
    total,
    awarded: [...state.awarded, id],
    streak,
    bestStreak,
    challenge,
    bestChallenge: Math.max(state.bestChallenge, challenge.days),
    challenges: state.challenges + 1,
  };
  const { state: next, unlocked } = unlockAchievements(paid, now, ctx);
  const was = levelInfo(state.total).level;
  const is = levelInfo(total).level;
  return { state: next, result: { gained, ...(is > was ? { levelUp: is } : {}), tasks: [], achievements: unlocked } };
}

/**
 * Applies one event. Only the first correct answer of a question and the first
 * solve of a level pay out, so replaying earns nothing; the daily tasks and the
 * streak count every correct answer.
 */
export function applyEvent(
  before: PointsState,
  event: PointsEvent,
  now: Date,
  ctx: GameContext,
): { state: PointsState; result: PointsResult } {
  const day = dayKey(now);
  let state = rollDay(before, day, ctx);

  if (event.type === 'daily') return applyDaily(state, event, now, ctx);

  if (event.type === 'quiz' && !event.correct) {
    return { state: { ...state, history: bump(state.history, day, { quizAnswers: 1 }) }, result: NOTHING };
  }

  let base = 0;
  let awarded = state.awarded;
  const pay = (id: string, xp: number) => {
    if (awarded.includes(id)) return;
    awarded = [...awarded, id];
    base += xp;
  };

  let perfectSessions = state.perfectSessions;
  if (event.type === 'quiz') {
    state = { ...state, history: bump(state.history, day, { quizAnswers: 1, quizCorrect: 1 }) };
    pay(`q:${event.id}`, XP.quiz);
  } else if (event.type === 'level') {
    state = { ...state, history: bump(state.history, day, { levels: 1 }) };
    pay(`l:${event.game}:${event.id}`, XP.level + (event.clean ? XP.cleanLevel : 0));
  } else {
    if (!event.perfect) return { state, result: NOTHING };
    perfectSessions++;
    pay(`p:${day}`, XP.perfectSession);
  }

  // A correct answer or a solved level keeps the streak going; a perfect session alone does not.
  let { streak, bestStreak } = state;
  if (event.type !== 'session' && streak.last !== day) {
    streak = { days: streak.last === previousDay(day) ? streak.days + 1 : 1, last: day };
    bestStreak = Math.max(bestStreak, streak.days);
  }
  const gained = Math.round(base * streakMultiplier(currentStreak({ ...state, streak }, day)));

  // Daily tasks.
  const finished: DailyTask[] = [];
  const daily = state.daily!;
  const tasks = daily.tasks.map((task): DailyTask => {
    const counts =
      !task.done &&
      ((event.type === 'quiz' && task.kind === 'quiz') ||
        (event.type === 'level' && (task.kind === 'levels' || (task.kind === 'game' && task.game === event.game))));
    if (!counts) return task;
    const progress = task.progress + 1;
    const next = { ...task, progress, done: progress >= task.target };
    if (next.done) finished.push(next);
    return next;
  });

  const bonus = finished.length * XP.task;
  const total = state.total + gained + bonus;
  let next: PointsState = {
    ...state,
    total,
    awarded,
    streak,
    bestStreak,
    perfectSessions,
    tasksDone: state.tasksDone + finished.length,
    daily: { day, tasks },
  };

  const { state: unlockedState, unlocked } = unlockAchievements(next, now, ctx);
  next = unlockedState;

  const was = levelInfo(state.total).level;
  const is = levelInfo(total).level;
  return {
    state: next,
    result: { gained: gained + bonus, ...(is > was ? { levelUp: is } : {}), tasks: finished, achievements: unlocked },
  };
}

/**
 * Credits what was solved before the point system existed: XP and unlocks,
 * but no streak and no toasts.
 */
export function backfill(state: PointsState, ids: readonly string[], now: Date, ctx: GameContext): PointsState {
  const fresh = [...new Set(ids)].filter((id) => !state.awarded.includes(id));
  const xp = fresh.reduce((n, id) => n + (id.startsWith('q:') ? XP.quiz : XP.level), 0);
  return unlockAchievements({ ...state, total: state.total + xp, awarded: [...state.awarded, ...fresh] }, now, ctx).state;
}
