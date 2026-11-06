import { previousDay, XP_GAMES, type DailyTask, type DayStats, type XpGame } from './state.ts';

/** What the task generator needs to know about the games. */
export interface GameContext {
  /** Levels per game, and how many are not solved yet. */
  totals: Record<XpGame, number>;
  remaining: Record<XpGame, number>;
}

const DEFAULT_QUIZ = 5;
const DEFAULT_LEVELS = 2;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** FNV-1a: the same day always picks the same game. */
function hash(text: string): number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** The days before `day` that fall into the look-back window. */
function lastDays(day: string, history: Record<string, DayStats>, window = 7): DayStats[] {
  const days: DayStats[] = [];
  for (let key = previousDay(day), i = 0; i < window; i++, key = previousDay(key)) {
    const stats = history[key];
    if (stats) days.push(stats);
  }
  return days;
}

/**
 * The tasks of one day. The same day gives the same tasks; the targets follow
 * the median of the days played in the last week (20 % more than usual, or
 * just the usual when the answers were mostly wrong), within sane bounds.
 */
export function generateTasks(day: string, history: Record<string, DayStats>, ctx: GameContext): DailyTask[] {
  const days = lastDays(day, history);
  const quizDays = days.filter((d) => d.quizCorrect > 0);
  const levelDays = days.filter((d) => d.levels > 0);
  const answers = days.reduce((n, d) => n + d.quizAnswers, 0);
  const correct = days.reduce((n, d) => n + d.quizCorrect, 0);
  const factor = answers > 0 && correct / answers < 0.6 ? 1 : 1.2;

  const quizTarget =
    quizDays.length === 0 ? DEFAULT_QUIZ : clamp(Math.ceil(median(quizDays.map((d) => d.quizCorrect)) * factor), 3, 20);
  const levelTarget =
    levelDays.length === 0 ? DEFAULT_LEVELS : clamp(Math.ceil(median(levelDays.map((d) => d.levels)) * 1.2), 1, 6);

  const open = XP_GAMES.filter((g) => ctx.remaining[g] > 0);
  const remainingTotal = open.reduce((n, g) => n + ctx.remaining[g], 0);
  const task = (t: Omit<DailyTask, 'progress' | 'done'>): DailyTask => ({ ...t, progress: 0, done: false });

  const tasks = [task({ id: 'quiz', kind: 'quiz', target: quizTarget })];
  if (remainingTotal > 0) {
    tasks.push(task({ id: 'levels', kind: 'levels', target: Math.min(levelTarget + 1, remainingTotal) }));
  }
  if (open.length >= 2) {
    const game = open[hash(day) % open.length]!;
    tasks.push(task({ id: `game:${game}`, kind: 'game', game, target: Math.min(Math.max(1, Math.ceil(levelTarget / 2)), ctx.remaining[game]) }));
  }
  return tasks;
}
