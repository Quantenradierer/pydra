/**
 * Hydra Lift's progress on top of storage, and the judge. Per challenge the
 * last text and the last passing text are kept; a challenge opens when the one
 * before it is solved and starts with that one's passing text (or its own
 * starter), until the learner types there. Every change is saved at once.
 */
import type { AppStorage } from '../storage.ts';
import { CHALLENGE_IDS, CHALLENGES, spawnsOf, type Challenge, type ChallengeId } from './challenges.ts';
import { precheck, runBuilding, type RunResult } from './run.ts';
import { Building } from './sim.ts';

// ------------------------------------------------------------------ judging

export interface JudgeResult extends RunResult {
  challenge: ChallengeId;
  /** Found before anything ran (the run has only the first frame). */
  precheck: boolean;
}

/** The building of a challenge before anything ran. */
export function startState(c: Challenge) {
  return new Building({ floors: c.floors, cars: c.cars, ...(c.capacity ? { capacity: c.capacity } : {}), spawns: [] }).snapshot();
}

/** Runs a submission in the challenge's building and judges it (pure; progress is not touched). */
export function judge(c: Challenge, text: string): JudgeResult {
  const pre = precheck(text, c.cars);
  if (pre) return { challenge: c.id, precheck: true, frames: [startState(c)], calls: [], passengers: [], stats: startState(c).stats, passed: false, problem: pre, problemTick: 0, misses: [], broken: {} };
  const r = runBuilding(text, { floors: c.floors, cars: c.cars, ...(c.capacity ? { capacity: c.capacity } : {}), ...(c.closed ? { closed: c.closed } : {}), spawns: spawnsOf(c), goal: c.goal, handlers: c.handlers, trace: true });
  return { challenge: c.id, precheck: false, ...r };
}

// ------------------------------------------------------------------ progress

export interface ChallengeProgress {
  /** The learner's last text here (only once they typed or ran something). */
  last?: string;
  /** The last text that passed. */
  passing?: string;
  /** The stats of the best passing run: fewest seconds. */
  best?: { elapsed: number; moves: number; maxWait: number };
}

export interface ElevatorProgress {
  challenges: Partial<Record<ChallengeId, ChallengeProgress>>;
  /** Challenges solved at least once, in the order they were solved. */
  solved: ChallengeId[];
  /** Failed runs by challenge, until it is solved. */
  misses: Partial<Record<ChallengeId, number>>;
  /** Runs of unsolved challenges and the ones of them that passed: the "% right" on Home. */
  runs: number;
  wins: number;
  current?: ChallengeId;
}

export const emptyProgress = (): ElevatorProgress => ({ challenges: {}, solved: [], misses: {}, runs: 0, wins: 0 });

const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** Reads stored progress; entries of challenges not in `ids` (removed ones, nonsense) are dropped. */
export function parseProgress(raw: unknown, ids: readonly string[] = CHALLENGE_IDS): ElevatorProgress {
  const isChallengeId = (v: unknown): v is ChallengeId => typeof v === 'string' && ids.includes(v);
  const out = emptyProgress();
  if (typeof raw !== 'object' || raw === null) return out;
  const r = raw as Record<string, unknown>;
  if (typeof r.challenges === 'object' && r.challenges !== null) {
    for (const [id, v] of Object.entries(r.challenges as Record<string, unknown>)) {
      if (!isChallengeId(id) || typeof v !== 'object' || v === null) continue;
      const { last, passing, best } = v as Record<string, unknown>;
      const entry: ChallengeProgress = {};
      if (typeof last === 'string') entry.last = last;
      if (typeof passing === 'string') entry.passing = passing;
      if (typeof best === 'object' && best !== null) {
        const b = best as Record<string, unknown>;
        if (isNum(b.elapsed) && isCount(b.moves) && isNum(b.maxWait)) entry.best = { elapsed: b.elapsed, moves: b.moves, maxWait: b.maxWait };
      }
      out.challenges[id] = entry;
    }
  }
  // Solved means a passing text exists: the next challenge starts with it.
  if (Array.isArray(r.solved)) out.solved = [...new Set(r.solved.filter((id): id is ChallengeId => isChallengeId(id) && out.challenges[id]?.passing !== undefined))];
  if (typeof r.misses === 'object' && r.misses !== null) {
    for (const [id, n] of Object.entries(r.misses as Record<string, unknown>)) if (isChallengeId(id) && isCount(n)) out.misses[id] = n;
  }
  if (isCount(r.runs)) out.runs = r.runs;
  if (isCount(r.wins) && r.wins <= out.runs) out.wins = r.wins;
  if (isChallengeId(r.current)) out.current = r.current;
  return out;
}

export type ChallengeStatus = 'locked' | 'open' | 'solved';

/** The points event of a first pass; the same shape as the other games' `{ type: 'level' }` events. */
export interface ElevatorPointsEvent {
  type: 'level';
  game: 'elevator';
  id: ChallengeId;
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

export class ElevatorGame {
  constructor(
    private storage: AppStorage,
    private onPoints: (event: ElevatorPointsEvent) => void = () => {},
    readonly challenges: readonly Challenge[] = CHALLENGES,
  ) {}

  progress(): ElevatorProgress {
    return parseProgress(
      this.storage.gameData('elevator'),
      this.challenges.map((c) => c.id),
    );
  }

  private save(p: ElevatorProgress) {
    this.storage.setGameData(p, 'elevator');
  }

  challenge(id: string): Challenge | undefined {
    return this.challenges.find((c) => c.id === id);
  }

  /** The challenge before `id` in this game's list: it opens `id`, and its passing code is where `id` starts. */
  private previous(id: ChallengeId): Challenge | undefined {
    const i = this.challenges.findIndex((c) => c.id === id);
    return i > 0 ? this.challenges[i - 1] : undefined;
  }

  status(id: ChallengeId): ChallengeStatus {
    const p = this.progress();
    if (!this.challenge(id)) return 'locked';
    if (p.solved.includes(id)) return 'solved';
    const before = this.previous(id);
    return !before || p.solved.includes(before.id) ? 'open' : 'locked';
  }

  unlocked(id: ChallengeId): boolean {
    return this.status(id) !== 'locked';
  }

  /** The stats of the best passing run of a challenge. */
  best(id: ChallengeId): ChallengeProgress['best'] {
    return this.progress().challenges[id]?.best;
  }

  /** What the editor opens with: the learner's own text here, else the starter, else the passing text of the challenge before, else ''. */
  startText(id: ChallengeId): string {
    const p = this.progress();
    const own = p.challenges[id]?.last;
    if (own !== undefined) return own;
    const c = this.challenge(id);
    if (c?.starter !== undefined) return c.starter;
    const before = this.previous(id);
    return (before && p.challenges[before.id]?.passing) ?? '';
  }

  /** Keeps the learner's text (call it when they edit). Saving the unchanged start text does nothing. */
  setText(id: ChallengeId, text: string) {
    const p = this.progress();
    const entry = p.challenges[id] ?? {};
    if (entry.last === undefined && text === this.startText(id)) return;
    if (entry.last === text) return;
    this.save({ ...p, challenges: { ...p.challenges, [id]: { ...entry, last: text } } });
  }

  /** Remembers the challenge the learner has open. */
  setCurrent(id: ChallengeId) {
    const p = this.progress();
    if (p.current !== id) this.save({ ...p, current: id });
  }

  /**
   * Judges a submission and records it (last text, passing text, best run, solved, points). Undefined for a locked or
   * unknown challenge. With `deferPoints` the points of a first pass wait in `award` until the screen shows the verdict.
   */
  submit(id: ChallengeId, text: string, deferPoints = false): SubmitReport | undefined {
    const c = this.challenge(id);
    if (!c || !this.unlocked(id)) return undefined;
    const result = judge(c, text);
    let p = this.progress();
    const already = p.solved.includes(id);
    const passed = result.passed;
    const firstPass = passed && !already;
    const clean = (p.misses[id] ?? 0) === 0;
    const old = p.challenges[id]?.best;
    const run = { elapsed: result.stats.elapsed, moves: result.stats.moves, maxWait: result.stats.maxWait };
    const best = passed && (!old || run.elapsed < old.elapsed) ? run : old;
    const entry: ChallengeProgress = { ...p.challenges[id], last: text, ...(passed ? { passing: text } : {}), ...(best ? { best } : {}) };
    p = {
      ...p,
      challenges: { ...p.challenges, [id]: entry },
      solved: firstPass ? [...p.solved, id] : p.solved,
      runs: p.runs + (already ? 0 : 1),
      wins: p.wins + (firstPass ? 1 : 0),
      misses: passed || already ? p.misses : { ...p.misses, [id]: (p.misses[id] ?? 0) + 1 },
    };
    this.save(p);
    const award = firstPass ? () => this.onPoints({ type: 'level', game: 'elevator', id, clean }) : undefined;
    if (award && !deferPoints) award();
    return { result, passed, firstPass, ...(award && deferPoints ? { award } : {}) };
  }

  stats(): { done: number; total: number; runs: number; percent: number } {
    const p = this.progress();
    return { done: p.solved.length, total: this.challenges.length, runs: p.runs, percent: p.runs === 0 ? 0 : Math.round((100 * p.wins) / p.runs) };
  }
}
