import type { Question } from './content/types.ts';
import {
  advance,
  answer,
  buildSession,
  currentItem,
  isCorrect,
  score,
  type Rng,
  type Session,
} from './session.ts';
import { recordAnswer, recordQuestion, recordSession } from './stats.ts';
import type { AppStorage, LastResult } from './storage.ts';

/** Quiz flow on top of storage: every change is saved straight away. */
export class Trainer {
  constructor(
    private storage: AppStorage,
    private questions: readonly Question[],
    private byId: ReadonlyMap<string, Question>,
    private rng: Rng = Math.random,
    private now: () => Date = () => new Date(),
  ) {}

  /** The session to resume, if a valid one is saved. */
  session(): Session | undefined {
    return this.storage.session();
  }

  isRunning(): boolean {
    return this.session() !== undefined;
  }

  question(id: string): Question {
    return this.byId.get(id)!;
  }

  start(): Session {
    const session = buildSession(this.questions, this.rng);
    this.storage.setSession(session);
    this.storage.clearLastResult();
    return session;
  }

  /** Picks a choice slot for the current question and records the stats. */
  answer(slot: number): Session | undefined {
    const session = this.session();
    if (!session) return undefined;
    const next = answer(session, slot);
    if (next === session) return session;
    const item = currentItem(next);
    const correct = isCorrect(item, this.question(item.id));
    this.storage.setCounters(recordAnswer(this.storage.counters(), correct));
    this.storage.setQuestionStats(recordQuestion(this.storage.questionStats(), item.id, correct, this.now()));
    this.storage.setSession(next);
    return next;
  }

  /** Goes to the next question; after the last one, ends the session and returns its result. */
  next(): Session | LastResult | undefined {
    const session = this.session();
    if (!session || currentItem(session).picked === null) return session;
    const next = advance(session);
    if (next) {
      this.storage.setSession(next);
      return next;
    }
    const result = { score: score(session, this.byId), total: session.items.length };
    this.storage.setCounters(recordSession(this.storage.counters(), result.score));
    this.storage.setLastResult(result);
    this.storage.clearSession();
    return result;
  }

  /** Discards the session; stats of answered questions are kept. */
  quit() {
    this.storage.clearSession();
  }
}
