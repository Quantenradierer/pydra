import { CHAPTER_0 } from './chapter0.ts';
import { CHAPTER_1 } from './chapter1.ts';
import { CHAPTER_2 } from './chapter2.ts';
import { PROVING_1 } from './proving1.ts';
import type { EnemyData } from './types.ts';

/** Every battle in play order. Chapters are appended here; see docs/robot-battler.md. */
export const ENEMIES: readonly EnemyData[] = [...CHAPTER_0, ...CHAPTER_1, ...CHAPTER_2, ...PROVING_1];
