import { XP_GAMES, type PointsState, type XpGame } from './state.ts';
import { levelInfo } from './levels.ts';
import type { GameContext } from './tasks.ts';

export type Tier = 'bronze' | 'silver' | 'gold';

/** What achievements are judged on. */
export interface Stats {
  quiz: number;
  levels: number;
  levelsByGame: Record<XpGame, number>;
  bestStreak: number;
  perfectSessions: number;
  tasksDone: number;
  playerLevel: number;
  totals: Record<XpGame, number>;
}

type CountKey = 'ach.desc.quiz' | 'ach.desc.levels' | 'ach.desc.streak' | 'ach.desc.perfect' | 'ach.desc.tasks' | 'ach.desc.level';

export type Describe = { key: CountKey; n: number } | { key: 'ach.desc.master'; game: XpGame };

export interface Achievement {
  id: string;
  tier: Tier;
  desc: Describe;
  earned: (s: Stats) => boolean;
}

const counted = (id: string, tier: Tier, key: CountKey, n: number, value: (s: Stats) => number): Achievement => ({
  id,
  tier,
  desc: { key, n },
  earned: (s) => value(s) >= n,
});

export const ACHIEVEMENTS: readonly Achievement[] = [
  counted('first-answer', 'bronze', 'ach.desc.quiz', 1, (s) => s.quiz),
  counted('quiz-25', 'bronze', 'ach.desc.quiz', 25, (s) => s.quiz),
  counted('quiz-100', 'silver', 'ach.desc.quiz', 100, (s) => s.quiz),
  counted('quiz-250', 'gold', 'ach.desc.quiz', 250, (s) => s.quiz),
  counted('first-level', 'bronze', 'ach.desc.levels', 1, (s) => s.levels),
  counted('levels-25', 'silver', 'ach.desc.levels', 25, (s) => s.levels),
  counted('levels-100', 'gold', 'ach.desc.levels', 100, (s) => s.levels),
  counted('streak-3', 'bronze', 'ach.desc.streak', 3, (s) => s.bestStreak),
  counted('streak-7', 'silver', 'ach.desc.streak', 7, (s) => s.bestStreak),
  counted('streak-30', 'gold', 'ach.desc.streak', 30, (s) => s.bestStreak),
  counted('perfect-1', 'bronze', 'ach.desc.perfect', 1, (s) => s.perfectSessions),
  counted('perfect-10', 'gold', 'ach.desc.perfect', 10, (s) => s.perfectSessions),
  counted('tasks-1', 'bronze', 'ach.desc.tasks', 1, (s) => s.tasksDone),
  counted('tasks-10', 'silver', 'ach.desc.tasks', 10, (s) => s.tasksDone),
  counted('tasks-50', 'gold', 'ach.desc.tasks', 50, (s) => s.tasksDone),
  counted('level-5', 'silver', 'ach.desc.level', 5, (s) => s.playerLevel),
  counted('level-10', 'gold', 'ach.desc.level', 10, (s) => s.playerLevel),
  ...XP_GAMES.map(
    (game): Achievement => ({
      id: `master-${game}`,
      tier: 'gold',
      desc: { key: 'ach.desc.master', game },
      earned: (s) => s.totals[game] > 0 && s.levelsByGame[game] >= s.totals[game],
    }),
  ),
];

export const TIER_RANK: Record<Tier, number> = { bronze: 0, silver: 1, gold: 2 };

export function statsOf(state: PointsState, ctx: GameContext): Stats {
  const count = (prefix: string) => state.awarded.filter((id) => id.startsWith(prefix)).length;
  const levelsByGame = Object.fromEntries(XP_GAMES.map((g) => [g, count(`l:${g}:`)])) as Record<XpGame, number>;
  return {
    quiz: count('q:'),
    levels: count('l:'),
    levelsByGame,
    bestStreak: state.bestStreak,
    perfectSessions: state.perfectSessions,
    tasksDone: state.tasksDone,
    playerLevel: levelInfo(state.total).level,
    totals: ctx.totals,
  };
}

/** Ids of the achievements earned now that are not unlocked yet. */
export function newlyEarned(state: PointsState, ctx: GameContext): string[] {
  const stats = statsOf(state, ctx);
  return ACHIEVEMENTS.filter((a) => !(a.id in state.achievements) && a.earned(stats)).map((a) => a.id);
}

/** The rarest unlocked achievement (the latest of the highest tier): the player's title. */
export function showcase(state: PointsState): Achievement | undefined {
  let best: { a: Achievement; at: string } | undefined;
  for (const a of ACHIEVEMENTS) {
    const at = state.achievements[a.id];
    if (at === undefined) continue;
    if (!best || TIER_RANK[a.tier] > TIER_RANK[best.a.tier] || (a.tier === best.a.tier && at >= best.at)) best = { a, at };
  }
  return best?.a;
}
