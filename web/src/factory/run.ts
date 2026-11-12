/**
 * Runs the learner's Python against one belt of the factory, with the Robot
 * Battler interpreter. The four commands are host functions that pause the
 * script (an `ActionRequest`); `is_coal()` answers at once. `n` is set once at
 * the start; after every action the factory writes `ore` and `coal` into the
 * module variables. The program cannot set any of the three.
 *
 * Everything is recorded as frames (the block after each command, the line,
 * what happened, the trace of the lines run since the previous frame) that a
 * viewer can play step by step. Deterministic for a given source and setup.
 */
import { checkProgram } from '../robot/py/check.ts';
import { RbError } from '../robot/py/errors.ts';
import { Program } from '../robot/py/interp.ts';
import { parse } from '../robot/py/parser.ts';
import type { Expr, Stmt, Target } from '../robot/py/ast.ts';
import type { TraceEvent } from '../robot/py/trace.ts';
import { ActionRequest, type HostFunction, type Value } from '../robot/py/values.ts';
import { MACHINE_WORDS, World, type BeltItem, type Command, type IdleReason, type Item, type MachineWord, type Place, type WorldErrorCode, type WorldSnapshot } from './world.ts';

/** Steps (statements and calls) the program may run between two commands before the loop guard stops it. */
export const STEP_BUDGET = 1000;
/** Commands per belt before the factory stops a program that never finishes. */
export const MAX_ACTIONS = 500;
/** Trace events kept per frame. */
export const TRACE_CAP = 400;
/**
 * Lines of "Your machines" (the block lessons' prelude) are numbered from here, so they never mix
 * with the learner's own lines: own line 3 is 3, machines line 3 is MACHINES_LINE_BASE + 3. Use `lineRef()`.
 */
export const MACHINES_LINE_BASE = 10_000;
/** The learner's own text may have at most this many lines, so its numbers never reach MACHINES_LINE_BASE. */
export const MAX_OWN_LINES = MACHINES_LINE_BASE - 1;

/** The variables of the factory; the learner may read them but not set them. */
export type FactoryVar = 'ore' | 'coal' | 'n';
/** Every name of the factory: the five given words and the three variables. */
export type FactoryName = MachineWord | FactoryVar;
export const FACTORY_NAMES: readonly FactoryName[] = [...MACHINE_WORDS, 'ore', 'coal', 'n'];
/** `ore` and `coal` are never the learner's to set; `n` only in the lessons that have it (elsewhere it is a plain name). */
const readOnlyNames = (names: readonly string[]) => new Set(['ore', 'coal', ...(names.includes('n') ? ['n'] : [])]);

/**
 * How the program is run on a belt.
 * - once: one time, first line to last;
 * - per-item: again for each item that reaches the front of the belt (grabber lessons); it stops when the
 *   front item is still the one the last start was for (it was not taken);
 * - per-landing: the grey factory grabber puts the next item on its heap, then the program runs (smelter lessons).
 * Variables do not survive from one start to the next; the heaps do.
 */
export type RunMode = 'once' | 'per-item' | 'per-landing';

/** What the order sign asks for. A missing field is not part of the order; `plates: 'n'` means the belt's `n`. */
export interface Order {
  ore?: number;
  coal?: number;
  plates?: number | 'n';
}

export function orderMet(order: Order, s: WorldSnapshot, n = 0): boolean {
  if (order.ore !== undefined && s.ore !== order.ore) return false;
  if (order.coal !== undefined && s.coal !== order.coal) return false;
  if (order.plates !== undefined && s.plates !== (order.plates === 'n' ? n : order.plates)) return false;
  return true;
}

/** The learner's text, and for the block lessons the folded, read-only "Your machines" above it. */
export interface Source {
  own: string;
  machines?: string;
}

export interface RunSetup {
  mode: RunMode;
  /** The items on the belt, front first (per-landing: in the order the grey grabber delivers them). */
  belt: readonly Item[];
  /** Heaps at the start. */
  ore?: number;
  coal?: number;
  /** The value of `n` (block lessons B2, B3). */
  n?: number;
  /** The factory names the program can use (the machines prelude included). */
  names: readonly FactoryName[];
  order: Order;
  /** Record `Frame.trace` (the line-by-line viewer needs it; fast checks do not). */
  trace?: boolean;
}

/** Why a run did not get to the end, or why a program was not run at all. */
export type Problem =
  /** Wrong or missing material (world.ts). */
  | { kind: 'world'; code: WorldErrorCode; params: Record<string, string | number>; line: number }
  /** `ore = 3` (also `coal`, `n`): rejected before the run. */
  | { kind: 'read-only'; name: string; line: number }
  /**
   * A `def` or parameter of the own text named like a given command (`from: 'factory'`), a function of
   * "Your machines" (`'machines'`) or the function another lesson builds (its id): rejected before the run.
   */
  | { kind: 'reserved'; name: string; line: number; from: string }
  /** A given command in the learner's own code of a block lesson: rejected before the run. */
  | { kind: 'machines-only'; name: string; line: number }
  /** A Python error (syntax, unknown name, a name not available in this lesson, type errors…). */
  | { kind: 'python'; error: RbError }
  /** The loop guard: many steps without a command. */
  | { kind: 'budget'; line: number }
  /** More than MAX_ACTIONS commands on one belt. */
  | { kind: 'too-long'; line: number }
  /** A structural check of the lesson failed (see lessons.ts). */
  | { kind: 'check'; code: string; params: Record<string, string | number> };

/** The line a problem points at (combined numbering, see `lineRef`), if any. */
export function problemLine(p: Problem): number | undefined {
  if (p.kind === 'python') return p.error.line || undefined;
  if (p.kind === 'check') return undefined;
  return p.line;
}

/** Splits a line number into the learner's own text or "Your machines". */
export function lineRef(line: number): { part: 'own' | 'machines'; line: number } {
  return line > MACHINES_LINE_BASE ? { part: 'machines', line: line - MACHINES_LINE_BASE } : { part: 'own', line };
}

export type FrameEvent =
  /** Frame 0: the block before anything ran. */
  | { kind: 'begin' }
  /** The program (re)starts for `item`: it reached the front of the belt (`by: 'belt'`) or the grey grabber just put it on its heap (`by: 'factory'`). */
  | { kind: 'start'; item: BeltItem; by: 'belt' | 'factory' }
  /** A command ran. `idle`: harmless wasted motion. `item` / `place`: what was grabbed or dropped, and where. */
  | { kind: 'act'; command: Command; idle?: IdleReason; item?: Item; place?: Place }
  /** The program reached its last line (in per-item modes: this start is over). */
  | { kind: 'end' }
  /** The run stopped. `command`: the command that failed (a world error). */
  | { kind: 'error'; problem: Problem; command?: Command };

export interface Frame {
  /** The block after this event. */
  state: WorldSnapshot;
  /** The line the event happened on (combined numbering, see `lineRef`); null for begin / start / end. */
  line: number | null;
  event: FrameEvent;
  /** The order sign is green in this state. */
  orderMet: boolean;
  /** Which start of the program this belongs to (1 = the first; 0 = frame 0 of a per-item run). */
  start: number;
  /** What the program did since the previous frame, line by line (only with `trace: true`). */
  trace?: TraceEvent[];
  /** `act` frames: the functions written in Python (own or "Your machines") the command ran inside, outermost first. */
  inside?: string[];
}

export interface BeltRun {
  frames: Frame[];
  final: WorldSnapshot;
  /** The order is met at the end and nothing went wrong. */
  met: boolean;
  problem?: Problem;
  /** How often the program was started. */
  starts: number;
}

// ------------------------------------------------------------------ syntax tree helpers

/**
 * Calls `fn` on every statement, expression and target node below `node` (a generic walk over the plain
 * AST objects). With `skipDefs` the `def`s themselves and their bodies are left out.
 */
export function walk(node: unknown, fn: (n: Record<string, unknown>) => void, skipDefs = false) {
  if (Array.isArray(node)) {
    for (const x of node) walk(x, fn, skipDefs);
  } else if (node !== null && typeof node === 'object') {
    const o = node as Record<string, unknown>;
    if (typeof o.kind === 'string') {
      if (skipDefs && o.kind === 'def') return;
      fn(o);
    }
    for (const v of Object.values(o)) if (v !== null && typeof v === 'object') walk(v, fn, skipDefs);
  }
}

/** Parses the source: "Your machines" first (lines shifted by MACHINES_LINE_BASE), then the learner's text. Throws RbError. */
export function parseSource(source: Source): { own: Stmt[]; all: Stmt[] } {
  const lines = source.own.split('\n').length;
  if (lines > MAX_OWN_LINES) throw new RbError('SyntaxError', 'too-many-lines', { max: MAX_OWN_LINES }, 0, `the program has ${lines} lines, at most ${MAX_OWN_LINES} are allowed`);
  const own = parse(source.own);
  if (!source.machines) return { own, all: own };
  let machines: Stmt[];
  try {
    machines = parse(source.machines);
  } catch (e) {
    if (e instanceof RbError) throw new RbError(e.type, e.code, e.params, e.line + MACHINES_LINE_BASE, e.detail, e.col);
    throw e;
  }
  walk(machines, (n) => {
    if (typeof n.line === 'number') n.line += MACHINES_LINE_BASE;
  });
  return { own, all: [...machines, ...own] };
}

/** The first place the code gives one of `readOnly` a value (assignment, `+=`, a for loop, a def). */
function readOnlyWrite(ast: Stmt[], readOnly: ReadonlySet<string>): { name: string; line: number } | undefined {
  let found: { name: string; line: number } | undefined;
  const target = (t: Target, line: number) => {
    if (found) return;
    if (t.kind === 'name' && readOnly.has(t.name)) found = { name: t.name, line };
    else if (t.kind === 'tuple') t.items.forEach((x) => target(x, line));
  };
  walk(ast, (n) => {
    if (found) return;
    const s = n as unknown as Stmt;
    if (s.kind === 'assign') s.targets.forEach((t) => target(t, s.line));
    else if (s.kind === 'augassign' || s.kind === 'for') target(s.target, s.line);
    else if (s.kind === 'def' && readOnly.has(s.name)) found = { name: s.name, line: s.line };
  });
  return found;
}

/** Every use of a name (`grab`, `grab()`) in the code, in source order. */
export function nameUses(ast: Stmt[], names: ReadonlySet<string>): { name: string; line: number }[] {
  const out: { name: string; line: number }[] = [];
  walk(ast, (n) => {
    const e = n as unknown as Expr;
    if (e.kind === 'name' && names.has(e.name)) out.push({ name: e.name, line: e.line });
  });
  return out.sort((a, b) => a.line - b.line);
}

export interface PrecheckOptions {
  names: readonly FactoryName[];
  /** Names the learner's own text must not use (the block lessons: the five given words). */
  forbiddenInOwn?: readonly string[];
  /** Names the own text must not give a `def` or a parameter, with the lesson that builds them (G4: `make_plate` from S4). */
  reserved?: Readonly<Record<string, string>>;
}

/** The first `def` or parameter of the own text that would hide a command, a machine or another lesson's function. */
function reservedUse(own: Stmt[], machines: Stmt[], options: PrecheckOptions): Extract<Problem, { kind: 'reserved' }> | undefined {
  const from = new Map<string, string>();
  for (const w of MACHINE_WORDS) if (options.names.includes(w)) from.set(w, 'factory');
  for (const s of machines) if (s.kind === 'def') from.set(s.name, 'machines');
  for (const [name, lesson] of Object.entries(options.reserved ?? {})) from.set(name, lesson);
  let found: Extract<Problem, { kind: 'reserved' }> | undefined;
  walk(own, (n) => {
    const s = n as unknown as Stmt;
    if (found || s.kind !== 'def') return;
    const name = [s.name, ...s.params.map((p) => p.name)].find((x) => from.has(x));
    if (name !== undefined) found = { kind: 'reserved', name, line: s.line, from: from.get(name)! };
  });
  return found;
}

/**
 * Problems found before the run: syntax, `ore` / `coal` / `n` assigned, a `def` or parameter named like a
 * command or machine, unknown names, names this lesson does not have yet, and (block lessons) given commands
 * in the learner's own text.
 */
export function precheck(source: Source, options: PrecheckOptions): Problem | undefined {
  let parsed: { own: Stmt[]; all: Stmt[] };
  try {
    parsed = parseSource(source);
  } catch (e) {
    if (e instanceof RbError) return { kind: 'python', error: e };
    throw e;
  }
  const write = readOnlyWrite(parsed.own, readOnlyNames(options.names));
  if (write) return { kind: 'read-only', ...write };
  const reserved = reservedUse(parsed.own, parsed.all.slice(0, parsed.all.length - parsed.own.length), options);
  if (reserved) return reserved;
  const available = new Set<string>(options.names);
  const notEquipped = new Map<string, Record<string, string | number>>(FACTORY_NAMES.filter((n) => !available.has(n)).map((n) => [n, { kind: 'lesson' }]));
  const error = checkProgram(parsed.all, { known: options.names, notEquipped });
  if (error) return { kind: 'python', error };
  const forbidden = nameUses(parsed.own, new Set(options.forbiddenInOwn ?? []))[0];
  if (forbidden) return { kind: 'machines-only', ...forbidden };
  return undefined;
}

// ------------------------------------------------------------------ running

const noArgs = (name: string, args: Value[], kwargs: Record<string, Value>) => {
  const given = args.length + Object.keys(kwargs).length;
  if (given > 0) throw new RbError('TypeError', 'arg-count', { name, expected: 0, given }, 0, `${name}() takes 0 positional arguments but ${given} ${given === 1 ? 'was' : 'were'} given`);
};

/**
 * Runs the program on one belt and records the frames. Expects a source that passed `precheck`
 * (a syntax error still comes back as a problem, never as an exception).
 */
export function runBelt(source: Source, setup: RunSetup): BeltRun {
  const world = new World({ belt: setup.belt, ore: setup.ore ?? 0, coal: setup.coal ?? 0 });
  const n = setup.n ?? 0;
  const names = new Set<string>(setup.names);
  const frames: Frame[] = [];
  let buffer: TraceEvent[] = [];
  let cut = false;
  const record = (ev: TraceEvent) => {
    if (buffer.length < TRACE_CAP) buffer.push(ev);
    else if (!cut) (cut = true), buffer.push({ k: 'cut' });
  };
  /** The Python functions being run, outermost first, and the last line of the own text that ran. */
  let stack: string[] = [];
  let ownLine = 0;
  const follow = (ev: TraceEvent) => {
    if (ev.k === 'enter') stack.push(ev.fn);
    else if (ev.k === 'leave') stack.pop();
    else if ((ev.k === 'line' || ev.k === 'branch') && lineRef(ev.line).part === 'own') ownLine = ev.line;
    if (setup.trace) record(ev);
  };
  /** A stop with no material error points at the learner's own line, not into "Your machines". */
  const ownStop = (line: number) => (lineRef(line).part === 'machines' && ownLine > 0 ? ownLine : line);
  let start = 0;
  const push = (event: FrameEvent, line: number | null) => {
    const state = world.snapshot();
    const frame: Frame = { state, line, event, orderMet: orderMet(setup.order, state, n), start };
    if (event.kind === 'act') frame.inside = [...stack];
    if (setup.trace) {
      frame.trace = buffer;
      buffer = [];
      cut = false;
    }
    frames.push(frame);
  };
  const finish = (problem?: Problem): BeltRun => {
    const final = world.snapshot();
    return { frames, final, met: !problem && orderMet(setup.order, final, n), ...(problem ? { problem } : {}), starts: start };
  };

  push({ kind: 'begin' }, null);
  let ast: Stmt[];
  try {
    ast = parseSource(source).all;
  } catch (e) {
    if (!(e instanceof RbError)) throw e;
    const problem: Problem = { kind: 'python', error: e };
    push({ kind: 'error', problem }, e.line);
    return finish(problem);
  }

  const command = (name: Command): HostFunction => ({
    kind: 'host',
    name,
    call: (args, kwargs) => {
      noArgs(name, args, kwargs);
      return new ActionRequest(name);
    },
  });
  const hosts: Record<string, Value> = {};
  for (const c of ['grab', 'turn', 'drop', 'smelt'] as const) if (names.has(c)) hosts[c] = command(c);
  if (names.has('is_coal')) {
    hosts.is_coal = {
      kind: 'host',
      name: 'is_coal',
      call: (args, kwargs) => {
        noArgs('is_coal', args, kwargs);
        return world.isCoal();
      },
    };
  }
  /** The heaps, written again after every action (the program cannot set them, see `precheck`). */
  const heaps = (): Record<string, Value> => {
    const out: Record<string, Value> = {};
    if (names.has('ore')) out.ore = world.ore;
    if (names.has('coal')) out.coal = world.coal;
    return out;
  };
  let actions = 0;

  /** One start of the program, first line to last. Returns a problem if the run must stop. */
  const runProgram = (): Problem | undefined => {
    stack = [];
    ownLine = 0;
    // No `known`: "did you mean" only suggests what this program has (the lesson's names and its own).
    const program = new Program(ast, { globals: { ...hosts, ...heaps(), ...(names.has('n') ? { n } : {}) }, trace: follow });
    for (;;) {
      const r = program.runUntilAction(STEP_BUDGET);
      if (r.kind === 'done') {
        push({ kind: 'end' }, null);
        return undefined;
      }
      if (r.kind === 'error' || r.kind === 'budget') {
        const problem: Problem = r.kind === 'error' ? { kind: 'python', error: r.error } : { kind: 'budget', line: ownStop(r.line) };
        push({ kind: 'error', problem }, r.kind === 'error' ? r.error.line : ownStop(r.line));
        return problem;
      }
      const cmd = r.request.payload as Command;
      if (++actions > MAX_ACTIONS) {
        const problem: Problem = { kind: 'too-long', line: ownStop(r.line) };
        push({ kind: 'error', problem, command: cmd }, problem.line);
        return problem;
      }
      const result = world.act(cmd);
      if (!result.ok) {
        const problem: Problem = { kind: 'world', code: result.code, params: result.params, line: r.line };
        push({ kind: 'error', problem, command: cmd }, r.line);
        return problem;
      }
      const event: FrameEvent = { kind: 'act', command: cmd };
      if (result.idle) event.idle = result.idle;
      else {
        if (result.item) event.item = result.item;
        if (result.place) event.place = result.place;
      }
      push(event, r.line);
      for (const [k, v] of Object.entries(heaps())) program.module.vars.set(k, v);
    }
  };

  if (setup.mode === 'once') {
    start = 1;
    return finish(runProgram());
  }
  if (setup.mode === 'per-landing') {
    while (world.belt.length > 0) {
      const item = world.land()!;
      start++;
      push({ kind: 'start', item, by: 'factory' }, null);
      const problem = runProgram();
      if (problem) return finish(problem);
    }
    return finish();
  }
  let last: number | undefined;
  for (;;) {
    const front = world.belt[0];
    // Nothing new reached the front: the item the last start was for is still there (it was not taken).
    if (!front || front.id === last) return finish();
    last = front.id;
    start++;
    push({ kind: 'start', item: { ...front }, by: 'belt' }, null);
    const problem = runProgram();
    if (problem) return finish(problem);
  }
}
