import type { Build } from '../build.ts';
import type { EnemyDef } from '../layout.ts';

/** A text in both languages. */
export interface Text {
  de: string;
  en: string;
}

/** Extra conditions besides "every enemy is down" that make a fight count as won. */
export interface Needs {
  /** The robot must say() something. */
  say?: boolean;
  /** One of the bubbles must start with this text. */
  sayPrefix?: string;
  /** The script may have at most this many lines of code (blank lines and comments do not count). */
  maxLines?: number;
  /** Exactly one bubble must read exactly this (a say() after a loop, not inside it). */
  sayOnce?: string;
}

/**
 * One battle-type step: an enemy with three layouts. The data files are plain
 * objects so a new enemy needs no code, see docs/robot-battler.md.
 */
export interface EnemyData {
  id: string;
  /** 0-4 for the chapters; 25 = Proving Grounds I ("chapter 2.5"). */
  chapter: number;
  title: Text;
  /** The pre-battle card: the twist in one sentence. */
  twist: Text;
  /** Hint 2: the concept that helps. Hint 1 is the twist again, hint 3 is `skeleton`. */
  idea: Text;
  /** Hint 3: a partial code skeleton (language-neutral). */
  skeleton: string;
  enemies: EnemyDef[];
  /** One ASCII map per layout (1-3); layout i uses seed SEEDS[i]. */
  maps: string[][];
  maxTicks?: number;
  needs?: Needs;
  /** A script that beats this enemy (and every earlier enemy of the chapter) with `solutionBuild`. */
  solution: string;
  solutionBuild?: Partial<Build>;
  /** Pieces the twist should break: false when the previous solution may also win (practice enemies). */
  breaks?: boolean;
  /** Lines of a clean solution: fewer or equal lines earns the "few lines" star. */
  par: number;
  /** Fights of Proving Grounds: take the first map of each of these other enemies instead. */
  mix?: string[];
  /** false: a side mission with its own set-up; it is not part of the chapter's regression run. */
  regression?: boolean;
}

export const SEEDS = [11, 22, 33] as const;
