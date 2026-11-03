/** Lifetime counters across all sessions. */
export interface Counters {
  /** Finished sessions (quit sessions do not count). */
  sessionsPlayed: number;
  bestScore: number;
  totalAnswers: number;
  totalCorrect: number;
}

/** Per-question history, keyed by question id. Collected for later use. */
export interface QuestionStat {
  seen: number;
  correct: number;
  /** ISO 8601 timestamp of the last answer. */
  lastSeen: string;
}

export type QuestionStats = Record<string, QuestionStat>;

export const EMPTY_COUNTERS: Counters = { sessionsPlayed: 0, bestScore: 0, totalAnswers: 0, totalCorrect: 0 };

export function recordAnswer(counters: Counters, correct: boolean): Counters {
  return {
    ...counters,
    totalAnswers: counters.totalAnswers + 1,
    totalCorrect: counters.totalCorrect + (correct ? 1 : 0),
  };
}

export function recordQuestion(stats: QuestionStats, id: string, correct: boolean, now: Date): QuestionStats {
  const old = stats[id] ?? { seen: 0, correct: 0, lastSeen: '' };
  return {
    ...stats,
    [id]: { seen: old.seen + 1, correct: old.correct + (correct ? 1 : 0), lastSeen: now.toISOString() },
  };
}

export function recordSession(counters: Counters, score: number): Counters {
  return {
    ...counters,
    sessionsPlayed: counters.sessionsPlayed + 1,
    bestScore: Math.max(counters.bestScore, score),
  };
}

/** Share of correct answers in whole percent, or 0 without answers. */
export function percentCorrect(counters: Counters): number {
  return counters.totalAnswers === 0 ? 0 : Math.round((100 * counters.totalCorrect) / counters.totalAnswers);
}

const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

export function parseCounters(raw: unknown): Counters {
  if (typeof raw !== 'object' || raw === null) return EMPTY_COUNTERS;
  const r = raw as Record<string, unknown>;
  const counters = {
    sessionsPlayed: r.sessionsPlayed,
    bestScore: r.bestScore,
    totalAnswers: r.totalAnswers,
    totalCorrect: r.totalCorrect,
  };
  if (!Object.values(counters).every(isCount) || (counters.totalCorrect as number) > (counters.totalAnswers as number)) {
    return EMPTY_COUNTERS;
  }
  return counters as Counters;
}

/** Keeps the well-formed entries, drops the rest. */
export function parseQuestionStats(raw: unknown): QuestionStats {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const stats: QuestionStats = {};
  for (const [id, value] of Object.entries(raw)) {
    if (typeof value !== 'object' || value === null) continue;
    const { seen, correct, lastSeen } = value as Record<string, unknown>;
    if (isCount(seen) && isCount(correct) && correct <= seen && typeof lastSeen === 'string') {
      stats[id] = { seen, correct, lastSeen };
    }
  }
  return stats;
}
