import type { Content, LessonId, WalkthroughLesson } from './content/lessons.ts';
import type { Question } from './content/types.ts';
import {
  advance,
  answer,
  buildSession,
  currentItem,
  isCorrect,
  orderedSession,
  pickLeastPlayed,
  score,
  type Rng,
  type Session,
} from './session.ts';
import { recordAnswer, recordQuestion, recordSession } from './stats.ts';
import type { PointsEvent } from './points/state.ts';
import type { AppStorage, LastResult } from './storage.ts';

/** Quiz flow on top of storage: every change is saved straight away. */
export class Trainer {
  constructor(
    private storage: AppStorage,
    private content: Content,
    private rng: Rng = Math.random,
    private now: () => Date = () => new Date(),
    private onPoints: (event: PointsEvent) => void = () => {},
  ) {}

  /** The session to resume, if a valid one is saved. */
  session(): Session | undefined {
    return this.storage.session();
  }

  isRunning(): boolean {
    return this.session() !== undefined;
  }

  question(id: string): Question {
    return this.content.byId.get(id)!;
  }

  /** How often a walkthrough was played to its last question. */
  private timesPlayed(walkthrough: WalkthroughLesson): number {
    return this.storage.questionStats()[walkthrough.questions.at(-1)!.id]?.seen ?? 0;
  }

  /** Walkthroughs played to the end at least once, and how many there are. */
  walkthroughProgress(): { done: number; total: number } {
    const { walkthroughs } = this.content;
    return { done: walkthroughs.filter((w) => this.timesPlayed(w) > 0).length, total: walkthroughs.length };
  }

  /** Starts a lesson. The functions lesson walks through the function played least often. */
  start(lesson: LessonId = 'mixed'): Session {
    const session =
      lesson === 'mixed' || lesson === 'diff'
        ? buildSession(lesson === 'mixed' ? this.content.questions : this.content.diff, this.rng, lesson)
        : orderedSession(
            lesson,
            pickLeastPlayed(this.content.walkthroughs, (w) => this.timesPlayed(w), this.rng).questions,
            this.rng,
          );
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
    this.storage.setCounters(recordAnswer(this.storage.counters(next.lesson), correct), next.lesson);
    this.storage.setQuestionStats(recordQuestion(this.storage.questionStats(), item.id, correct, this.now()));
    this.storage.setSession(next);
    this.onPoints({ type: 'quiz', id: item.id, correct });
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
    const result = { lesson: session.lesson, score: score(session, this.content.byId), total: session.items.length };
    this.storage.setCounters(recordSession(this.storage.counters(session.lesson), result.score), session.lesson);
    this.storage.setLastResult(result);
    this.storage.clearSession();
    this.onPoints({ type: 'session', perfect: result.score === result.total });
    return result;
  }

  /** Discards the session; stats of answered questions are kept. */
  quit() {
    this.storage.clearSession();
  }
}
