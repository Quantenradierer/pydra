import { DIFF_QUESTIONS } from './diff.ts';
import { QUESTIONS } from './questions.ts';
import type { Question, Walkthrough } from './types.ts';
import { WALKTHROUGHS, walkthroughQuestions } from './walkthroughs.ts';

/**
 * The lessons on Home. `mixed`: 10 random questions from the question bank.
 * `functions`: one function read line by line (a walkthrough).
 * `diff`: 10 random "spot the difference" questions (two near-identical snippets).
 */
export const LESSONS = ['mixed', 'functions', 'diff'] as const;
export type LessonId = (typeof LESSONS)[number];

export function isLesson(value: unknown): value is LessonId {
  return (LESSONS as readonly unknown[]).includes(value);
}

/** A walkthrough as a fixed sequence of questions. */
export interface WalkthroughLesson {
  id: string;
  questions: readonly Question[];
}

/** Everything the lessons play, plus a lookup over all of it. */
export interface Content {
  /** The pool of the mixed lesson. */
  questions: readonly Question[];
  /** The pool of the diff lesson. */
  diff: readonly Question[];
  walkthroughs: readonly WalkthroughLesson[];
  /** Every question of every lesson by id. */
  byId: ReadonlyMap<string, Question>;
}

export function makeContent(
  questions: readonly Question[],
  walkthroughs: readonly Walkthrough[],
  diff: readonly Question[] = [],
): Content {
  const lessons = walkthroughs.map((w) => ({ id: w.id, questions: walkthroughQuestions(w) }));
  const all = [...questions, ...diff, ...lessons.flatMap((w) => w.questions)];
  return { questions, diff, walkthroughs: lessons, byId: new Map(all.map((q) => [q.id, q])) };
}

export const CONTENT = makeContent(QUESTIONS, WALKTHROUGHS, DIFF_QUESTIONS);

/** Whether a saved session's question ids can belong to the lesson. */
export function fitsLesson(content: Content, lesson: LessonId, ids: readonly string[]): boolean {
  if (lesson === 'mixed' || lesson === 'diff') {
    const pool = new Set((lesson === 'mixed' ? content.questions : content.diff).map((q) => q.id));
    return ids.every((id) => pool.has(id));
  }
  return content.walkthroughs.some((w) => w.questions.length === ids.length && w.questions.every((q, i) => q.id === ids[i]));
}
