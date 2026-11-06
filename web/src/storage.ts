import { isLesson, LESSONS, type Content, type LessonId } from './content/lessons.ts';
import { DEFAULT_LANG, isLang, type Lang } from './i18n.ts';
import { DEFAULT_GAME_SPEED, isGameSpeed, type GameSpeed } from './game/speed.ts';
import { parsePoints, type PointsState } from './points/state.ts';
import { parseSession, type Session } from './session.ts';
import { parseCounters, parseQuestionStats, type Counters, type QuestionStats } from './stats.ts';

/** The subset of the Web Storage API used here; localStorage in the app. */
export type KeyValue = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Where each hydra game keeps its progress. */
export const GAME_DATA_KEYS = ['game', 'hunt', 'order', 'predict'] as const;
export type GameDataKey = (typeof GAME_DATA_KEYS)[number];

/** All keys live in one versioned namespace. */
export const NAMESPACE = 'pydra.v1.';

/** Score of the last finished session, shown on the summary screen. */
export interface LastResult {
  lesson: LessonId;
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
    private content: Content,
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
    const session = parseSession(this.read('session'), this.content);
    if (!session) this.remove('session');
    return session;
  }

  setSession(session: Session) {
    this.write('session', session);
  }

  clearSession() {
    this.remove('session');
  }

  /** Lifetime counters of one lesson. */
  counters(lesson: LessonId = 'mixed'): Counters {
    return parseCounters(this.read(countersKey(lesson)));
  }

  setCounters(counters: Counters, lesson: LessonId = 'mixed') {
    this.write(countersKey(lesson), counters);
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
    const { score, total, lesson = 'mixed' } = raw as Record<string, unknown>;
    if (!Number.isInteger(total) || !Number.isInteger(score) || !isLesson(lesson)) return undefined;
    if ((score as number) < 0 || (score as number) > (total as number)) return undefined;
    return { lesson, score: score as number, total: total as number };
  }

  setLastResult(result: LastResult) {
    this.write('lastResult', result);
  }

  clearLastResult() {
    this.remove('lastResult');
  }

  /** A hydra game's saved progress, raw: game/progress.ts (or game/order.ts, game/predict.ts) parses it. */
  gameData(key: GameDataKey = 'game'): unknown {
    return this.read(key);
  }

  setGameData(progress: unknown, key: GameDataKey = 'game') {
    this.write(key, progress);
  }

  /** The daily challenge's saved data, raw: daily/challenge.ts parses it. */
  dailyData(): unknown {
    return this.read('daily');
  }

  setDailyData(data: unknown) {
    this.write('daily', data);
  }

  /** How fast the game plays a run; a setting, so Reset progress keeps it. */
  gameSpeed(): GameSpeed {
    const speed = this.read('gameSpeed');
    return isGameSpeed(speed) ? speed : DEFAULT_GAME_SPEED;
  }

  setGameSpeed(speed: GameSpeed) {
    this.write('gameSpeed', speed);
  }

  /** The saved points, or undefined if there are none yet (the first start credits earlier progress). */
  points(): PointsState | undefined {
    const raw = this.read('points');
    return raw === undefined ? undefined : parsePoints(raw);
  }

  setPoints(points: PointsState) {
    this.write('points', points);
  }

  /** The player's name: a setting, so Reset progress keeps it. Empty when unset. */
  playerName(): string {
    const name = this.read('playerName');
    return typeof name === 'string' ? name : '';
  }

  setPlayerName(name: string) {
    if (name === '') this.remove('playerName');
    else this.write('playerName', name);
  }

  feedbackQueue(): string[] {
    const raw = this.read('feedbackQueue');
    return Array.isArray(raw) ? raw.filter((t): t is string => typeof t === 'string') : [];
  }

  setFeedbackQueue(queue: string[]) {
    if (queue.length === 0) this.remove('feedbackQueue');
    else this.write('feedbackQueue', queue);
  }

  /** Wipes stats, counters, points, any session, the daily challenge and every hydra game's progress; keeps the language, the player name and unsent feedback. */
  resetProgress() {
    for (const key of ['session', ...LESSONS.map(countersKey), 'questionStats', 'lastResult', 'points', 'daily', ...GAME_DATA_KEYS]) this.remove(key);
  }
}

/** The mixed lesson keeps the key it had before lessons existed. */
function countersKey(lesson: LessonId): string {
  return lesson === 'mixed' ? 'counters' : `counters.${lesson}`;
}
