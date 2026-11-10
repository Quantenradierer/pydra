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
  /** `sayPrefix` only counts when the robot's HP really falls below this (a sturdier chassis may never get there). */
  sayIfHpBelow?: number;
  /** The script may have at most this many lines of code (blank lines and comments do not count). */
  maxLines?: number;
  /** Exactly one bubble must read exactly this (a say() after a loop, not inside it). */
  sayOnce?: string;
  /** The player may lose at most this many HP over one layout. */
  maxDamage?: number;
  /** No shot of the player may hit a raised shield (blocked shots are wasted). */
  noWaste?: boolean;
  /** Every shot of the player must hit: a shot into empty air or into a raised shield counts as a miss. */
  noMiss?: boolean;
  /** The script must contain each of these words (`while`, `break`, ...; comments and strings are ignored). */
  uses?: string[];
  /** The script must not contain any of these words (`for`, ...). */
  without?: string[];
  /** No number may be written twice in the code: give repeated numbers a name. */
  noRepeatedNumber?: boolean;
}

/**
 * One battle-type step: an enemy on one map (one challenge = one fight). The data files are plain
 * objects so a new enemy needs no code, see docs/robot-battler.md.
 */
export interface EnemyData {
  id: string;
  /** 0-4. */
  chapter: number;
  title: Text;
  /** The pre-battle card: the catch in one sentence. */
  catchLine: Text;
  enemies: EnemyDef[];
  /** The ASCII map of the fight. */
  map: string[];
  maxTicks?: number;
  needs?: Needs;
  /** A script that beats this enemy with the default build: no battle needs special gear. */
  solution: string;
  /** Pieces the catch should break: false when the previous solution may also win (practice enemies). */
  breaks?: boolean;
  /** Lines of a clean solution: fewer or equal lines earns the "few lines" star. */
  par: number;
}

/** The seed of the one fight of every challenge. */
export const SEED = 11;
