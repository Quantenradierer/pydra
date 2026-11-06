import type { MessageKey } from '../i18n.ts';

/** Number of named player levels; higher levels keep the last name. */
export const TITLE_COUNT = 50;

/**
 * XP needed to reach level n (level 1 needs none). Tuned so that 10 right
 * answers a day with the streak bonus held (170 XP a day from day 7) reach
 * level 10 after 30 days and level 50, the last title, after one year.
 */
export function xpForLevel(n: number): number {
  return n <= 1 ? 0 : Math.round(180 * (n - 1) ** 1.5);
}

/** The text key of a level's title. */
export const titleKey = (title: number) => `level.title.${title}` as MessageKey;

export interface LevelInfo {
  level: number;
  /** 1..TITLE_COUNT: which title the level carries. */
  title: number;
  /** XP into the current level, and the XP the level spans. */
  into: number;
  span: number;
}

export function levelInfo(total: number): LevelInfo {
  let level = 1;
  while (xpForLevel(level + 1) <= total) level++;
  const from = xpForLevel(level);
  return { level, title: Math.min(level, TITLE_COUNT) , into: total - from, span: xpForLevel(level + 1) - from };
}
