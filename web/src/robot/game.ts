/**
 * Robot Battler's progress on top of storage: the one robot (build and
 * script), the version history, which steps are solved and stars.
 * Every change is saved straight away. A step is an enemy (a battle) or one of
 * the challenges that sit between the enemies.
 */
import type { PointsEvent } from '../points/state.ts';
import type { AppStorage } from '../storage.ts';
import { addonsFor, buildProblem, parseBuild, START_BUILD, type Build } from './build.ts';
import { precheck } from './battle.ts';
import { CHALLENGES, type Challenge } from './content/challenges.ts';
import { ENEMIES } from './content/index.ts';
import type { EnemyData } from './content/types.ts';
import { fightEnemy, type EnemyReport } from './fight.ts';
import { buildQueue, type QueueItem } from './variations.ts';
import { dailySeed, today, TRAINING_FROM, trainingFight } from './training.ts';
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

/**
 * A challenge is a fight like any other: the enemy it is fought against, as a side fight of its own
 * (never part of the chapter's regression run). A special rule is part of the fight's conditions.
 */
export function fightOf(c: Challenge, enemies: readonly EnemyData[]): EnemyData {
  const base = enemies.find((e) => e.id === c.enemy)!;
  const rule = c.kind === 'constraint' ? { ...base.needs, ...(c.maxLines !== undefined ? { maxLines: c.maxLines } : {}), ...c.needs } : base.needs;
  const catchLine = c.kind === 'constraint' && c.rule ? { de: `${c.prompt.de} ${c.rule.de}`, en: `${c.prompt.en} ${c.rule.en}` } : c.prompt;
  return { ...base, id: c.id, title: c.title, catchLine, regression: false, ...(rule ? { needs: rule } : {}), ...(c.kind === 'constraint' ? { solution: c.solution } : {}) };
}

/** Enemies in order, each followed by the challenges that sit after it. */
export function buildSteps(enemies: readonly EnemyData[] = ENEMIES, challenges: readonly Challenge[] = CHALLENGES): Step[] {
  const steps: Step[] = [];
  for (const e of enemies) {
    steps.push({ id: e.id, kind: 'battle', chapter: e.chapter, enemy: e });
    for (const c of challenges) if (c.after === e.id) steps.push({ id: c.id, kind: c.kind, chapter: e.chapter, challenge: c, enemy: fightOf(c, enemies) });
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

/** The chapter whose parts are unlocked: the chapter of the first enemy that is not solved (side missions do not hold anyone back). */
export function unlockLevel(solved: readonly string[], steps: readonly Step[]): number {
  const open = steps.find((s) => s.kind === 'battle' && s.enemy!.regression !== false && !solved.includes(s.id));
  const chapter = open ? open.chapter : Math.max(...steps.map((s) => s.chapter));
  return chapter === 25 ? 2 : chapter === 45 ? 4 : chapter;
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
  /** Only with `run(id, true)` on a first win: gives the points; call it when the verdict shows. */
  award?: () => void;
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

  /** The earlier enemies of the chapter that a script must still beat (empty for side missions and training fights). */
  earlierEnemies(enemy: EnemyData): EnemyData[] {
    return enemy.regression === false ? [] : this.enemies.filter((e) => e.chapter === enemy.chapter && e.regression !== false && this.enemies.indexOf(e) < this.enemies.indexOf(enemy));
  }

  /** All fights the robot meets after the first one: other layouts of the enemy, then the earlier enemies of the chapter. */
  variationQueue(step: Step): QueueItem[] {
    const enemy = step.enemy!;
    return buildQueue(enemy, this.earlierEnemies(enemy), this.enemies.includes(enemy) || step.challenge ? this.enemies : []);
  }

  /**
   * Runs the robot against a battle step: all its layouts, plus a re-run of the
   * earlier enemies of the chapter. A win only counts when nothing earlier broke. With `deferPoints` the points of a first win
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
      return { step, error, broken: [], won: false, firstWin: false, stars: 0 };
    }

    const report = fightEnemy(enemy, this.enemies, build, script);
    const earlier = this.earlierEnemies(enemy);
    const broken = report.won ? earlier.filter((e) => !fightEnemy(e, this.enemies, build, script, true).won).map((e) => e.id) : [];
    const won = report.won && broken.length === 0;
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
    return { step, report, broken, won, firstWin, stars, ...(award && deferPoints ? { award } : {}) };
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
    return { id: fight.enemy.id, kind: 'battle', chapter: fight.enemy.chapter, enemy: fight.enemy };
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
    if (error) return { step, error, broken: [], won: false, firstWin: false, stars: 0 };
    const report = fightEnemy(step.enemy, [], p.build, p.script);
    const stars = report.won ? Math.max(1, 1 + (report.lines <= step.enemy.par ? 1 : 0) + (report.damage === 0 ? 1 : 0)) : 0;
    if (report.won) {
      const daily = step.id.startsWith('training-daily-') ? step.id.slice('training-daily-'.length) : p.training.daily;
      this.save({ ...p, training: { ...p.training, wins: p.training.wins + 1, daily } });
    }
    return { step, report, broken: [], won: report.won, firstWin: false, stars };
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
