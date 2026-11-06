/** Number of named player levels; higher levels keep the last name. */
export const TITLE_COUNT = 10;

/** XP needed to reach level n (level 1 needs none). */
export function xpForLevel(n: number): number {
  return n <= 1 ? 0 : Math.round(100 * (n - 1) ** 1.5);
}

export type TitleNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface LevelInfo {
  level: number;
  /** 1..TITLE_COUNT: which title the level carries. */
  title: TitleNumber;
  /** XP into the current level, and the XP the level spans. */
  into: number;
  span: number;
}

export function levelInfo(total: number): LevelInfo {
  let level = 1;
  while (xpForLevel(level + 1) <= total) level++;
  const from = xpForLevel(level);
  return { level, title: Math.min(level, TITLE_COUNT) as TitleNumber, into: total - from, span: xpForLevel(level + 1) - from };
}
