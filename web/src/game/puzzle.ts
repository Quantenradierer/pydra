import type { Localized } from '../content/types.ts';

/** One answer for the gap: code (the same in every language) and what it does. */
export interface PuzzleChoice {
  /** Replaces the gap `___` in the level's code. */
  code: string;
  /**
   * For the right answer: the explanation, shown once it is picked. For a
   * wrong answer: why the run went wrong, shown after it; it never names
   * the right answer.
   */
  note: Localized;
}

/**
 * What every level of the hydra games has: a program with one gap and four
 * answers for it. Every answer is really run by the interpreter in
 * python.ts; only the right one reaches the level's goal.
 */
export interface PuzzleLevel {
  /** Stable, saved in the progress. */
  id: string;
  /** The concept the level practises, shown as its title. */
  title: Localized;
  /** One or two sentences that introduce the concept. */
  intro: Localized;
  /** The program with exactly one gap `___`. */
  code: string;
  choices: PuzzleChoice[];
  answerIndex: 0 | 1 | 2 | 3;
}

/** The gap in a level's code. */
export const GAP = '___';

/** The level's program with the gap filled by a choice. */
export function fill(level: PuzzleLevel, choice: number): string {
  return level.code.replace(GAP, level.choices[choice]!.code);
}
