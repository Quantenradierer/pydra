/** The hydra games that award points; the same keys as their routes. */
export const XP_GAMES = ['game', 'hunt', 'order', 'predict'] as const;
export type XpGame = (typeof XP_GAMES)[number];

export const isXpGame = (v: unknown): v is XpGame => (XP_GAMES as readonly unknown[]).includes(v);

/** Something the player did that may earn points. */
export type PointsEvent =
  /** A quiz question was answered. */
  | { type: 'quiz'; id: string; correct: boolean }
  /** A quiz session ended. */
  | { type: 'session'; perfect: boolean }
  /** A level was solved for the first time; `clean` = without a wrong try. */
  | { type: 'level'; game: XpGame; id: string; clean: boolean }
  /** The daily challenge of `day` was finished; `right[i]` = step i was answered right. */
  | { type: 'daily'; day: string; right: boolean[] };

/** What one local day added up to; the daily tasks adapt to the last days. */
export interface DayStats {
  quizAnswers: number;
  quizCorrect: number;
  levels: number;
}

export type TaskKind = 'quiz' | 'levels' | 'game';

export interface DailyTask {
  id: string;
  kind: TaskKind;
  /** Only for kind "game". */
  game?: XpGame;
  target: number;
  progress: number;
  done: boolean;
}

export interface Daily {
  /** Local date, YYYY-MM-DD. */
  day: string;
  tasks: DailyTask[];
}

/** Everything the point system saves. */
export interface PointsState {
  total: number;
  /** Ids that already paid out ("q:<question>", "l:<game>:<level>", "p:<day>", "d:<day>"). */
  awarded: string[];
  streak: { days: number; last: string };
  bestStreak: number;
  history: Record<string, DayStats>;
  daily?: Daily;
  /** Achievement id -> ISO timestamp of the unlock. */
  achievements: Record<string, string>;
  tasksDone: number;
  perfectSessions: number;
  /** The daily challenge streak: consecutive days finished, ending on `last`. */
  challenge: { days: number; last: string };
  bestChallenge: number;
  /** Daily challenges finished. */
  challenges: number;
}

export function emptyPoints(): PointsState {
  return {
    total: 0,
    awarded: [],
    streak: { days: 0, last: '' },
    bestStreak: 0,
    history: {},
    achievements: {},
    tasksDone: 0,
    perfectSessions: 0,
    challenge: { days: 0, last: '' },
    bestChallenge: 0,
    challenges: 0,
  };
}

/** Local date as YYYY-MM-DD. */
export function dayKey(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function previousDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return dayKey(new Date(y, m - 1, d - 1));
}

/** A streak as it stands on `day`: broken when neither today nor yesterday counted. */
export function streakOn(streak: { days: number; last: string }, day: string): number {
  return streak.last === day || streak.last === previousDay(day) ? streak.days : 0;
}

/** The practice streak as it stands on `day`. */
export function currentStreak(state: PointsState, day: string): number {
  return streakOn(state.streak, day);
}

/** The daily challenge streak as it stands on `day`. */
export function currentChallengeStreak(state: PointsState, day: string): number {
  return streakOn(state.challenge, day);
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function parseTask(raw: unknown): DailyTask | undefined {
  if (!isRecord(raw)) return undefined;
  const { id, kind, game, target, progress, done } = raw;
  if (typeof id !== 'string' || (kind !== 'quiz' && kind !== 'levels' && kind !== 'game')) return undefined;
  if (!isCount(target) || target < 1 || !isCount(progress) || typeof done !== 'boolean') return undefined;
  if (kind === 'game' && !isXpGame(game)) return undefined;
  return { id, kind, ...(kind === 'game' ? { game: game as XpGame } : {}), target, progress: Math.min(progress, target), done };
}

/** Reads saved points defensively: anything malformed reads as "nothing yet" or is dropped. */
export function parsePoints(raw: unknown): PointsState {
  if (!isRecord(raw) || !isCount(raw.total)) return emptyPoints();
  const state = emptyPoints();
  state.total = raw.total;
  if (Array.isArray(raw.awarded)) state.awarded = [...new Set(raw.awarded.filter((s): s is string => typeof s === 'string'))];
  if (isRecord(raw.streak) && isCount(raw.streak.days) && typeof raw.streak.last === 'string') {
    state.streak = { days: raw.streak.days, last: raw.streak.last };
  }
  state.bestStreak = Math.max(isCount(raw.bestStreak) ? raw.bestStreak : 0, state.streak.days);
  if (isRecord(raw.history)) {
    for (const [day, v] of Object.entries(raw.history)) {
      if (!DAY.test(day) || !isRecord(v)) continue;
      if (isCount(v.quizAnswers) && isCount(v.quizCorrect) && isCount(v.levels)) {
        state.history[day] = { quizAnswers: v.quizAnswers, quizCorrect: v.quizCorrect, levels: v.levels };
      }
    }
  }
  if (isRecord(raw.daily) && typeof raw.daily.day === 'string' && DAY.test(raw.daily.day) && Array.isArray(raw.daily.tasks)) {
    const tasks = raw.daily.tasks.map(parseTask);
    if (tasks.every((t) => t !== undefined)) state.daily = { day: raw.daily.day, tasks: tasks as DailyTask[] };
  }
  if (isRecord(raw.achievements)) {
    for (const [id, at] of Object.entries(raw.achievements)) if (typeof at === 'string') state.achievements[id] = at;
  }
  if (isCount(raw.tasksDone)) state.tasksDone = raw.tasksDone;
  if (isCount(raw.perfectSessions)) state.perfectSessions = raw.perfectSessions;
  if (isRecord(raw.challenge) && isCount(raw.challenge.days) && typeof raw.challenge.last === 'string') {
    state.challenge = { days: raw.challenge.days, last: raw.challenge.last };
  }
  state.bestChallenge = Math.max(isCount(raw.bestChallenge) ? raw.bestChallenge : 0, state.challenge.days);
  if (isCount(raw.challenges)) state.challenges = raw.challenges;
  return state;
}
