/**
 * The brain of the line-by-line viewer, free of any DOM: the recorded frames
 * are cut into *beats* (one beat = one executed line with what it did, or the
 * moment a tick's action resolves in the arena), and the state at any beat
 * (variables, call stack, value hints next to the code) is computed by
 * replaying the trace up to it. Pure and deterministic, so it is unit-tested.
 */
import type { Frame } from './battle.ts';
import type { TraceEvent } from './py/trace.ts';

export interface Beat {
  /** Frame index: the beat belongs to this tick (0 = the start, before anything happened). */
  tick: number;
  /** `line`: the script runs a line; `resolve`: the tick's action plays out in the arena. */
  kind: 'start' | 'line' | 'resolve';
  /** The line to highlight (null: none). */
  line: number | null;
  /** What the line did, in order (empty for start / resolve). */
  events: TraceEvent[];
  /** A line that ran after the winning action: the arena already shows the final tick. */
  after?: true;
}

const startsGroup = (e: TraceEvent) => e.k === 'line' || e.k === 'leave';
const lineOf = (e: TraceEvent): number | null => (e.k === 'cut' ? null : e.line);

/** Cuts the frames into beats: a start, then per tick one beat per executed line and one `resolve` beat. */
export function buildBeats(frames: readonly Frame[]): Beat[] {
  const beats: Beat[] = [{ tick: 0, kind: 'start', line: null, events: [] }];
  for (const [tick, frame] of frames.entries()) {
    if (tick === 0) continue;
    let group: TraceEvent[] = [];
    const flush = () => {
      if (group.length === 0) return;
      beats.push({ tick, kind: 'line', line: lineOf(group[0]!), events: group });
      group = [];
    };
    for (const e of frame.trace ?? []) {
      if (startsGroup(e) || group.length === 0) flush();
      group.push(e);
    }
    flush();
    beats.push({ tick, kind: 'resolve', line: frame.lines.player ?? null, events: [] });
  }
  const last = frames.length - 1;
  let group: TraceEvent[] = [];
  const flushAfter = () => {
    if (group.length > 0) beats.push({ tick: last, kind: 'line', line: lineOf(group[0]!), events: group, after: true });
    group = [];
  };
  for (const e of frames[last]?.after ?? []) {
    if (startsGroup(e) || group.length === 0) flushAfter();
    group.push(e);
  }
  flushAfter();
  return beats;
}

/** Without a trace (an old replay) every tick is a single resolve beat. */
export const hasTrace = (frames: readonly Frame[]): boolean => frames.some((f) => f.trace !== undefined);

/** Index of the next beat of the given kind after `index` (or the last beat). */
export function nextBeat(beats: readonly Beat[], index: number, to: 'line' | 'tick'): number {
  const last = beats.length - 1;
  for (let i = index + 1; i <= last; i++) {
    if (to === 'line' || beats[i]!.kind === 'resolve') return i;
  }
  return last;
}

/** The previous beat of the kind; stepping back by a tick goes to the end of the previous tick (or the start). */
export function prevBeat(beats: readonly Beat[], index: number, to: 'line' | 'tick'): number {
  for (let i = index - 1; i >= 0; i--) {
    if (to === 'line' || beats[i]!.kind !== 'line') return i;
  }
  return 0;
}

export interface StackFrame {
  fn: string;
  /** The arguments as they were passed ("steps=3"). */
  args: string[];
  /** The line the function was called from. */
  callLine: number;
  vars: [string, string][];
}

export interface LineHint {
  /** `distance() → 3`, `forward()`. */
  call?: string;
  /** What an `if` / `while` / `for` decided. */
  branch?: { kind: 'if' | 'while' | 'for'; taken: boolean; hasElse?: boolean; n?: number; value?: string };
  /** `x = 3`. */
  set?: string;
}

export interface ViewState {
  globals: [name: string, value: string][];
  stack: StackFrame[];
  hints: Map<number, LineHint>;
}

const put = (vars: [string, string][], name: string, value: string) => {
  const found = vars.find((v) => v[0] === name);
  if (found) found[1] = value;
  else vars.push([name, value]);
};

/** The variables, call stack and per-line hints after beat `index` (everything before it counts as done). */
export function stateAt(beats: readonly Beat[], index: number): ViewState {
  const state: ViewState = { globals: [], stack: [], hints: new Map() };
  const hint = (line: number): LineHint => {
    let h = state.hints.get(line);
    if (!h) state.hints.set(line, (h = {}));
    return h;
  };
  for (let i = 0; i <= Math.min(index, beats.length - 1); i++) {
    for (const e of beats[i]!.events) {
      switch (e.k) {
        case 'set': {
          const scope = e.depth > 0 ? state.stack[e.depth - 1] : undefined;
          put(scope ? scope.vars : state.globals, e.name, e.value);
          hint(e.line).set = `${e.name} = ${e.value}`;
          break;
        }
        case 'enter': {
          const vars: [string, string][] = [];
          for (const a of e.args) {
            const eq = a.indexOf('=');
            put(vars, a.slice(0, eq), a.slice(eq + 1));
          }
          state.stack.push({ fn: e.fn, args: e.args, callLine: e.line, vars });
          break;
        }
        case 'leave':
          state.stack.pop();
          break;
        case 'call': {
          const text = `${e.fn}(${e.args.join(', ')})`;
          hint(e.line).call = e.result !== undefined && e.kind === 'sensor' ? `${text} → ${e.result}` : text;
          break;
        }
        case 'branch':
          hint(e.line).branch = { kind: e.kind, taken: e.taken, ...(e.hasElse !== undefined ? { hasElse: e.hasElse } : {}), ...(e.n !== undefined ? { n: e.n } : {}), ...(e.value !== undefined ? { value: e.value } : {}) };
          break;
        case 'line':
        case 'cut':
          break;
      }
    }
  }
  return state;
}

/** The call stack as a list of names for display: `main`-less, innermost last. */
export const stackNames = (state: ViewState): string[] => state.stack.map((f) => `${f.fn}(${f.args.map((a) => a.slice(a.indexOf('=') + 1)).join(', ')})`);
