import { fitsLesson, isLesson, type Content, type LessonId } from './content/lessons.ts';
import type { Localized, Question } from './content/types.ts';

export const SESSION_LENGTH = 10;
export const CHOICE_COUNT = 4;

/** Returns a number in [0, 1), like Math.random. Injected for tests. */
export type Rng = () => number;

export interface SessionItem {
  id: string;
  /** order[slot] = index into question.choices shown at that slot. */
  order: number[];
  /** Slot the player picked, or null while unanswered. */
  picked: number | null;
}

/** A quiz in progress. Saved after every answer and resumed on launch. */
export interface Session {
  lesson: LessonId;
  items: SessionItem[];
  /** Current question. Its feedback is showing when it has been answered. */
  index: number;
}

/** A question as shown: choices in session order, answer index remapped. */
export interface PresentedQuestion {
  question: Question;
  choices: Localized[];
  answerIndex: number;
}

/** Fisher-Yates shuffle into a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/** The mixed lesson: SESSION_LENGTH distinct questions picked uniformly at random, choices shuffled. */
export function buildSession(questions: readonly Question[], rng: Rng = Math.random): Session {
  return orderedSession('mixed', shuffle(questions, rng).slice(0, SESSION_LENGTH), rng);
}

/** A session over the given questions in the given order; only the choices are shuffled. */
export function orderedSession(lesson: LessonId, questions: readonly Question[], rng: Rng = Math.random): Session {
  return {
    lesson,
    items: questions.map((q) => ({
      id: q.id,
      order: shuffle(
        q.choices.map((_, i) => i),
        rng,
      ),
      picked: null,
    })),
    index: 0,
  };
}

/** One of the options played least often so far, chosen at random among ties. */
export function pickLeastPlayed<T>(options: readonly T[], played: (option: T) => number, rng: Rng = Math.random): T {
  const counts = options.map(played);
  const fewest = Math.min(...counts);
  const candidates = options.filter((_, i) => counts[i] === fewest);
  return candidates[Math.floor(rng() * candidates.length)]!;
}

export function present(question: Question, order: readonly number[]): PresentedQuestion {
  return {
    question,
    choices: order.map((i) => question.choices[i]!),
    answerIndex: order.indexOf(question.answerIndex),
  };
}

export function currentItem(session: Session): SessionItem {
  return session.items[session.index]!;
}

export function isCorrect(item: SessionItem, question: Question): boolean {
  return item.picked !== null && item.order[item.picked] === question.answerIndex;
}

/** Records the pick for the current question; ignored once it is answered. */
export function answer(session: Session, slot: number): Session {
  const item = currentItem(session);
  if (item.picked !== null || slot < 0 || slot >= item.order.length) return session;
  const items = session.items.map((it, i) => (i === session.index ? { ...it, picked: slot } : it));
  return { ...session, items };
}

export function isLastQuestion(session: Session): boolean {
  return session.index === session.items.length - 1;
}

/** Moves to the next question, or returns undefined when the session is over. */
export function advance(session: Session): Session | undefined {
  if (currentItem(session).picked === null || isLastQuestion(session)) return undefined;
  return { ...session, index: session.index + 1 };
}

export function score(session: Session, byId: ReadonlyMap<string, Question>): number {
  return session.items.filter((item) => isCorrect(item, byId.get(item.id)!)).length;
}

const isInt = (v: unknown): v is number => Number.isInteger(v);

/**
 * Validates a saved session against the current content. Anything malformed,
 * a question id that no longer exists, or questions that do not fit the
 * lesson yield undefined. Sessions saved before lessons existed are `mixed`.
 */
export function parseSession(raw: unknown, content: Content): Session | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const { items, index, lesson = 'mixed' } = raw as Partial<Session>;
  if (!isLesson(lesson)) return undefined;
  if (!Array.isArray(items) || items.length === 0 || !isInt(index) || index < 0 || index >= items.length) {
    return undefined;
  }
  const ids = new Set<string>();
  const parsed: SessionItem[] = [];
  for (const [i, item] of items.entries()) {
    if (typeof item !== 'object' || item === null) return undefined;
    const { id, order, picked } = item as Partial<SessionItem>;
    if (typeof id !== 'string' || ids.has(id)) return undefined;
    const question = content.byId.get(id);
    if (!question) return undefined;
    const n = question.choices.length;
    if (
      !Array.isArray(order) ||
      order.length !== n ||
      !order.every((o) => isInt(o) && o >= 0 && o < n) ||
      new Set(order).size !== n
    ) {
      return undefined;
    }
    if (picked !== null && !(isInt(picked) && picked >= 0 && picked < n)) return undefined;
    // Questions before the current one are answered, later ones are not.
    if ((i < index && picked === null) || (i > index && picked !== null)) return undefined;
    ids.add(id);
    parsed.push({ id, order: [...order], picked });
  }
  if (!fitsLesson(content, lesson, [...ids])) return undefined;
  return { lesson, items: parsed, index };
}
