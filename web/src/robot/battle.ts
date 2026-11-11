/**
 * Runs one battle: builds the world from a layout, gives every robot a brain
 * (the player's script, an enemy script, or none for dummies) and plays ticks
 * until somebody wins or the time is up. Everything is recorded in frames for
 * the replay viewer. Deterministic for a given layout, build and script.
 */
import { addonsFor, CHASSIS, locomotionArmor, type Build } from './build.ts';
const buildHp = (b: Build): number => CHASSIS[b.chassis].hp;
import { World, type Dir, type GameEvent, type Intent, type Outcome, type Pos, type Tile } from './engine.ts';
import { enemyScript } from './enemy-script.ts';
import { buildLayout, type EnemyDef, type LayoutSpec } from './layout.ts';
import { createEnv, type Env, type Step } from './parts.ts';
import { checkProgram } from './py/check.ts';
import { RbError } from './py/errors.ts';
import { Program } from './py/interp.ts';
import { parse } from './py/parser.ts';
import type { TraceEvent } from './py/trace.ts';
import type { ActionRequest } from './py/values.ts';

/** Trace events kept per tick (a script that runs 1 000 steps without acting would otherwise fill the viewer). */
export const TRACE_CAP = 400;

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
  /** What the player's script did before this tick's action (only recorded with `trace: true`). */
  trace?: TraceEvent[];
  /** The same for every enemy script (by robot id; only with `trace: true`). */
  traces?: Record<string, TraceEvent[]>;
  /** On the last frame of a win: what the script still did after the winning action (a print after the last action). */
  after?: TraceEvent[];
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
  tiles: Tile[][];
  /** What each robot was built from (for the pictures: the replay draws every robot from its parts). */
  builds?: Record<string, Build>;
  /** The code each enemy ran (by robot id): the viewer can show it and step through it. */
  scripts?: Record<string, string>;
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

  /** Runs free statements (print, assignments) up to the next action; used once after the winning tick. */
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
  /** Record `Frame.trace` for the player's script (the line-by-line viewer needs it; fast checks do not). */
  trace?: boolean;
}

/** The build an enemy fights with (same parts as the player could get). */
export function enemyBuild(def: EnemyDef): Build {
  const gear = (def.gear ?? ['blaster', 'eyes']) as Build['gear'];
  return { chassis: 'medium', locomotion: def.locomotion ?? 'wheels', gear, addons: addonsFor(gear), blasterMark: 1 };
}

/** Errors found before the battle starts: syntax, unknown names, parts that are not equipped. */
export function precheck(build: Build, script: string): RbError | undefined {
  try {
    const ast = parse(script);
    const env = createEnv({ world: new World({ tiles: [['floor']], robots: [], seed: 0 }), id: 'player', build, sensorLog: [] });
    return checkProgram(ast, { known: env.known, notEquipped: env.notEquipped });
  } catch (e) {
    if (e instanceof RbError) return e;
    throw e;
  }
}

export function runBattle(input: BattleInput): BattleResult {
  const { build, script, layout } = input;
  const built = buildLayout(layout, buildHp(build), { canCross: { rubble: build.locomotion !== 'wheels', pit: false }, armor: locomotionArmor(build.locomotion), plates: build.gear.includes('plates') });
  const world = new World(built.setup);
  const builds: Record<string, Build> = { player: build };
  for (const r of world.robots) if (r.team === 'enemy') builds[r.id] = enemyBuild(built.defOf[r.id]!);
  const bubbles: Frame['bubbles'] = [];
  const logs = new Map<string, string[]>();
  const brains = new Map<string, Brain>();
  /** What each script did since the last frame (taken per tick, so each tick gets its own). */
  const tracing = new Map<string, { events: TraceEvent[]; cut: boolean }>();
  const recorder = (id: string) => {
    const buf = { events: [] as TraceEvent[], cut: false };
    tracing.set(id, buf);
    return (ev: TraceEvent) => {
      if (buf.events.length < TRACE_CAP) buf.events.push(ev);
      else if (!buf.cut) (buf.cut = true), buf.events.push({ k: 'cut' });
    };
  };
  const scripts: Record<string, string> = {};

  const addBrain = (id: string, b: Build, source: string | undefined, strict: boolean) => {
    if (source === undefined) return;
    const sensorLog: string[] = [];
    logs.set(id, sensorLog);
    const env = createEnv({ world, id, build: b, sensorLog });
    const program = new Program(parse(source), {
      globals: env.globals,
      known: [...env.notEquipped.keys()],
      print: (t) => bubbles.push({ robot: id, text: t.replace(/\n$/, '').slice(0, 40) }),
      ...(input.trace ? { trace: recorder(id) } : {}),
    });
    void strict;
    brains.set(id, new Brain(program, env));
  };
  try {
    addBrain('player', build, script, true);
  } catch (e) {
    if (!(e instanceof RbError)) throw e;
    // A syntax error: nothing runs, the battle is lost on the spot.
    return {
      outcome: 'loss',
      reason: 'error',
      frames: [
        {
          tick: 0,
          robots: world.robots.map((r) => ({ id: r.id, pos: { ...r.pos }, facing: r.facing, hp: r.hp, maxHp: r.maxHp, shieldUp: false })),
          events: [],
          lines: {},
          bubbles: [],
          sensors: {},
        },
      ],
      error: e,
      damageTaken: 0,
      mapRows: built.mapRows,
      tiles: world.tiles.map((row) => [...row]),
      builds,
    };
  }
  for (const r of world.robots.filter((x) => x.team === 'enemy')) {
    const def = built.defOf[r.id]!;
    scripts[r.id] = enemyScript(def, built.mirrored);
    addBrain(r.id, enemyBuild(def), scripts[r.id], false);
  }

  /** The trace of the script run since the last frame (taken, so each tick gets its own). */
  const takeTrace = (): Pick<Frame, 'trace' | 'traces'> => {
    if (!input.trace) return {};
    const take = (id: string): TraceEvent[] => {
      const buf = tracing.get(id);
      if (!buf) return [];
      const events = buf.events;
      buf.events = [];
      buf.cut = false;
      return events;
    };
    const traces: Record<string, TraceEvent[]> = {};
    for (const id of tracing.keys()) if (id !== 'player') traces[id] = take(id);
    return { trace: take('player'), traces };
  };
  const snapshot = (events: GameEvent[], lines: Frame['lines'], bubbleList: Frame['bubbles'], sensors: Frame['sensors']): Frame => ({
    tick: world.tick,
    robots: world.robots.map((r) => ({ id: r.id, pos: { ...r.pos }, facing: r.facing, hp: r.hp, maxHp: r.maxHp, shieldUp: r.shieldUp })),
    events,
    lines,
    bubbles: bubbleList,
    sensors,
    ...takeTrace(),
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
    // The script may still print something after its last action ("done" after a loop).
    bubbles.length = 0;
    brains.get('player')?.runFree();
    frames.at(-1)!.bubbles.push(...bubbles);
    const rest = tracing.get('player')?.events ?? [];
    if (input.trace && rest.length > 0) frames.at(-1)!.after = rest;
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
    builds,
    scripts,
  };
}
