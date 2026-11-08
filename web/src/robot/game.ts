/**
 * Robot Battler's progress on top of storage: the one robot (build and
 * script), the version history, which steps are solved, stars and hints.
 * Every change is saved straight away. A step is an enemy (a battle) or one of
 * the challenges that sit between the enemies.
 */
import type { PointsEvent } from '../points/state.ts';
import type { AppStorage } from '../storage.ts';
import { buildProblem, parseBuild, START_BUILD, UNLOCK_CHAPTER, type Build } from './build.ts';
import { precheck } from './battle.ts';
import { CHALLENGES, type Challenge } from './content/challenges.ts';
import { ENEMIES } from './content/index.ts';
import type { EnemyData } from './content/types.ts';
import { fightEnemy, type EnemyReport } from './fight.ts';
import type { RbError } from './py/errors.ts';

/** The code every new robot starts with: the finished First Contact solution, "just press Run". */
export const STARTER_SCRIPT = 'forward()\nfire()';
export const MAX_HISTORY = 30;

export type StepKind = 'battle' | Challenge['kind'];

export interface Step {
  id: string;
  kind: StepKind;
  /** Chapter of the step (a challenge: the chapter of the enemy it follows). */
  chapter: number;
  enemy?: EnemyData;
  challenge?: Challenge;
}

/** Enemies in order, each followed by the challenges that sit after it. */
export function buildSteps(enemies: readonly EnemyData[] = ENEMIES, challenges: readonly Challenge[] = CHALLENGES): Step[] {
  const steps: Step[] = [];
  for (const e of enemies) {
    steps.push({ id: e.id, kind: 'battle', chapter: e.chapter, enemy: e });
    for (const c of challenges) if (c.after === e.id) steps.push({ id: c.id, kind: c.kind, chapter: e.chapter, challenge: c });
  }
  return steps;
}

export interface HistoryEntry {
  at: number;
  script: string;
  /** The enemy it was run against. */
  step: string;
  result: 'won' | 'lost' | 'error';
}

export interface RobotProgress {
  build: Build;
  script: string;
  history: HistoryEntry[];
  /** Ids of the steps solved at least once. */
  solved: string[];
  /** Best stars (1-3) by enemy id. */
  stars: Record<string, number>;
  /** Hints shown so far (0-3) by enemy id. */
  hints: Record<string, number>;
  /** Failed runs by step id, until it is solved. */
  misses: Record<string, number>;
  /** All runs and the ones that won: the "% right" on Home. */
  runs: number;
  wins: number;
  current?: string;
}

export const emptyProgress = (): RobotProgress => ({ build: { ...START_BUILD, gear: [...START_BUILD.gear] }, script: STARTER_SCRIPT, history: [], solved: [], stars: {}, hints: {}, misses: {}, runs: 0, wins: 0 });

const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;
const record = (v: unknown, max: number, ids: Set<string>): Record<string, number> => {
  if (typeof v !== 'object' || v === null) return {};
  return Object.fromEntries(Object.entries(v).filter(([k, n]) => ids.has(k) && isCount(n) && n <= max)) as Record<string, number>;
};

export function parseProgress(raw: unknown, steps: readonly Step[]): RobotProgress {
  const out = emptyProgress();
  if (typeof raw !== 'object' || raw === null) return out;
  const r = raw as Record<string, unknown>;
  const ids = new Set(steps.map((s) => s.id));
  const build = parseBuild(r.build);
  if (build) out.build = build;
  if (typeof r.script === 'string' && r.script.trim() !== '') out.script = r.script;
  if (Array.isArray(r.history)) {
    out.history = r.history
      .filter((h): h is HistoryEntry => typeof h === 'object' && h !== null && typeof h.script === 'string' && typeof h.at === 'number' && typeof h.step === 'string' && ['won', 'lost', 'error'].includes(h.result))
      .slice(-MAX_HISTORY);
  }
  if (Array.isArray(r.solved)) out.solved = [...new Set(r.solved.filter((id): id is string => ids.has(id as string)))];
  out.stars = record(r.stars, 3, ids);
  out.hints = record(r.hints, 3, ids);
  out.misses = record(r.misses, 1000, ids);
  if (isCount(r.runs)) out.runs = r.runs;
  if (isCount(r.wins) && r.wins <= out.runs) out.wins = r.wins;
  if (typeof r.current === 'string' && ids.has(r.current)) out.current = r.current;
  return out;
}

/** The chapter whose parts are unlocked: the chapter of the first enemy that is not solved (side missions do not hold anyone back). */
export function unlockLevel(solved: readonly string[], steps: readonly Step[]): number {
  const open = steps.find((s) => s.kind === 'battle' && s.enemy!.regression !== false && !solved.includes(s.id));
  const chapter = open ? open.chapter : Math.max(...steps.map((s) => s.chapter));
  return chapter === 25 ? 2 : chapter;
}

export function isUnlocked(step: Step, solved: readonly string[], steps: readonly Step[]): boolean {
  if (solved.includes(step.id)) return true;
  if (step.challenge) return solved.includes(step.challenge.after);
  const index = steps.indexOf(step);
  return steps.slice(0, index).every((s) => s.kind !== 'battle' || s.enemy!.regression === false || solved.includes(s.id));
}

export interface RunReport {
  step: Step;
  /** A problem found before the fights (syntax, unknown name, part not equipped): nothing was run. */
  error?: RbError;
  report?: EnemyReport;
  /** Earlier enemies of the chapter that the script no longer beats. */
  broken: string[];
  /** The step counted as solved now (a win that broke nothing). */
  won: boolean;
  firstWin: boolean;
  stars: number;
}

export class RobotGame {
  readonly steps: readonly Step[];

  constructor(
    private storage: AppStorage,
    private enemies: readonly EnemyData[] = ENEMIES,
    challenges: readonly Challenge[] = CHALLENGES,
    private onPoints: (event: PointsEvent) => void = () => {},
    private now: () => number = Date.now,
  ) {
    this.steps = buildSteps(enemies, challenges);
  }

  progress(): RobotProgress {
    return parseProgress(this.storage.gameData('robot'), this.steps);
  }

  private save(p: RobotProgress) {
    this.storage.setGameData(p, 'robot');
  }

  step(id: string): Step | undefined {
    return this.steps.find((s) => s.id === id);
  }

  unlocked(id: string): boolean {
    const s = this.step(id);
    return !!s && isUnlocked(s, this.progress().solved, this.steps);
  }

  /** The step to play next: the open one, else the first unsolved battle, else the first step. */
  open(id?: string): Step {
    const p = this.progress();
    const wanted = id ? this.step(id) : undefined;
    const firstOpen = this.steps.find((s) => s.kind === 'battle' && s.enemy!.regression !== false && !p.solved.includes(s.id));
    const step = (wanted && isUnlocked(wanted, p.solved, this.steps) ? wanted : undefined) ?? (p.current ? this.step(p.current) : undefined) ?? firstOpen ?? this.steps[0]!;
    if (p.current !== step.id) this.save({ ...p, current: step.id });
    return step;
  }

  /** The robot's script; a blank file is never handed out. */
  script(): string {
    return this.progress().script;
  }

  setScript(script: string) {
    const p = this.progress();
    if (script === p.script) return;
    this.save({ ...p, script: script.trim() === '' ? STARTER_SCRIPT : script });
  }

  build(): Build {
    return this.progress().build;
  }

  level(): number {
    return unlockLevel(this.progress().solved, this.steps);
  }

  /** Saves a build if it is legal at the current chapter; returns false (and saves nothing) otherwise. */
  setBuild(build: Build): boolean {
    if (buildProblem(build, this.level())) return false;
    this.save({ ...this.progress(), build });
    return true;
  }

  /** Parts the player may pick now. */
  can(kind: 'chassis' | 'locomotion' | 'gear' | 'addon', id: string): boolean {
    const table = UNLOCK_CHAPTER[kind] as Record<string, number>;
    return (table[id] ?? 99) <= this.level();
  }

  hint(id: string): number {
    return this.progress().hints[id] ?? 0;
  }

  /** Shows the next hint (at most 3) and remembers that hints were used. */
  nextHint(id: string): number {
    const p = this.progress();
    const n = Math.min(3, (p.hints[id] ?? 0) + 1);
    this.save({ ...p, hints: { ...p.hints, [id]: n } });
    return n;
  }

  history(): HistoryEntry[] {
    return this.progress().history;
  }

  /** Puts an old version back as the robot's script (the current one stays in the history). */
  restore(index: number): boolean {
    const p = this.progress();
    const entry = p.history[index];
    if (!entry) return false;
    this.save({ ...p, script: entry.script });
    return true;
  }

  /**
   * Runs the robot against a battle step: all its layouts, plus a re-run of the
   * earlier enemies of the chapter. A win only counts when nothing earlier broke.
   */
  run(id: string): RunReport | undefined {
    const step = this.step(id);
    if (!step?.enemy || !this.unlocked(id)) return undefined;
    const enemy = step.enemy;
    let p = this.progress();
    const { build, script } = p;
    const stamp = (result: HistoryEntry['result']): HistoryEntry[] => {
      const last = p.history.at(-1);
      const entry: HistoryEntry = { at: this.now(), script, step: id, result };
      return (last && last.script === script && last.step === id ? [...p.history.slice(0, -1), entry] : [...p.history, entry]).slice(-MAX_HISTORY);
    };

    const error = precheck(build, script);
    if (error) {
      p = { ...p, history: stamp('error'), runs: p.runs + 1, misses: { ...p.misses, [id]: (p.misses[id] ?? 0) + (p.solved.includes(id) ? 0 : 1) } };
      this.save(p);
      return { step, error, broken: [], won: false, firstWin: false, stars: 0 };
    }

    const report = fightEnemy(enemy, this.enemies, build, script);
    const earlier = enemy.regression === false ? [] : this.enemies.filter((e) => e.chapter === enemy.chapter && e.regression !== false && this.enemies.indexOf(e) < this.enemies.indexOf(enemy));
    const broken = report.won ? earlier.filter((e) => !fightEnemy(e, this.enemies, build, script, true).won).map((e) => e.id) : [];
    const won = report.won && broken.length === 0;
    const already = p.solved.includes(id);
    const firstWin = won && !already;
    const hints = p.hints[id] ?? 0;
    const stars = won ? Math.max(1, 1 + (report.lines <= enemy.par ? 1 : 0) + (report.damage === 0 ? 1 : 0) - (hints > 0 ? 1 : 0)) : 0;
    const clean = (p.misses[id] ?? 0) === 0;
    p = {
      ...p,
      history: stamp(won ? 'won' : 'lost'),
      runs: p.runs + (already ? 0 : 1),
      wins: p.wins + (firstWin ? 1 : 0),
      solved: firstWin ? [...p.solved, id] : p.solved,
      stars: won ? { ...p.stars, [id]: Math.max(p.stars[id] ?? 0, stars) } : p.stars,
      misses: won || already ? p.misses : { ...p.misses, [id]: (p.misses[id] ?? 0) + 1 },
    };
    this.save(p);
    if (firstWin) this.onPoints({ type: 'level', game: 'robot', id, clean });
    return { step, report, broken, won, firstWin, stars };
  }

  /** A challenge was solved (the screen checked it). Pays once. */
  complete(id: string): boolean {
    const step = this.step(id);
    const p = this.progress();
    if (!step?.challenge || p.solved.includes(id) || !this.unlocked(id)) return false;
    this.save({ ...p, solved: [...p.solved, id], runs: p.runs + 1, wins: p.wins + 1 });
    this.onPoints({ type: 'level', game: 'robot', id, clean: (p.misses[id] ?? 0) === 0 });
    return true;
  }

  /** A wrong try in a challenge. */
  miss(id: string) {
    const p = this.progress();
    if (p.solved.includes(id)) return;
    this.save({ ...p, misses: { ...p.misses, [id]: (p.misses[id] ?? 0) + 1 }, runs: p.runs + 1 });
  }

  stats(): { done: number; total: number; runs: number; percent: number; stars: number } {
    const p = this.progress();
    return {
      done: p.solved.length,
      total: this.steps.length,
      runs: p.runs,
      percent: p.runs === 0 ? 0 : Math.round((100 * p.wins) / p.runs),
      stars: Object.values(p.stars).reduce((a, b) => a + b, 0),
    };
  }
}
