/**
 * Runs the learner's Python in the building, with the Robot Battler
 * interpreter. The learner's lines (no function around them) run from the top
 * every time a car has nothing to do: a "run" of that car, with fresh variables.
 * Functions the program defines are event handlers the building calls in
 * between: `on_floor_button` when a rider presses a floor button, `on_call` when
 * someone on a floor presses the call button; they belong to the latest run.
 *
 * As long as there is one car, the program has a fixed first line
 * `elevator = elevators[0]` (the prelude) and `on_floor_button` gets no car.
 * With two or more cars the prelude is gone: during a run `elevator` is the car
 * that has nothing to do, and `on_floor_button` gets the car as its first
 * parameter.
 *
 * Everything is recorded (one snapshot per tick, every run and handler call with
 * its trace) so the viewer can play it back. Deterministic.
 */
import { checkProgram } from '../robot/py/check.ts';
import { RbError, suggest } from '../robot/py/errors.ts';
import { Program } from '../robot/py/interp.ts';
import { parse } from '../robot/py/parser.ts';
import type { Expr, Stmt, Target } from '../robot/py/ast.ts';
import type { TraceEvent } from '../robot/py/trace.ts';
import { ActionRequest, repr, type HostFunction, type HostObject, type PyFunction, type Value } from '../robot/py/values.ts';
import { Building, TICKS_PER_SECOND, type BuildingEvent, type BuildingSnapshot, type Spawn, type Stats } from './sim.ts';

/** The handlers the building calls (the "nothing to do" part is the program's own lines, no handler). */
export const HANDLERS = ['on_floor_button', 'on_call'] as const;
export type Handler = (typeof HANDLERS)[number];
/** The commands of a car (`elevator.go_to_floor(2)`). */
export const METHODS = ['go_to_floor', 'current_floor', 'pressed_floors'] as const;
/** The building's own questions, plain functions: the waiting people belong to the building, not to a car (`waiting(3)`). */
export const FUNCTIONS = ['waiting'] as const;

/** The fixed first line while there is only one car. */
export const PRELUDE = 'elevator = elevators[0]';
/** Prelude lines are numbered from here, so they never mix with the learner's lines (see `lineRef`). */
export const PRELUDE_LINE_BASE = 10_000;
/** Steps one run or handler call may take before the loop guard stops it. */
export const STEP_BUDGET = 2000;
/** A run that leaves its car with nothing to do runs again this many ticks later (1 s). */
export const RUN_AGAIN_TICKS = 10;
/** Trace events kept per handler call. */
export const TRACE_CAP = 300;

/** The parameters a handler gets (their names are free, their number is not). */
export function handlerParams(name: Handler, multi: boolean): string[] {
  if (name === 'on_call') return ['floor'];
  return multi ? ['elevator', 'floor'] : ['floor'];
}

/** What the challenge asks for. */
export interface Goal {
  /** Get this many people to their floor... */
  people: number;
  /** ...within this many seconds... */
  seconds: number;
  /** ...with at most this many trips... */
  maxMoves?: number;
  /** ...and nobody takes longer than this many seconds from appearing to getting out (also while still waiting)... */
  maxWait?: number;
  /** ...and no car stops at a closed floor (the building site). */
  noSiteStops?: boolean;
}

export interface RunSetup {
  floors: number;
  cars: number;
  capacity?: number;
  closed?: readonly number[];
  spawns: readonly Spawn[];
  goal: Goal;
  /** Record the trace of every handler call (the viewer needs it; fast checks do not). */
  trace?: boolean;
  /** The handlers the learner knows by now: a hint never names one they have not met (all when missing). */
  handlers?: readonly Handler[];
}

/** Why a program could not start (found before the run), or why its run ended in a crash. */
export type Problem =
  /** A Python error: before the start (syntax, unknown name) or while running (a crash). */
  | { kind: 'python'; error: RbError }
  /** A handler ran very long without ending, a loop that never stops (a crash). */
  | { kind: 'budget'; line: number; handler: string }
  /** A car drove to a floor that does not exist and crashed (`line`: where the floor was put on its list). */
  | { kind: 'no-floor'; floor: number; max: number; where: 'roof' | 'pit'; line: number }
  /** `elevators = …` (also `elevator = …` while it is the prelude's). */
  | { kind: 'read-only'; name: string; line: number }
  /** `def on_idle():` (as in Elevator Saga): not needed, the program's own lines are that part. */
  | { kind: 'idle-def'; line: number }
  /** `def on_idel():`, a name like a handler that the building never calls. */
  | { kind: 'unknown-handler'; name: string; line: number; suggestion?: string }
  /** A handler with the wrong number of parameters. */
  | { kind: 'handler-params'; name: string; line: number; expected: number; given: number; params: string }
  /** `go_to_floor(1)` without `elevator.` in front; `car` is what to write instead (`elevator`, `elevators[0]`). */
  | { kind: 'needs-elevator'; name: string; line: number; car: string };

/** Why a run that did not crash missed the goal (a run can miss it in several ways). */
export type Miss = 'time' | 'moves' | 'wait' | 'site';

/** The line a problem points at (combined numbering), if any. */
export function problemLine(p: Problem): number | undefined {
  if (p.kind === 'python') return p.error.line || undefined;
  return p.line;
}

/** Splits a line number into the learner's own text or the prelude. */
export function lineRef(line: number): { part: 'own' | 'prelude'; line: number } {
  return line > PRELUDE_LINE_BASE ? { part: 'prelude', line: line - PRELUDE_LINE_BASE } : { part: 'own', line };
}

/** One time the learner's code ran: a run of the program for an idle car (`handler: null`, `car`), or a handler call. */
export interface Call {
  tick: number;
  handler: Handler | null;
  /** The car with nothing to do (runs only). */
  car?: number;
  /** A run that goes on after waiting: the floor whose stop it waited for. */
  after?: number;
  /** The arguments as Python shows them ("0", "<Elevator 1>"). */
  args: string[];
  /** The car commands it gave, in order (`elevator.go_to_floor(1)`, `elevators[1].go_to_floor(3)`). */
  commands: string[];
  /** Every car's list before the call (with `trace` only). */
  before?: number[][];
  /** The floors put on a list, with the line that did it and the index in `trace` where it happened (with `trace` only). */
  sent?: { car: number; floor: number; line: number; at: number }[];
  trace?: TraceEvent[];
}

export interface RunResult {
  /** One snapshot per tick, from tick 0 to the last one run. */
  frames: BuildingSnapshot[];
  calls: Call[];
  /** Who appeared, with their floors (indexed by passenger id). */
  passengers: { from: number; to: number; tick: number }[];
  stats: Stats;
  passed: boolean;
  /** Before the start: why the program could not run. After: why it crashed. */
  problem?: Problem;
  /** The tick the problem happened (with `problem`). */
  problemTick?: number;
  /** The cars that crashed (with a problem found while running). */
  crashed?: number[];
  /** How the goal was missed, in the order of `Miss` (empty when passed or crashed). */
  misses: Miss[];
  /** The tick a limit of the goal was first broken (the viewer turns its number red from there). */
  broken: Partial<Record<'moves' | 'wait' | 'site', number>>;
  /** Buttons were lit inside a car at the end and no on_floor_button drives there (a hint for a miss). */
  pressedIgnored?: boolean;
  /** A floor where people waited that no car ever stopped at (a hint for a miss). */
  neverVisited?: number;
  /** At the end every car stood still with an empty list (a hint for a miss). */
  stoodStill?: boolean;
  /** A car (of two or more) that never left its place (a hint for a miss). */
  unusedCar?: number;
}

// ------------------------------------------------------------------ before the run

function walk(node: unknown, fn: (n: Record<string, unknown>) => void) {
  if (Array.isArray(node)) {
    for (const x of node) walk(x, fn);
  } else if (node !== null && typeof node === 'object') {
    const o = node as Record<string, unknown>;
    if (typeof o.kind === 'string') fn(o);
    for (const v of Object.values(o)) if (v !== null && typeof v === 'object') walk(v, fn);
  }
}

function parseAll(own: string, prelude: boolean): { own: Stmt[]; all: Stmt[] } {
  const ownAst = parse(own);
  if (!prelude) return { own: ownAst, all: ownAst };
  const pre = parse(PRELUDE);
  walk(pre, (n) => {
    if (typeof n.line === 'number') n.line += PRELUDE_LINE_BASE;
  });
  return { own: ownAst, all: [...pre, ...ownAst] };
}

function readOnlyWrite(ast: Stmt[], names: ReadonlySet<string>): { name: string; line: number } | undefined {
  let found: { name: string; line: number } | undefined;
  const target = (t: Target, line: number) => {
    if (found) return;
    if (t.kind === 'name' && names.has(t.name)) found = { name: t.name, line };
    else if (t.kind === 'tuple') t.items.forEach((x) => target(x, line));
  };
  walk(ast, (n) => {
    if (found) return;
    const s = n as unknown as Stmt;
    if (s.kind === 'assign') s.targets.forEach((t) => target(t, s.line));
    else if (s.kind === 'augassign' || s.kind === 'for') target(s.target, s.line);
    else if (s.kind === 'def' && names.has(s.name)) found = { name: s.name, line: s.line };
  });
  return found;
}

/** The handlers the learner's code defines at the top level. */
export function definedHandlers(ast: Stmt[]): Handler[] {
  return ast.flatMap((s) => (s.kind === 'def' && (HANDLERS as readonly string[]).includes(s.name) ? [s.name as Handler] : []));
}

/**
 * Problems found before the run: syntax, unknown names, `elevators = …` / `elevator = …`, `def on_idle`, handler
 * names and parameters, a car command without `elevator.`.
 */
export function precheck(own: string, cars: number): Problem | undefined {
  const prelude = cars === 1;
  const multi = cars > 1;
  let parsed: { own: Stmt[]; all: Stmt[] };
  try {
    parsed = parseAll(own, prelude);
  } catch (e) {
    if (e instanceof RbError) return { kind: 'python', error: e };
    throw e;
  }
  const write = readOnlyWrite(parsed.own, new Set(['elevators', 'elevator']));
  if (write) return { kind: 'read-only', ...write };
  for (const s of parsed.own) {
    if (s.kind !== 'def') continue;
    if (s.name === 'on_idle') return { kind: 'idle-def', line: s.line };
    if ((HANDLERS as readonly string[]).includes(s.name)) {
      const want = handlerParams(s.name as Handler, multi);
      if (s.params.length !== want.length) return { kind: 'handler-params', name: s.name, line: s.line, expected: want.length, given: s.params.length, params: want.join(', ') };
    } else if (/^on_/.test(s.name)) {
      const hint = suggest(s.name, HANDLERS);
      return { kind: 'unknown-handler', name: s.name, line: s.line, ...(hint ? { suggestion: hint } : {}) };
    }
  }
  // `go_to_floor(1)` alone: the command belongs to a car.
  let bare: { name: string; line: number } | undefined;
  const defined = new Set<string>();
  walk(parsed.own, (n) => {
    const s = n as unknown as Stmt;
    if (s.kind === 'def') defined.add(s.name);
  });
  walk(parsed.own, (n) => {
    const e = n as unknown as Expr;
    if (!bare && e.kind === 'name' && (METHODS as readonly string[]).includes(e.name) && !defined.has(e.name)) bare = { name: e.name, line: e.line };
  });
  if (bare) return { kind: 'needs-elevator', ...bare, car: 'elevator' };
  const error = checkProgram(parsed.all, { known: ['elevators', 'elevator', ...FUNCTIONS], notEquipped: new Map() });
  if (error) return { kind: 'python', error };
  return undefined;
}

// ------------------------------------------------------------------ the run

const noArgs = (name: string, args: Value[], kwargs: Record<string, Value>) => {
  const given = args.length + Object.keys(kwargs).length;
  if (given > 0) throw new RbError('TypeError', 'arg-count', { name, expected: 0, given }, 0, `${name}() takes 0 positional arguments but ${given} ${given === 1 ? 'was' : 'were'} given`);
};

/**
 * Runs the program in the building and records it. Expects a source that passed `precheck` (a problem still comes back,
 * never an exception). The run goes on until the goal's number of people got there or the time is up; a broken limit
 * of the goal is only noted (`broken`). A Python error, a loop that never ends, or a car sent to a floor that does not
 * exist crash the car(s) and end the run.
 */
export function runBuilding(own: string, setup: RunSetup): RunResult {
  const building = new Building({ floors: setup.floors, cars: setup.cars, ...(setup.capacity ? { capacity: setup.capacity } : {}), ...(setup.closed ? { closed: setup.closed } : {}), spawns: setup.spawns });
  const multi = setup.cars > 1;
  const all = Array.from({ length: setup.cars }, (_, i) => i);
  const frames: BuildingSnapshot[] = [building.snapshot()];
  const calls: Call[] = [];
  const passengers = () => building.passengers.map((p) => ({ from: p.from, to: p.to, tick: p.tick }));
  const visited = new Set<number>([0]);
  const broken: RunResult['broken'] = {};
  const finish = (extra: Partial<RunResult>): RunResult => ({ frames, calls, passengers: passengers(), stats: building.stats(), passed: false, misses: [], broken, ...extra });

  let ast: Stmt[];
  /** The program has lines of its own besides its `def`s: running it again can give a car something to do. */
  let hasLines: boolean;
  try {
    const parsed = parseAll(own, !multi);
    ast = parsed.all;
    hasLines = parsed.own.some((s) => s.kind !== 'def');
  } catch (e) {
    if (!(e instanceof RbError)) throw e;
    return finish({ problem: { kind: 'python', error: e }, problemTick: 0 });
  }

  // The car objects. `go_to_floor` takes any whole number; the line that put a floor on a list is kept for a crash.
  let current: Call | undefined;
  let program: Program | undefined;
  const listedAt = all.map(() => new Map<number, number>());
  const carObject = (i: number): HostObject => {
    const self = multi ? `elevators[${i}]` : 'elevator';
    const method = (name: string, call: HostFunction['call']): HostFunction => ({ kind: 'host', name, call });
    const methods: Record<string, HostFunction> = {
      go_to_floor: method('go_to_floor', (args, kwargs) => {
        const given = args.length + Object.keys(kwargs).length;
        if (given !== 1) throw new RbError('TypeError', 'arg-count', { name: 'go_to_floor', expected: 1, given }, 0, `go_to_floor() takes 1 positional argument but ${given} were given`);
        const floor = args[0] ?? kwargs.floor ?? null;
        // Only an int: not True, not "2", not 2.5.
        if (typeof floor !== 'number' || !Number.isInteger(floor)) throw new RbError('TypeError', 'elevator-floor-type', { name: 'go_to_floor', value: repr(floor) }, 0, `floor must be an int, not ${repr(floor)}`);
        if (!building.queueOf(i).includes(floor)) listedAt[i]!.set(floor, program?.line ?? 0);
        building.goToFloor(i, floor);
        current?.commands.push(`${self}.go_to_floor(${floor})`);
        current?.sent?.push({ car: i, floor, line: program?.line ?? 0, at: buffer.length });
        // In a run the program waits here until the car has stopped at that floor; a handler only puts it on the list.
        return current?.handler === null ? new ActionRequest({ car: i, floor }) : null;
      }),
      current_floor: method('current_floor', (args, kwargs) => (noArgs('current_floor', args, kwargs), building.currentFloor(i))),
      pressed_floors: method('pressed_floors', (args, kwargs) => (noArgs('pressed_floors', args, kwargs), building.pressedFloors(i))),
    };
    return { kind: 'object', name: 'Elevator', get: (attr) => methods[attr], names: () => Object.keys(methods) };
  };
  const cars = all.map((i) => carObject(i));
  /** `waiting(floor)`: how many people wait on that floor right now. Like `go_to_floor`, only a whole number. */
  const waitingFn: HostFunction = {
    kind: 'host',
    name: 'waiting',
    call: (args, kwargs) => {
      const given = args.length + Object.keys(kwargs).length;
      if (given !== 1) throw new RbError('TypeError', 'arg-count', { name: 'waiting', expected: 1, given }, 0, `waiting() takes 1 positional argument but ${given} were given`);
      const floor = args[0] ?? kwargs.floor ?? null;
      if (typeof floor !== 'number' || !Number.isInteger(floor)) throw new RbError('TypeError', 'elevator-floor-type', { name: 'waiting', value: repr(floor) }, 0, `floor must be an int, not ${repr(floor)}`);
      return building.waitingAt(floor);
    },
  };

  let buffer: TraceEvent[] = [];
  const record = (ev: TraceEvent) => {
    if (!setup.trace) return;
    if (buffer.length < TRACE_CAP) buffer.push(ev);
    else if (buffer.length === TRACE_CAP) buffer.push({ k: 'cut' });
  };

  /** A crash: the cars stop where they are (the viewer lets them fall), the run ends. */
  type Crash = { problem: Problem; cars: number[] };

  /** The program of the latest run: its functions are the handlers. Undefined before the first run. */
  let latest: Program | undefined;
  /** The runs that wait at a `go_to_floor`, by the car they run for: until `wait.car` finished its stop at `wait.floor`. */
  const waiting = new Map<number, { prog: Program; wait: { car: number; floor: number } }>();

  /**
   * Runs a program (a run, or a started handler call) until it ends or, in a run, waits at a `go_to_floor`. One part of
   * a run is one `Call` (a run that waits three times has four). A Python error or an endless loop crashes `crashes`.
   */
  const runCall = (prog: Program, call: Call, crashes: number[]): Crash | { waitsFor: { car: number; floor: number } } | undefined => {
    program = prog;
    current = call;
    buffer = [];
    if (setup.trace) {
      call.before = all.map((i) => building.queueOf(i));
      call.sent = [];
    }
    const r = prog.runUntilAction(STEP_BUDGET);
    if (setup.trace) call.trace = buffer;
    calls.push(call);
    current = undefined;
    if (r.kind === 'error') return { problem: { kind: 'python', error: r.error }, cars: crashes };
    if (r.kind === 'budget') return { problem: { kind: 'budget', line: r.line, handler: call.handler ?? '' }, cars: crashes };
    if (r.kind === 'action') return { waitsFor: r.request.payload as { car: number; floor: number } };
    return undefined;
  };
  const crashed = (c: Crash, tick: number): RunResult => {
    building.crash(c.cars);
    frames[frames.length - 1] = building.snapshot();
    return finish({ problem: c.problem, problemTick: tick, crashed: c.cars });
  };
  /**
   * When the program runs again for a car that it left with nothing to do (by car). The building only says "idle" when a
   * car becomes idle; a run that sends it nowhere (`if waiting(floor) > 0:` while nobody waits) would leave it standing
   * for good, so the program runs again a second later.
   */
  const again = new Map<number, number>();
  /** Starts or continues the run of `car`; keeps it in `waiting` if it waits again. */
  const runPart = (car: number, prog: Program, after?: number): Crash | undefined => {
    const r = runCall(prog, { tick: building.tick, handler: null, car, args: [], commands: [], ...(after !== undefined ? { after } : {}) }, [car]);
    if (r && 'problem' in r) return r;
    if (r) waiting.set(car, { prog, wait: r.waitsFor });
    else {
      waiting.delete(car);
      if (hasLines && building.isIdle(car)) again.set(car, building.tick + RUN_AGAIN_TICKS);
    }
    return undefined;
  };

  const handlerFn = (name: Handler): PyFunction | undefined => {
    const v = latest?.module.vars.get(name);
    return v && typeof v === 'object' && !Array.isArray(v) && 'kind' in v && v.kind === 'function' ? v : undefined;
  };
  const dispatch = (events: BuildingEvent[]): Crash | undefined => {
    for (const ev of events) {
      if (ev.kind === 'crash') {
        const line = listedAt[ev.car]!.get(ev.floor) ?? 0;
        return { problem: { kind: 'no-floor', floor: ev.floor, max: setup.floors - 1, where: ev.where, line }, cars: [ev.car] };
      }
      if (ev.kind === 'served') {
        // A run that waited for this stop goes on (its `go_to_floor` is done).
        for (const [car, w] of [...waiting]) {
          if (w.wait.car !== ev.car || w.wait.floor !== ev.floor) continue;
          const c = runPart(car, w.prog, ev.floor);
          if (c) return c;
        }
        continue;
      }
      if (ev.kind === 'idle') {
        // A run still going (waiting) is not started again.
        if (waiting.has(ev.car)) continue;
        again.delete(ev.car);
        // The car has nothing to do: the program runs from the top, with fresh variables; `elevator` is that car.
        const prog = new Program(ast, { globals: { elevators: cars, waiting: waitingFn, ...(multi ? { elevator: cars[ev.car]! } : {}) }, trace: record });
        // The handlers are known from the start of the run, wherever their `def` stands: the run may wait at a
        // `go_to_floor` above them, and the building calls them in between.
        for (const st of ast) {
          if (st.kind === 'def' && (HANDLERS as readonly string[]).includes(st.name)) {
            prog.module.vars.set(st.name, { kind: 'function', name: st.name, params: st.params, defaults: st.params.map(() => undefined), body: st.body, closure: prog.module });
          }
        }
        latest = prog;
        const c = runPart(ev.car, prog);
        if (c) return c;
        continue;
      }
      const name: Handler = ev.kind === 'floor_button' ? 'on_floor_button' : 'on_call';
      const fn = handlerFn(name);
      if (!fn || !latest) continue;
      const args: Value[] = ev.kind === 'call' ? [ev.floor] : multi ? [cars[ev.car]!, ev.floor] : [ev.floor];
      // The car of the handler crashes on an error; `on_call` has none, so all of them do (with one car: that one).
      const crashes = ev.kind === 'call' ? all : [ev.car];
      // The precheck checked the parameters of the top-level defs; a handler made some other way is checked here.
      if (fn.params.length !== args.length) {
        return { problem: { kind: 'handler-params', name, line: 0, expected: args.length, given: fn.params.length, params: handlerParams(name, multi).join(', ') }, cars: crashes };
      }
      // Its own interpreter, so a run that waits is not disturbed; the function still sees its run's variables.
      const caller = new Program([], { trace: record });
      caller.startCall(fn, args);
      const shown = args.map((a) => (typeof a === 'object' && a !== null && !Array.isArray(a) && 'kind' in a && a.kind === 'object' ? `elevators[${cars.indexOf(a)}]` : repr(a)));
      const r = runCall(caller, { tick: building.tick, handler: name, args: shown, commands: [] }, crashes);
      if (r && 'problem' in r) return r;
    }
    return undefined;
  };

  let crash = dispatch(building.begin());
  frames[0] = building.snapshot();
  if (crash) return crashed(crash, 0);

  const { goal } = setup;
  const limit = goal.seconds * TICKS_PER_SECOND;
  for (;;) {
    const events = building.step();
    // A car the program left with nothing to do: it runs again (after the building's own events of this tick).
    for (const [car, at] of [...again]) {
      if (building.tick < at) continue;
      again.delete(car);
      if (building.isIdle(car) && !waiting.has(car) && !events.some((e) => e.kind === 'idle' && e.car === car)) events.push({ kind: 'idle', car });
    }
    for (const c of building.snapshot().cars) if (c.state === 'stopped' && !c.site) visited.add(Math.round(c.pos));
    crash = dispatch(events);
    frames.push(building.snapshot());
    if (crash) return crashed(crash, building.tick);
    const stats = building.stats();
    const tick = building.tick;
    if (goal.maxMoves !== undefined && stats.moves > goal.maxMoves) broken.moves ??= tick;
    if (goal.noSiteStops && stats.siteStops > 0) broken.site ??= tick;
    if (goal.maxWait !== undefined && broken.wait === undefined) {
      const longest = Math.max(stats.maxWait, ...building.passengers.filter((p) => p.arrived === undefined).map((p) => (tick - p.tick) / TICKS_PER_SECOND));
      if (longest > goal.maxWait) broken.wait = tick;
    }
    if (stats.transported >= goal.people || tick >= limit) break;
  }

  const misses: Miss[] = [];
  if (building.stats().transported < goal.people) misses.push('time');
  if (broken.moves !== undefined) misses.push('moves');
  if (broken.wait !== undefined) misses.push('wait');
  if (broken.site !== undefined) misses.push('site');
  if (misses.length === 0) return finish({ passed: true });
  return finish({ misses, ...hint() });

  function hint(): Pick<RunResult, 'neverVisited' | 'stoodStill' | 'unusedCar' | 'pressedIgnored'> {
    const snap = building.snapshot();
    const knows = (h: Handler) => !setup.handlers || setup.handlers.includes(h);
    if (knows('on_floor_button') && !handlerFn('on_floor_button') && snap.cars.some((c) => c.pressed.some((f) => !c.queue.includes(f)))) return { pressedIgnored: true };
    if (snap.cars.every((c) => c.state === 'idle' && c.queue.length === 0)) return { stoodStill: true };
    if (multi) {
      const unused = snap.cars.findIndex((_, i) => frames.every((f) => f.cars[i]!.state === 'idle'));
      if (unused >= 0) return { unusedCar: unused };
    }
    // A floor with people that no car stopped at and none is on its way to.
    const floor = snap.waiting.findIndex((w, f) => w.length > 0 && !visited.has(f) && !snap.cars.some((c) => c.queue.includes(f)));
    return floor >= 0 ? { neverVisited: floor } : {};
  }
}
