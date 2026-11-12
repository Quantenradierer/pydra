/**
 * Hydra Works' progress on top of storage, and the judge. Per lesson the last
 * text and the last passing text are kept; a lesson opens when the lessons it
 * needs are solved and starts with the passing text of the lesson below it in
 * its branch, until the learner types there. Every change is saved at once.
 */
import type { AppStorage } from '../storage.ts';
import { parse } from '../robot/py/parser.ts';
import { definedAndCalled, isLessonId, LESSONS, machinesClash, machinesText, type Belt, type Lesson, type LessonId } from './lessons.ts';
import { precheck, problemLine, runBelt, type BeltRun, type Problem, type Source } from './run.ts';
import { World } from './world.ts';

// ------------------------------------------------------------------ judging

export interface BeltResult extends BeltRun {
  belt: Belt;
}

/**
 * - precheck: found before anything ran (syntax, unknown name, `ore = …`, a given command in a block lesson,
 *   two different functions with one name in "Your machines");
 * - error: a belt stopped with an error; order: a belt ended without meeting the order;
 * - check: a structural check of the lesson failed: the function it asks for is missing, has the wrong
 *   parameters or is never called (also reported instead of `order`, it is the reason), or every belt met
 *   the order but a strict check failed.
 */
export type FailureKind = 'precheck' | 'error' | 'order' | 'check';

export interface JudgeResult {
  lesson: LessonId;
  passed: boolean;
  failure?: FailureKind;
  /** The reason for `precheck`, `error` and `check` (`problemText()` makes the sentence). */
  problem?: Problem;
  /**
   * One result per belt of the lesson, in order. On a precheck failure only the first belt, with two
   * frames: the block at the start and the error (nothing ran).
   */
  belts: BeltResult[];
  /** The belt to play step by step: the first one, or the first that fails. */
  play: number;
  /** The played belt is not the first one: show "It fails on this belt". */
  otherBelt: boolean;
  /** The "Your machines" text the program ran with (block lessons; '' otherwise). */
  machines: string;
}

/** The block of `belt` before anything ran. */
export function startState(lesson: Lesson, belt: Belt = lesson.belts[0]!) {
  return new World({ belt: belt.items, ore: lesson.start.ore, coal: lesson.start.coal }).snapshot();
}

/** Runs a submission on every belt of the lesson and judges it (pure; progress is not touched). */
export function judge(lesson: Lesson, text: string, machines = ''): JudgeResult {
  const source: Source = machines ? { own: text, machines } : { own: text };
  const base = { lesson: lesson.id, machines };
  const pre =
    (machines ? machinesClash(machines) : undefined) ??
    precheck(source, { names: lesson.names, ...(lesson.forbiddenInOwn ? { forbiddenInOwn: lesson.forbiddenInOwn } : {}), ...(lesson.reserved ? { reserved: lesson.reserved } : {}) });
  if (pre) {
    const belt = lesson.belts[0]!;
    const state = startState(lesson, belt);
    const frames: BeltRun['frames'] = [
      { state, line: null, event: { kind: 'begin' }, orderMet: false, start: 0, trace: [] },
      { state, line: problemLine(pre) ?? null, event: { kind: 'error', problem: pre }, orderMet: false, start: 0, trace: [] },
    ];
    return { ...base, passed: false, failure: 'precheck', problem: pre, belts: [{ belt, frames, final: state, met: false, problem: pre, starts: 0 }], play: 0, otherBelt: false };
  }
  const belts: BeltResult[] = lesson.belts.map((belt) => ({
    belt,
    ...runBelt(source, { mode: lesson.mode, belt: belt.items, ore: lesson.start.ore, coal: lesson.start.coal, ...(belt.n !== undefined ? { n: belt.n } : {}), names: lesson.names, order: lesson.order, trace: true }),
  }));
  // The precheck parsed it already: this cannot throw.
  const ast = parse(text);
  const named = lesson.provides ? definedAndCalled(ast, lesson.provides) : undefined;
  const failing = belts.findIndex((b) => !b.met);
  if (failing >= 0) {
    const b = belts[failing]!;
    const at = { belts, play: failing, otherBelt: failing > 0 };
    if (b.problem) return { ...base, passed: false, failure: 'error', problem: b.problem, ...at };
    // A forgotten or indented call leaves the order unmet: say that, not just "the order is not met".
    if (named) return { ...base, passed: false, failure: 'check', problem: named, ...at };
    return { ...base, passed: false, failure: 'order', ...at };
  }
  const problem = named ?? lesson.check?.({ ast, source: text, machines, belts });
  if (problem) return { ...base, passed: false, failure: 'check', problem, belts, play: 0, otherBelt: false };
  return { ...base, passed: true, belts, play: 0, otherBelt: false };
}

// ------------------------------------------------------------------ progress

export interface LessonProgress {
  /** The learner's last text in this lesson (only once they typed or ran something here). */
  last?: string;
  /** The last text that passed. */
  passing?: string;
}

export interface FactoryProgress {
  lessons: Partial<Record<LessonId, LessonProgress>>;
  /** Lessons solved at least once, in the order they were solved. */
  solved: LessonId[];
  /** Failed runs by lesson, until it is solved. */
  misses: Partial<Record<LessonId, number>>;
  /** Runs of unsolved lessons and the ones of them that passed: the "% right" on Home. */
  runs: number;
  wins: number;
  current?: LessonId;
}

export const emptyProgress = (): FactoryProgress => ({ lessons: {}, solved: [], misses: {}, runs: 0, wins: 0 });

const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

export function parseProgress(raw: unknown): FactoryProgress {
  const out = emptyProgress();
  if (typeof raw !== 'object' || raw === null) return out;
  const r = raw as Record<string, unknown>;
  if (typeof r.lessons === 'object' && r.lessons !== null) {
    for (const [id, v] of Object.entries(r.lessons as Record<string, unknown>)) {
      if (!isLessonId(id) || typeof v !== 'object' || v === null) continue;
      const { last, passing } = v as Record<string, unknown>;
      const entry: LessonProgress = {};
      if (typeof last === 'string') entry.last = last;
      if (typeof passing === 'string') entry.passing = passing;
      out.lessons[id] = entry;
    }
  }
  // Solved means a passing text exists: the lessons above build on it.
  if (Array.isArray(r.solved)) out.solved = [...new Set(r.solved.filter((id): id is LessonId => isLessonId(id) && out.lessons[id]?.passing !== undefined))];
  if (typeof r.misses === 'object' && r.misses !== null) {
    for (const [id, n] of Object.entries(r.misses as Record<string, unknown>)) if (isLessonId(id) && isCount(n)) out.misses[id] = n;
  }
  if (isCount(r.runs)) out.runs = r.runs;
  if (isCount(r.wins) && r.wins <= out.runs) out.wins = r.wins;
  if (isLessonId(r.current)) out.current = r.current;
  return out;
}

export function isUnlocked(lesson: Lesson, solved: readonly LessonId[]): boolean {
  return lesson.needs.every((id) => solved.includes(id));
}

export type LessonStatus = 'locked' | 'open' | 'solved';

/** The points event of a first pass; the same shape as the other games' `{ type: 'level' }` events. */
export interface FactoryPointsEvent {
  type: 'level';
  game: 'factory';
  id: LessonId;
  clean: boolean;
}

export interface SubmitReport {
  result: JudgeResult;
  passed: boolean;
  /** Solved for the first time just now. */
  firstPass: boolean;
  /** Only with `submit(…, true)` on a first pass: gives the points; call it when the verdict shows. */
  award?: () => void;
}

export class FactoryGame {
  constructor(
    private storage: AppStorage,
    private onPoints: (event: FactoryPointsEvent) => void = () => {},
    readonly lessons: readonly Lesson[] = LESSONS,
  ) {}

  progress(): FactoryProgress {
    return parseProgress(this.storage.gameData('factory'));
  }

  private save(p: FactoryProgress) {
    this.storage.setGameData(p, 'factory');
  }

  lesson(id: string): Lesson | undefined {
    return this.lessons.find((l) => l.id === id);
  }

  status(id: LessonId): LessonStatus {
    const p = this.progress();
    const lesson = this.lesson(id);
    if (!lesson) return 'locked';
    if (p.solved.includes(id)) return 'solved';
    return isUnlocked(lesson, p.solved) ? 'open' : 'locked';
  }

  unlocked(id: LessonId): boolean {
    return this.status(id) !== 'locked';
  }

  /** The passing text of a lesson, if it was solved. */
  passing(id: LessonId): string | undefined {
    return this.progress().lessons[id]?.passing;
  }

  /** What the editor opens with: the learner's own text here, else the passing text of the lesson below in the branch, else empty. */
  startText(id: LessonId): string {
    const p = this.progress();
    const own = p.lessons[id]?.last;
    if (own !== undefined) return own;
    const from = this.lesson(id)?.carryFrom;
    return (from && p.lessons[from]?.passing) ?? '';
  }

  /** Keeps the learner's text of a lesson (call it when they edit). Saving the unchanged start text does nothing. */
  setText(id: LessonId, text: string) {
    const p = this.progress();
    const entry = p.lessons[id] ?? {};
    if (entry.last === undefined && text === this.startText(id)) return;
    if (entry.last === text) return;
    this.save({ ...p, lessons: { ...p.lessons, [id]: { ...entry, last: text } } });
  }

  /** "Your machines" for a block lesson (the current passing G4 and S4 definitions); '' for the others. */
  machines(id: LessonId): string {
    const lesson = this.lesson(id);
    if (!lesson) return '';
    const p = this.progress();
    return machinesText(lesson, (from) => p.lessons[from]?.passing);
  }

  /** Remembers the lesson the learner has open. */
  setCurrent(id: LessonId) {
    const p = this.progress();
    if (p.current !== id) this.save({ ...p, current: id });
  }

  /**
   * Judges a submission and records it (last text, passing text, solved, points). Undefined for a locked or
   * unknown lesson. With `deferPoints` the points of a first pass wait in `award` until the screen shows the verdict.
   */
  submit(id: LessonId, text: string, deferPoints = false): SubmitReport | undefined {
    const lesson = this.lesson(id);
    if (!lesson || !this.unlocked(id)) return undefined;
    const result = judge(lesson, text, this.machines(id));
    let p = this.progress();
    const already = p.solved.includes(id);
    const passed = result.passed;
    const firstPass = passed && !already;
    const clean = (p.misses[id] ?? 0) === 0;
    const entry: LessonProgress = { ...p.lessons[id], last: text, ...(passed ? { passing: text } : {}) };
    p = {
      ...p,
      lessons: { ...p.lessons, [id]: entry },
      solved: firstPass ? [...p.solved, id] : p.solved,
      runs: p.runs + (already ? 0 : 1),
      wins: p.wins + (firstPass ? 1 : 0),
      misses: passed || already ? p.misses : { ...p.misses, [id]: (p.misses[id] ?? 0) + 1 },
    };
    this.save(p);
    const award = firstPass ? () => this.onPoints({ type: 'level', game: 'factory', id, clean }) : undefined;
    if (award && !deferPoints) award();
    return { result, passed, firstPass, ...(award && deferPoints ? { award } : {}) };
  }

  stats(): { done: number; total: number; runs: number; percent: number } {
    const p = this.progress();
    return { done: p.solved.length, total: this.lessons.length, runs: p.runs, percent: p.runs === 0 ? 0 : Math.round((100 * p.wins) / p.runs) };
  }
}
