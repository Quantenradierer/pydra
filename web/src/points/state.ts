/** The hydra games that award points; the same keys as their routes. */
export const XP_GAMES = ['game', 'hunt', 'order', 'predict', 'robot'] as const;
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

/** What the games look like to the achievements: levels per game and how many are not solved yet. */
export interface GameContext {
  totals: Record<XpGame, number>;
  remaining: Record<XpGame, number>;
}

/** Everything the point system saves. */
export interface PointsState {
  total: number;
  /** Ids that already paid out ("q:<question>", "l:<game>:<level>", "p:<day>", "d:<day>"). */
  awarded: string[];
  streak: { days: number; last: string };
  bestStreak: number;
  /** Achievement id -> ISO timestamp of the unlock. */
  achievements: Record<string, string>;
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
    achievements: {},
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
  if (isRecord(raw.achievements)) {
    for (const [id, at] of Object.entries(raw.achievements)) if (typeof at === 'string') state.achievements[id] = at;
  }
  if (isCount(raw.perfectSessions)) state.perfectSessions = raw.perfectSessions;
  if (isRecord(raw.challenge) && isCount(raw.challenge.days) && typeof raw.challenge.last === 'string') {
    state.challenge = { days: raw.challenge.days, last: raw.challenge.last };
  }
  state.bestChallenge = Math.max(isCount(raw.bestChallenge) ? raw.bestChallenge : 0, state.challenge.days);
  if (isCount(raw.challenges)) state.challenges = raw.challenges;
  return state;
}
