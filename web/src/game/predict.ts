import type { PointsEvent } from '../points/state.ts';
import type { AppStorage } from '../storage.ts';
import { PREDICT_LEVELS, type PredictLevel } from './predict-levels.ts';
import { Interpreter, parse, PyError, repr, type Builtin, type Value } from './python.ts';

// ---------------------------------------------------------------- running a program

/** One step of a run: the line that just ran and what has been printed so far. */
export interface PredictStep {
  /** The line highlighted, whose effect the step already shows; null once the program has ended. */
  line: number | null;
  /** Variables in scope as [name, Python repr]. */
  vars: [string, string][];
  /** How many lines the program has printed up to and including this step. */
  printed: number;
}

export interface PredictTrace {
  steps: PredictStep[];
  /** Every line the program printed. */
  output: string[];
  /** A Python error that stopped the program (no level has one; a safety net). */
  error?: { line: number; message: string };
}

/** Longest run recorded; a program that runs longer is cut off (no level comes near). */
export const MAX_PREDICT_STEPS = 300;

/** How print() shows a value: text as it is, everything else like Python's repr. */
export const printed = (v: Value): string => (typeof v === 'string' ? v : repr(v));

/** Runs a program with a print() that writes to the output, and records every step. Deterministic. */
export function tracePrint(source: string, maxSteps = MAX_PREDICT_STEPS): PredictTrace {
  const output: string[] = [];
  const print: Builtin = {
    kind: 'builtin',
    name: 'print',
    arity: -1,
    call: (args) => {
      output.push(args.map(printed).join(' '));
      return null;
    },
  };
  const interpreter = new Interpreter([print]);
  const steps: PredictStep[] = [];
  const snapshot = (line: number | null): PredictStep => ({
    line,
    vars: interpreter.variables().map(([name, value]) => [name, repr(value)]),
    printed: output.length,
  });
  /** The line that is running: a step shows the state after it. */
  let line = 0;
  let running = false;
  const finish = () => {
    if (running) steps.push(snapshot(line));
    running = false;
  };
  try {
    for (const pause of interpreter.run(parse(source))) {
      finish();
      if (steps.length >= maxSteps) return { steps, output, error: { line: pause.line, message: 'program too long' } };
      line = pause.line;
      running = true;
    }
    finish();
  } catch (error) {
    finish();
    if (!(error instanceof PyError)) throw error;
    if (steps.length === 0) steps.push(snapshot(error.line));
    return { steps, output, error: { line: error.line, message: error.message } };
  }
  steps.push(snapshot(null));
  return { steps, output };
}

// ---------------------------------------------------------------- checking a prediction

/** A line is right when it is exactly what Python prints; spaces before and after it do not count. */
export const lineRight = (guess: string, actual: string): boolean => guess.trim() === actual;

/** A near miss worth a word: the right text in quotes, in the wrong case, or with other spaces. */
export type Mistake = 'quotes' | 'case' | 'spaces';

export function mistake(guess: string, actual: string): Mistake | undefined {
  const g = guess.trim();
  if (g === actual || g === '') return undefined;
  if (/^(['"]).*\1$/.test(g) && g.length >= 2 && g.slice(1, -1) === actual) return 'quotes';
  if (g.toLowerCase() === actual.toLowerCase()) return 'case';
  if (g.replace(/\s+/g, '') === actual.replace(/\s+/g, '')) return 'spaces';
  return undefined;
}

// ---------------------------------------------------------------- progress

/** The level being played. */
export interface PredictState {
  level: string;
  /** What the player typed, one entry per printed line. */
  guesses: string[];
  /** Whether the guesses as they are were checked and are all right. */
  solved: boolean;
  /** Wrong checks since the level was opened: after two, the output can be shown. */
  misses: number;
}

/** Everything "What does the hydra say?" saves. */
export interface PredictProgress {
  /** Ids of the levels solved at least once. */
  solved: string[];
  /** Every check of an unsolved level, and the right ones: the "% correct" on Home. */
  checks: number;
  rightChecks: number;
  current?: PredictState;
}

export const EMPTY_PREDICT_PROGRESS: PredictProgress = { solved: [], checks: 0, rightChecks: 0 };

/** Wrong checks after which the player may look at the output. */
export const REVEAL_AFTER = 2;

const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

/** Reads saved progress defensively: unknown levels and malformed parts are dropped. */
export function parsePredictProgress(raw: unknown, levels: readonly PredictLevel[]): PredictProgress {
  if (typeof raw !== 'object' || raw === null) return EMPTY_PREDICT_PROGRESS;
  const r = raw as Record<string, unknown>;
  if (!isCount(r.checks) || !isCount(r.rightChecks) || r.rightChecks > r.checks) return EMPTY_PREDICT_PROGRESS;
  const ids = new Set(levels.map((l) => l.id));
  const solved = Array.isArray(r.solved) ? [...new Set(r.solved.filter((id): id is string => ids.has(id as string)))] : [];
  const progress: PredictProgress = { solved, checks: r.checks, rightChecks: r.rightChecks };
  const c = r.current as Record<string, unknown> | undefined;
  const level = levels.find((l) => l.id === c?.level);
  if (
    level &&
    Array.isArray(c?.guesses) &&
    c.guesses.length === level.output.length &&
    c.guesses.every((g) => typeof g === 'string') &&
    typeof c.solved === 'boolean' &&
    isCount(c.misses)
  ) {
    const guesses = c.guesses as string[];
    // "Solved" must still be true of the guesses saved with it.
    const solvedNow = c.solved && guesses.every((g, i) => lineRight(g, level.output[i]!));
    progress.current = { level: level.id, guesses: [...guesses], solved: solvedNow, misses: c.misses };
  }
  return progress;
}

/** Levels that can be opened: every solved one and the first unsolved one. */
export function unlockedPredict(progress: PredictProgress, levels: readonly PredictLevel[]): boolean[] {
  const firstOpen = levels.findIndex((l) => !progress.solved.includes(l.id));
  return levels.map((l, i) => progress.solved.includes(l.id) || i === firstOpen);
}

/** "What does the hydra say?" on top of storage: every change is saved straight away. */
export class PredictGame {
  private storage: AppStorage;
  readonly levels: readonly PredictLevel[];
  private onPoints: (event: PointsEvent) => void;

  constructor(
    storage: AppStorage,
    levels: readonly PredictLevel[] = PREDICT_LEVELS,
    onPoints: (event: PointsEvent) => void = () => {},
  ) {
    this.storage = storage;
    this.levels = levels;
    this.onPoints = onPoints;
  }

  progress(): PredictProgress {
    return parsePredictProgress(this.storage.gameData('predict'), this.levels);
  }

  private save(progress: PredictProgress) {
    this.storage.setGameData(progress, 'predict');
  }

  private currentLevel(progress: PredictProgress): PredictLevel | undefined {
    return this.levels.find((l) => l.id === progress.current?.level);
  }

  /**
   * The level to play (the given one, else the one in progress, else the
   * first unsolved, else the first) and its state. A level opened anew
   * starts with empty lines, also a solved one.
   */
  open(id?: string): { level: PredictLevel; state: PredictState } {
    const progress = this.progress();
    const level =
      this.levels.find((l) => l.id === id) ??
      this.currentLevel(progress) ??
      this.levels.find((l) => !progress.solved.includes(l.id)) ??
      this.levels[0]!;
    if (progress.current?.level === level.id) return { level, state: progress.current };
    const state: PredictState = { level: level.id, guesses: level.output.map(() => ''), solved: false, misses: 0 };
    this.save({ ...progress, current: state });
    return { level, state };
  }

  /** Keeps what the player typed; changed lines are no longer checked. */
  type(guesses: string[]) {
    const progress = this.progress();
    const level = this.currentLevel(progress);
    const current = progress.current;
    if (!level || !current || guesses.length !== level.output.length) return;
    const solved = current.solved && guesses.every((g, i) => g === current.guesses[i]);
    this.save({ ...progress, current: { ...current, guesses: [...guesses], solved } });
  }

  /**
   * Checks the typed lines of the open level: which are right, and whether
   * all are. A check of a level not solved before counts for the stats; a
   * fully right one solves it.
   */
  check(): { right: boolean[]; solved: boolean } | undefined {
    const progress = this.progress();
    const level = this.currentLevel(progress);
    const current = progress.current;
    if (!level || !current) return undefined;
    const right = level.output.map((line, i) => lineRight(current.guesses[i]!, line));
    const solved = right.every(Boolean);
    const practice = progress.solved.includes(level.id);
    this.save({
      solved: solved && !practice ? [...progress.solved, level.id] : progress.solved,
      checks: progress.checks + (practice ? 0 : 1),
      rightChecks: progress.rightChecks + (solved && !practice ? 1 : 0),
      current: { ...current, solved, misses: current.misses + (solved ? 0 : 1) },
    });
    if (solved && !practice) this.onPoints({ type: 'level', game: 'predict', id: level.id, clean: current.misses === 0 });
    return { right, solved };
  }

  /** Levels solved, how many there are, the checks so far and the share of right ones in whole percent. */
  stats(): { done: number; total: number; checks: number; percent: number } {
    const { solved, checks, rightChecks } = this.progress();
    return {
      done: solved.length,
      total: this.levels.length,
      checks,
      percent: checks === 0 ? 0 : Math.round((100 * rightChecks) / checks),
    };
  }
}
