import {
  dailyQuestionId,
  dailyQuestions,
  DAILY_SNIPPETS,
  DAILY_STEPS,
  type DailyQuestion,
  type DailySnippet,
} from '../content/daily.ts';
import type { PointsEvent } from '../points/state.ts';
import { answer, currentItem, isCorrect, isLastQuestion, orderedSession, parseItems, advance, type Rng, type SessionItem } from '../session.ts';
import type { AppStorage } from '../storage.ts';
import { dailyIndex } from './select.ts';

/** Questions in one challenge. */
export const DAILY_LENGTH = DAILY_STEPS.length;

/** A challenge in progress (saved after every answer, resumed on launch). */
export interface DailyRun {
  /** Local date the challenge belongs to, YYYY-MM-DD. */
  day: string;
  snippet: string;
  /** A replay after the day's result was locked: no XP, no change to the result. */
  practice: boolean;
  items: SessionItem[];
  index: number;
}

/** How a finished challenge went: `right[i]` = step i was answered right. */
export interface DailyOutcome {
  day: string;
  snippet: string;
  right: boolean[];
}

/** Everything saved under `daily`. */
export interface DailyData {
  run?: DailyRun;
  /** The locked result of the last day played for points. */
  result?: DailyOutcome;
  /** The last practice round (not counted). */
  practice?: DailyOutcome;
}

/** Where a challenge stands, for Home. */
export type DailyState = { kind: 'new' } | { kind: 'running'; answered: number } | { kind: 'done'; score: number };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
export const scoreOf = (right: readonly boolean[]) => right.filter(Boolean).length;

/** The share text: `Pydra Daily 2026-11-07 🐉🐉🐲🐉🐲 4/5`. */
export function shareLine(outcome: Pick<DailyOutcome, 'day' | 'right'>): string {
  return `Pydra Daily ${outcome.day} ${outcome.right.map((r) => (r ? '🐉' : '🐲')).join('')} ${scoreOf(outcome.right)}/${outcome.right.length}`;
}

/** Reads saved data defensively: whatever is malformed or does not fit the pool is dropped. */
export function parseDaily(raw: unknown, snippets: readonly DailySnippet[] = DAILY_SNIPPETS): DailyData {
  if (!isRecord(raw)) return {};
  const byId = new Map(snippets.flatMap(dailyQuestions).map((q) => [q.id, q] as const));
  const known = (id: unknown) => snippets.some((s) => s.id === id);
  const outcome = (v: unknown): DailyOutcome | undefined => {
    if (!isRecord(v) || typeof v.day !== 'string' || !DAY.test(v.day) || !known(v.snippet)) return undefined;
    if (!Array.isArray(v.right) || v.right.length !== DAILY_LENGTH || !v.right.every((r) => typeof r === 'boolean')) return undefined;
    return { day: v.day, snippet: v.snippet as string, right: [...(v.right as boolean[])] };
  };
  const data: DailyData = {};
  const run = raw.run;
  if (isRecord(run) && typeof run.day === 'string' && DAY.test(run.day) && known(run.snippet) && typeof run.practice === 'boolean') {
    const parsed = parseItems(run.items, run.index, byId);
    const ids = DAILY_STEPS.map((_, i) => dailyQuestionId(run.snippet as string, i));
    if (parsed && parsed.items.length === ids.length && parsed.items.every((item, i) => item.id === ids[i])) {
      data.run = { day: run.day, snippet: run.snippet as string, practice: run.practice, ...parsed };
    }
  }
  const result = outcome(raw.result);
  if (result) data.result = result;
  const practice = outcome(raw.practice);
  if (practice) data.practice = practice;
  return data;
}

/**
 * The daily challenge on top of storage: one snippet a day, picked from the
 * date, five questions played in order. Every change is saved straight away.
 */
export class DailyChallenge {
  private byId: ReadonlyMap<string, DailyQuestion>;

  constructor(
    private storage: AppStorage,
    private snippets: readonly DailySnippet[] = DAILY_SNIPPETS,
    private now: () => Date = () => new Date(),
    private rng: Rng = Math.random,
    private onPoints: (event: PointsEvent) => void = () => {},
  ) {
    this.byId = new Map(snippets.flatMap(dailyQuestions).map((q) => [q.id, q]));
  }

  /** Today's local date, YYYY-MM-DD. */
  today(): string {
    const d = this.now();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  /** The snippet of a day: the same for everyone. */
  snippetOf(day: string): DailySnippet {
    return this.snippets[dailyIndex(day, this.snippets)]!;
  }

  question(id: string): DailyQuestion {
    return this.byId.get(id)!;
  }

  private data(): DailyData {
    return parseDaily(this.storage.dailyData(), this.snippets);
  }

  private save(data: DailyData) {
    this.storage.setDailyData(data);
  }

  /** The locked result of today, if the challenge was finished. */
  result(): DailyOutcome | undefined {
    const { result } = this.data();
    return result?.day === this.today() ? result : undefined;
  }

  /** The last practice round of today. */
  practiceResult(): DailyOutcome | undefined {
    const { practice } = this.data();
    return practice?.day === this.today() ? practice : undefined;
  }

  /** A challenge of today to resume. One of an earlier day is dropped. */
  isRunning(): boolean {
    const data = this.data();
    if (data.run && data.run.day !== this.today()) {
      delete data.run;
      this.save(data);
    }
    return data.run !== undefined;
  }

  state(): DailyState {
    const result = this.result();
    if (result) return { kind: 'done', score: scoreOf(result.right) };
    if (this.isRunning()) return { kind: 'running', answered: this.run().items.filter((item) => item.picked !== null).length };
    return { kind: 'new' };
  }

  /** The running challenge. */
  run(): DailyRun {
    return this.data().run!;
  }

  /** The challenge to play: the one in progress, or a new one (a practice round once today's result is locked). */
  begin(): DailyRun {
    if (this.isRunning()) return this.run();
    const day = this.today();
    const data = this.data();
    const snippet = this.snippetOf(day);
    const { items, index } = orderedSession('mixed', dailyQuestions(snippet), this.rng);
    const run: DailyRun = { day, snippet: snippet.id, practice: data.result?.day === day, items, index };
    this.save({ ...data, run });
    return run;
  }

  /** QuizDriver: the current state of the run. */
  session(): DailyRun {
    return this.run();
  }

  /** Picks a choice slot for the current question. */
  answer(slot: number): DailyRun {
    const run = this.run();
    const next = answer({ lesson: 'mixed', items: run.items, index: run.index }, slot);
    if (next.items === run.items) return run;
    const updated = { ...run, items: next.items };
    this.save({ ...this.data(), run: updated });
    return updated;
  }

  /** Goes to the next question; after the last one the challenge is over: undefined. */
  next(): DailyRun | undefined {
    const run = this.run();
    const session = { lesson: 'mixed' as const, items: run.items, index: run.index };
    if (currentItem(session).picked === null) return run;
    if (!isLastQuestion(session)) {
      const moved = { ...run, index: advance(session)!.index };
      this.save({ ...this.data(), run: moved });
      return moved;
    }
    const right = run.items.map((item) => isCorrect(item, this.question(item.id)));
    const outcome: DailyOutcome = { day: run.day, snippet: run.snippet, right };
    const data = this.data();
    delete data.run;
    // A run that was started before the result existed (another tab) must not pay twice.
    if (run.practice || data.result?.day === run.day) {
      this.save({ ...data, practice: outcome });
    } else {
      this.save({ ...data, result: outcome });
      this.onPoints({ type: 'daily', day: run.day, right });
    }
    return undefined;
  }

  /** Leaving the screen keeps the run: it resumes where it stopped. */
  leave() {}

}
