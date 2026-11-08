/**
 * Runs one battle: builds the world from a layout, gives every robot a brain
 * (the player's script, an enemy script, or none for dummies) and plays ticks
 * until somebody wins or the time is up. Everything is recorded in frames for
 * the replay viewer. Deterministic for a given layout, build and script.
 */
import { addonsFor, CHASSIS, type Build } from './build.ts';
const buildHp = (b: Build): number => CHASSIS[b.chassis].hp;
import { World, type GameEvent, type Intent, type Outcome, type Pos, type Dir } from './engine.ts';
import { buildLayout, type EnemyDef, type LayoutSpec } from './layout.ts';
import { createEnv, type Env, type Step } from './parts.ts';
import { checkProgram } from './py/check.ts';
import { RbError } from './py/errors.ts';
import { Program } from './py/interp.ts';
import { parse } from './py/parser.ts';
import type { ActionRequest } from './py/values.ts';

/** Steps (statements and calls) one robot may run per tick before the loop guard stops it. */
export const STEP_BUDGET = 1000;

export interface RobotFrame {
  id: string;
  pos: Pos;
  facing: Dir;
  hp: number;
  maxHp: number;
  shieldUp: boolean;
}

export interface Frame {
  tick: number;
  robots: RobotFrame[];
  events: GameEvent[];
  /** The script line each robot acted on this tick (null: nothing, e.g. the script ended). */
  lines: Record<string, number | null>;
  bubbles: { robot: string; text: string }[];
  /** Sensor values the scripts read this tick. */
  sensors: Record<string, string[]>;
}

export type EndReason = 'win' | 'dead' | 'timeout' | 'error' | 'budget';

export interface BattleResult {
  outcome: Outcome;
  reason: EndReason;
  /** Frame 0 is the start; frame n is the world after tick n. */
  frames: Frame[];
  /** A Python error that stopped the player's script (reason "error"), or the line of a budget stop. */
  error?: RbError;
  budgetLine?: number;
  /** HP the player lost over the battle. */
  damageTaken: number;
  /** Everything print() wrote, as bubbles also. */
  mapRows: string[];
  tiles: string[][];
}

class Brain {
  private queue: Step[] = [];
  private line: number | null = null;
  private resume = null;
  ended = false;
  error: RbError | undefined;
  budgetLine: number | undefined;

  constructor(
    readonly program: Program,
    private env: Env,
  ) {}

  /** Runs free statements (say, assignments) up to the next action; used once after the winning tick. */
  runFree() {
    if (this.queue.length === 0 && !this.ended) {
      const r = this.program.runUntilAction(STEP_BUDGET, this.resume);
      if (r.kind === 'action') this.ended = true;
    }
  }

  /** The intent for this tick and the line it came from. */
  next(): { intent: Intent; line: number | null } {
    if (this.queue.length === 0 && !this.ended) {
      const r = this.program.runUntilAction(STEP_BUDGET, this.resume);
      if (r.kind === 'action') {
        this.queue = [...(r.request as ActionRequest).payload as Step[]];
        this.line = r.line;
      } else {
        this.ended = true;
        this.line = null;
        if (r.kind === 'error') this.error = r.error;
        if (r.kind === 'budget') this.budgetLine = r.line;
      }
    }
    const step = this.queue.shift();
    if (!step) return { intent: { type: 'wait' }, line: null };
    return { intent: typeof step === 'function' ? step() : step, line: this.line };
  }

  get stopped(): boolean {
    return this.error !== undefined || this.budgetLine !== undefined;
  }

  tickStart() {
    this.env.tickStart();
  }
}

export interface BattleInput {
  build: Build;
  script: string;
  layout: LayoutSpec;
}

/** The build an enemy fights with (same parts as the player could get). */
export function enemyBuild(def: EnemyDef): Build {
  const gear = (def.gear ?? ['blaster', 'eyes']) as Build['gear'];
  return { chassis: 'medium', locomotion: def.locomotion ?? 'wheels', gear, addons: addonsFor(99), blasterMark: 1 };
}

/** Errors found before the battle starts: syntax, unknown names, parts that are not equipped. */
export function precheck(build: Build, script: string): RbError | undefined {
  try {
    const ast = parse(script);
    const env = createEnv({ world: new World({ tiles: [['floor']], robots: [], seed: 0 }), id: 'player', build, sensorLog: [], say: () => {} });
    return checkProgram(ast, { known: env.known, notEquipped: env.notEquipped });
  } catch (e) {
    if (e instanceof RbError) return e;
    throw e;
  }
}

export function runBattle(input: BattleInput): BattleResult {
  const { build, script, layout } = input;
  const built = buildLayout(layout, buildHp(build), { canCross: { rubble: build.locomotion === 'legs', pit: false } });
  const world = new World(built.setup);
  const bubbles: Frame['bubbles'] = [];
  const logs = new Map<string, string[]>();
  const brains = new Map<string, Brain>();

  const addBrain = (id: string, b: Build, source: string | undefined, strict: boolean) => {
    if (source === undefined) return;
    const sensorLog: string[] = [];
    logs.set(id, sensorLog);
    const env = createEnv({ world, id, build: b, sensorLog, say: (text) => bubbles.push({ robot: id, text }) });
    const program = new Program(parse(source), {
      globals: env.globals,
      known: [...env.notEquipped.keys()],
      print: (t) => bubbles.push({ robot: id, text: t.replace(/\n$/, '').slice(0, 40) }),
    });
    void strict;
    brains.set(id, new Brain(program, env));
  };
  addBrain('player', build, script, true);
  for (const r of world.robots.filter((x) => x.team === 'enemy')) {
    const def = built.defOf[r.id]!;
    addBrain(r.id, enemyBuild(def), def.script, false);
  }

  const snapshot = (events: GameEvent[], lines: Frame['lines'], bubbleList: Frame['bubbles'], sensors: Frame['sensors']): Frame => ({
    tick: world.tick,
    robots: world.robots.map((r) => ({ id: r.id, pos: { ...r.pos }, facing: r.facing, hp: r.hp, maxHp: r.maxHp, shieldUp: r.shieldUp })),
    events,
    lines,
    bubbles: bubbleList,
    sensors,
  });
  const frames: Frame[] = [snapshot([], {}, [], {})];
  let error: RbError | undefined;
  let budgetLine: number | undefined;
  let reason: EndReason = 'timeout';

  while (world.tick < world.maxTicks) {
    bubbles.length = 0;
    for (const log of logs.values()) log.length = 0;
    const intents = new Map<string, Intent>();
    const lines: Frame['lines'] = {};
    for (const r of world.alive()) {
      const brain = brains.get(r.id);
      brain?.tickStart();
    }
    for (const r of world.alive()) {
      const brain = brains.get(r.id);
      if (!brain) continue;
      const { intent, line } = brain.next();
      intents.set(r.id, intent);
      lines[r.id] = line;
      if (r.id === 'player' && brain.stopped) {
        error = brain.error;
        budgetLine = brain.budgetLine;
      } else if (brain.stopped) throw new Error(`enemy script failed: ${brain.error?.message ?? 'budget'} (line ${brain.error?.line ?? brain.budgetLine})`);
    }
    const sensors: Frame['sensors'] = {};
    for (const [id, log] of logs) if (log.length > 0) sensors[id] = [...log];
    if (error || budgetLine !== undefined) {
      // The script stopped before acting: the battle ends here with the message.
      frames.push(snapshot([], lines, [...bubbles], sensors));
      reason = error ? 'error' : 'budget';
      break;
    }
    const events = world.step(intents);
    frames.push(snapshot(events, lines, [...bubbles], sensors));
    const outcome = world.outcome();
    if (outcome) {
      reason = outcome === 'win' ? 'win' : world.player.hp <= 0 ? 'dead' : 'timeout';
      break;
    }
  }
  if (reason === 'win') {
    // The script may still say() something after its last action ("done" after a loop).
    bubbles.length = 0;
    brains.get('player')?.runFree();
    frames.at(-1)!.bubbles.push(...bubbles);
  }
  const outcome: Outcome = reason === 'win' ? 'win' : 'loss';
  return {
    outcome,
    reason,
    frames,
    ...(error ? { error } : {}),
    ...(budgetLine !== undefined ? { budgetLine } : {}),
    damageTaken: world.player.maxHp - world.player.hp,
    mapRows: built.mapRows,
    tiles: world.tiles.map((row) => [...row]),
  };
}
