import { MAX_STEPS } from './world.ts';
import type { PuzzleLevel } from './puzzle.ts';
import { Interpreter, parse, PyError, repr, str, type Builtin, type Value } from './python.ts';

/**
 * A level of the heads game: every function call grows the hydra a head
 * that holds the call's variables, and `return` hands a value back down.
 * The goal is a value in a variable and/or what the program prints.
 */
export interface HeadsLevel extends PuzzleLevel {
  goal: {
    /** Variables that must hold these values at the end, as Python repr. */
    vars?: Record<string, string>;
    /** The lines print() must have written, all of them, in order. */
    output?: string[];
  };
}

/** One head: a running function call. */
export interface Head {
  /** The call as written, e.g. `double(4)`. */
  label: string;
  /** Its local variables as [name, repr]. */
  vars: [string, string][];
}

/** The picture at one step of a run. */
export interface HeadsSnapshot {
  /** The line about to run, highlighted; null once the program has ended. */
  line: number | null;
  /** Variables in scope (globals, then the running call's locals) as [name, repr]. */
  vars: [string, string][];
  /** The global variables, shown on the hydra's body. */
  globals: [string, string][];
  /** The running calls, the oldest (lowest head) first. */
  heads: Head[];
  /** Everything printed so far, one entry per line. */
  output: string[];
  /** A call that finished since the step before, and the value it handed back (repr). */
  returned?: { name: string; value: string };
}

/** How a run ended. Only `success` solves a level. */
export type HeadsOutcome =
  | { kind: 'success' }
  /** The program ended, but a goal variable holds another value (null: it does not exist). */
  | { kind: 'wrong'; name: string; got: string | null; want: string }
  /** The program ended, but printed something else than the goal. */
  | { kind: 'output' }
  /** The program reached exactly the same state again: it would run forever. */
  | { kind: 'loop'; line: number }
  /** A Python error such as NameError or RecursionError. */
  | { kind: 'error'; line: number; message: string };

export interface HeadsTrace {
  steps: HeadsSnapshot[];
  outcome: HeadsOutcome;
}

/** Runs a program of the heads game and records every step. Deterministic. */
export function simulateHeads(level: HeadsLevel, source: string, maxSteps = MAX_STEPS): HeadsTrace {
  const output: string[] = [];
  const print: Builtin = {
    kind: 'builtin',
    name: 'print',
    arity: -1,
    call: (args) => {
      output.push(args.map(str).join(' '));
      return null;
    },
  };
  const interpreter = new Interpreter([print]);
  const show = (pairs: [string, Value][]) => pairs.map(([name, value]): [string, string] => [name, repr(value)]);
  const steps: HeadsSnapshot[] = [];
  const snapshot = (line: number | null): HeadsSnapshot => {
    const returned = interpreter.takeReturn();
    return {
      line,
      vars: show(interpreter.variables()),
      globals: show(interpreter.globalVariables()),
      heads: interpreter.stack().map((f) => ({ label: `${f.name}(${f.args.map(repr).join(', ')})`, vars: show(f.vars) })),
      output: [...output],
      ...(returned ? { returned: { name: returned.name, value: repr(returned.value) } } : {}),
    };
  };
  const seen = new Set<string>();
  let line = 0;
  try {
    for (const pause of interpreter.run(parse(source))) {
      line = pause.line;
      steps.push(snapshot(line));
      const key = JSON.stringify([line, output, interpreter.fingerprint()]);
      if (seen.has(key) || steps.length >= maxSteps) return { steps, outcome: { kind: 'loop', line } };
      seen.add(key);
    }
  } catch (error) {
    // The last step shows the moment before the error, with every head still there.
    if (error instanceof PyError) return { steps, outcome: { kind: 'error', line: error.line, message: error.message } };
    throw error;
  }
  const end = snapshot(null);
  steps.push(end);
  return { steps, outcome: judge(level, end) };
}

/** Whether the end of a run reaches the level's goal. */
function judge(level: HeadsLevel, end: HeadsSnapshot): HeadsOutcome {
  const globals = new Map(end.globals);
  for (const [name, want] of Object.entries(level.goal.vars ?? {})) {
    const got = globals.get(name) ?? null;
    if (got !== want) return { kind: 'wrong', name, got, want };
  }
  const { output } = level.goal;
  if (output && JSON.stringify(output) !== JSON.stringify(end.output)) return { kind: 'output' };
  return { kind: 'success' };
}
