import type { Question } from './content/types.ts';
import { DEFAULT_LANG, isLang, type Lang } from './i18n.ts';
import { parseSession, type Session } from './session.ts';
import { parseCounters, parseQuestionStats, type Counters, type QuestionStats } from './stats.ts';

/** The subset of the Web Storage API used here; localStorage in the app. */
export type KeyValue = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** All keys live in one versioned namespace. */
export const NAMESPACE = 'pydra.v1.';

/** Score of the last finished session, shown on the summary screen. */
export interface LastResult {
  score: number;
  total: number;
}

export class MemoryKeyValue implements KeyValue {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

/**
 * Typed, defensive access to the app's localStorage data. Corrupt or foreign
 * values read as "nothing saved"; failing writes (quota, private mode) are
 * ignored, so storage never breaks the app.
 */
export class AppStorage {
  constructor(
    private kv: KeyValue,
    private questions: ReadonlyMap<string, Question>,
  ) {}

  private read(key: string): unknown {
    try {
      const raw = this.kv.getItem(NAMESPACE + key);
      return raw === null ? undefined : JSON.parse(raw);
    } catch {
      return undefined;
    }
  }

  private write(key: string, value: unknown) {
    try {
      this.kv.setItem(NAMESPACE + key, JSON.stringify(value));
    } catch {
      // Storage full or unavailable: keep running without persistence.
    }
  }

  private remove(key: string) {
    try {
      this.kv.removeItem(NAMESPACE + key);
    } catch {
      // See write().
    }
  }

  language(): Lang {
    const lang = this.read('language');
    return isLang(lang) ? lang : DEFAULT_LANG;
  }

  setLanguage(lang: Lang) {
    this.write('language', lang);
  }

  /** The saved session, or undefined if there is none or it is no longer valid. */
  session(): Session | undefined {
    const session = parseSession(this.read('session'), this.questions);
    if (!session) this.remove('session');
    return session;
  }

  setSession(session: Session) {
    this.write('session', session);
  }

  clearSession() {
    this.remove('session');
  }

  counters(): Counters {
    return parseCounters(this.read('counters'));
  }

  setCounters(counters: Counters) {
    this.write('counters', counters);
  }

  questionStats(): QuestionStats {
    return parseQuestionStats(this.read('questionStats'));
  }

  setQuestionStats(stats: QuestionStats) {
    this.write('questionStats', stats);
  }

  lastResult(): LastResult | undefined {
    const raw = this.read('lastResult');
    if (typeof raw !== 'object' || raw === null) return undefined;
    const { score, total } = raw as Record<string, unknown>;
    if (!Number.isInteger(total) || !Number.isInteger(score)) return undefined;
    if ((score as number) < 0 || (score as number) > (total as number)) return undefined;
    return { score: score as number, total: total as number };
  }

  setLastResult(result: LastResult) {
    this.write('lastResult', result);
  }

  clearLastResult() {
    this.remove('lastResult');
  }

  feedbackQueue(): string[] {
    const raw = this.read('feedbackQueue');
    return Array.isArray(raw) ? raw.filter((t): t is string => typeof t === 'string') : [];
  }

  setFeedbackQueue(queue: string[]) {
    if (queue.length === 0) this.remove('feedbackQueue');
    else this.write('feedbackQueue', queue);
  }

  /** Wipes stats, counters and any session; keeps the language and unsent feedback. */
  resetProgress() {
    for (const key of ['session', 'counters', 'questionStats', 'lastResult']) this.remove(key);
  }
}
