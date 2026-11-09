/**
 * Robot Battler's progress on top of storage: the one robot (build and
 * script), the version history, which steps are solved and stars.
 * Every change is saved straight away. A step is an enemy (a battle) or one of
 * the challenges, one after the other.
 */
import type { PointsEvent } from '../points/state.ts';
import type { AppStorage } from '../storage.ts';
import { addonsFor, buildProblem, parseBuild, START_BUILD, type Build } from './build.ts';
import { precheck } from './battle.ts';
import { ENEMIES } from './content/index.ts';
import type { EnemyData } from './content/types.ts';
import { fightEnemy, type EnemyReport } from './fight.ts';
import { dailySeed, today, TRAINING_FROM, trainingFight } from './training.ts';
import type { RbError } from './py/errors.ts';

/** The code every new robot starts with: the finished First Contact solution, "just press Run". */
export const STARTER_SCRIPT = 'forward()\nfire()';
export const MAX_HISTORY = 30;

/** One challenge: an enemy on one map. The player's script is not part of it: it is one script for the whole game. */
export interface Step {
  id: string;
  chapter: number;
  enemy?: EnemyData;
}

/** The challenges in play order. */
export function buildSteps(enemies: readonly EnemyData[] = ENEMIES): Step[] {
  return enemies.map((e) => ({ id: e.id, chapter: e.chapter, enemy: e }));
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
  /** Failed runs by step id, until it is solved. */
  misses: Record<string, number>;
  /** All runs and the ones that won: the "% right" on Home. */
  runs: number;
  wins: number;
  /** Training Grounds: fights won, the next free seed, the date of the last daily fight won. */
  training: { wins: number; seed: number; daily: string };
  current?: string;
}

export const emptyProgress = (): RobotProgress => ({ build: { ...START_BUILD, gear: [...START_BUILD.gear] }, script: STARTER_SCRIPT, history: [], solved: [], stars: {}, misses: {}, runs: 0, wins: 0, training: { wins: 0, seed: 1, daily: '' } });

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
  out.misses = record(r.misses, 1000, ids);
  if (isCount(r.runs)) out.runs = r.runs;
  if (isCount(r.wins) && r.wins <= out.runs) out.wins = r.wins;
  if (typeof r.training === 'object' && r.training !== null) {
    const t = r.training as Record<string, unknown>;
    out.training = { wins: isCount(t.wins) ? t.wins : 0, seed: isCount(t.seed) && t.seed > 0 ? t.seed : 1, daily: typeof t.daily === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.daily) ? t.daily : '' };
  }
  if (typeof r.current === 'string' && ids.has(r.current)) out.current = r.current;
  return out;
}

/** The chapter whose parts are unlocked: the chapter of the first challenge that is not solved. */
export function unlockLevel(solved: readonly string[], steps: readonly Step[]): number {
  const open = steps.find((s) => !solved.includes(s.id));
  const chapter = open ? open.chapter : Math.max(...steps.map((s) => s.chapter));
  return chapter === 25 ? 2 : chapter === 45 ? 4 : chapter;
}

export function isUnlocked(step: Step, solved: readonly string[], steps: readonly Step[]): boolean {
  if (solved.includes(step.id)) return true;
  const index = steps.indexOf(step);
  return steps.slice(0, index).every((s) => solved.includes(s.id));
}

export interface RunReport {
  step: Step;
  /** A problem found before the fights (syntax, unknown name, part not equipped): nothing was run. */
  error?: RbError;
  report?: EnemyReport;
  /** The step counted as solved now. */
  won: boolean;
  firstWin: boolean;
  stars: number;
  /** Only with `run(id, true)` on a first win: gives the points; call it when the verdict shows. */
  award?: () => void;
}

export class RobotGame {
  readonly steps: readonly Step[];

  constructor(
    private storage: AppStorage,
    enemies: readonly EnemyData[] = ENEMIES,
    private onPoints: (event: PointsEvent) => void = () => {},
    private now: () => number = Date.now,
  ) {
    this.steps = buildSteps(enemies);
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
    const firstOpen = this.steps.find((s) => !p.solved.includes(s.id));
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

  /** Saves a build if it is legal (slots, no duplicates); any part may be equipped at any time. Returns false (and saves nothing) otherwise. */
  setBuild(build: Build): boolean {
    const full: Build = { ...build, addons: addonsFor(build.gear) };
    if (buildProblem(full)) return false;
    this.save({ ...this.progress(), build: full });
    return true;
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
   * Runs the robot against a battle step: its one fight. With `deferPoints` the points of a first win
   * wait in `RunReport.award` until the screen has shown the verdict.
   */
  run(id: string, deferPoints = false): RunReport | undefined {
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
      return { step, error, won: false, firstWin: false, stars: 0 };
    }

    const report = fightEnemy(enemy, build, script);
    const won = report.won;
    const already = p.solved.includes(id);
    const firstWin = won && !already;
    const stars = won ? Math.max(1, 1 + (report.lines <= enemy.par ? 1 : 0) + (report.damage === 0 ? 1 : 0)) : 0;
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
    const award = firstWin ? () => this.onPoints({ type: 'level', game: 'robot', id, clean }) : undefined;
    // The screen plays the fight first and hands out the points (and their toast) when the verdict shows.
    if (award && !deferPoints) award();
    return { step, report, won, firstWin, stars, ...(award && deferPoints ? { award } : {}) };
  }

  // ---- Training Grounds

  /** Training opens with Chapter 2. */
  canTrain(): boolean {
    return this.level() >= TRAINING_FROM;
  }

  /** A fight of the Training Grounds as a step the battle screen can play (it is never stored as solved). */
  trainingStep(seed: number | 'daily'): Step {
    const date = today(this.now());
    const fight = trainingFight(seed === 'daily' ? dailySeed(date) : seed, this.level(), seed === 'daily' ? `training-daily-${date}` : `training-${seed}`);
    return { id: fight.enemy.id, chapter: fight.enemy.chapter, enemy: fight.enemy };
  }

  /** The seed of the next endless fight; it moves on after every call. */
  nextTrainingSeed(): number {
    const p = this.progress();
    this.save({ ...p, training: { ...p.training, seed: p.training.seed + 1 } });
    return p.training.seed;
  }

  trainingStats(): { wins: number; dailyDone: boolean } {
    const t = this.progress().training;
    return { wins: t.wins, dailyDone: t.daily === today(this.now()) };
  }

  /** Runs the robot against a training fight. Counts wins, the daily one once per day; nothing else is stored. */
  runTraining(step: Step): RunReport | undefined {
    if (!step.enemy || !this.canTrain()) return undefined;
    const p = this.progress();
    const error = precheck(p.build, p.script);
    if (error) return { step, error, won: false, firstWin: false, stars: 0 };
    const report = fightEnemy(step.enemy, p.build, p.script);
    const stars = report.won ? Math.max(1, 1 + (report.lines <= step.enemy.par ? 1 : 0) + (report.damage === 0 ? 1 : 0)) : 0;
    if (report.won) {
      const daily = step.id.startsWith('training-daily-') ? step.id.slice('training-daily-'.length) : p.training.daily;
      this.save({ ...p, training: { ...p.training, wins: p.training.wins + 1, daily } });
    }
    return { step, report, won: report.won, firstWin: false, stars };
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
