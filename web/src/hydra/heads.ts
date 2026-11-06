import type { Question } from '../content/types.ts';
import { isCorrect, type Run } from '../session.ts';

/**
 * What a head of the quiz hydra shows: an upcoming question, the current
 * one, or how its question was answered (right: slashed off, wrong: regrown).
 */
export type HeadState = 'idle' | 'active' | 'slashed' | 'regrown';

/** One head per question of the session, derived from the saved answers. */
export function sessionHeads(session: Run, question: (id: string) => Question): HeadState[] {
  return session.items.map((item, i) => {
    if (item.picked !== null) return isCorrect(item, question(item.id)) ? 'slashed' : 'regrown';
    return i === session.index ? 'active' : 'idle';
  });
}

/** The summary hydra: `score` of `total` heads slashed, spread evenly, the rest regrown. */
export function resultHeads(score: number, total: number): HeadState[] {
  return Array.from({ length: total }, (_, i) =>
    Math.floor(((i + 1) * score) / total) > Math.floor((i * score) / total) ? 'slashed' : 'regrown',
  );
}
