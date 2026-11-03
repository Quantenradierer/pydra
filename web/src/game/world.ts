import { Interpreter, parse, PyError, repr, type Builtin } from './python.ts';

/** Facing: 0 north (up), 1 east, 2 south, 3 west. */
export type Dir = 0 | 1 | 2 | 3;
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
const START: Record<string, Dir> = { '^': 0, '>': 1, v: 2, '<': 3 };

export interface Point {
  x: number;
  y: number;
}

/** A level's arena: a grid with rocks, fish and the hydra's start. */
export interface World {
  width: number;
  height: number;
  /** Rock cells as "x,y". Outside the grid counts as rock too. */
  rocks: ReadonlySet<string>;
  fish: readonly Point[];
  start: Point & { dir: Dir };
}

/**
 * Reads a map: one string per row, `#` rock, `.` water, `F` fish, and the
 * hydra's start facing `^ > v <`.
 */
export function parseMap(rows: readonly string[]): World {
  const rocks = new Set<string>();
  const fish: Point[] = [];
  let start: (Point & { dir: Dir }) | undefined;
  const width = rows[0]?.length ?? 0;
  for (const [y, row] of rows.entries()) {
    if (row.length !== width) throw new Error(`map row ${y} has length ${row.length}, expected ${width}`);
    for (const [x, cell] of [...row].entries()) {
      if (cell === '#') rocks.add(`${x},${y}`);
      else if (cell === 'F') fish.push({ x, y });
      else if (cell in START) {
        if (start) throw new Error('map has two starts');
        start = { x, y, dir: START[cell]! };
      } else if (cell !== '.') throw new Error(`unknown map cell ${JSON.stringify(cell)}`);
    }
  }
  if (!start) throw new Error('map has no start');
  return { width, height: rows.length, rocks, fish, start };
}

/** The picture at one step of a run. */
export interface Snapshot {
  /** The line about to run, highlighted; null once the program has ended. */
  line: number | null;
  x: number;
  y: number;
  dir: Dir;
  /** Cells the body covers behind the head, nearest first. Grows by one per fish. */
  body: Point[];
  /** Per fish of the world: eaten yet? */
  eaten: boolean[];
  /** Variables in scope as [name, Python repr]. */
  vars: [string, string][];
}

/** How a run ended. Only `success` solves a level. */
export type Outcome =
  | { kind: 'success' }
  /** The program ended with fish left. */
  | { kind: 'missed'; left: number }
  /** move() into a rock or the edge, in `line`. */
  | { kind: 'crash'; line: number }
  /** The program reached exactly the same state again: it would run forever. */
  | { kind: 'loop'; line: number }
  /** A Python error such as NameError. */
  | { kind: 'error'; line: number; message: string };

export interface Trace {
  steps: Snapshot[];
  outcome: Outcome;
}

/** Longest run before it counts as endless, even without a repeated state. */
export const MAX_STEPS = 300;

class Crash {}

/** Runs a program in a world and records every step. Deterministic. */
export function simulate(world: World, source: string, maxSteps = MAX_STEPS): Trace {
  let { x, y, dir } = world.start;
  let body: Point[] = [];
  const eaten = world.fish.map(() => false);
  const blocked = (cx: number, cy: number) =>
    cx < 0 || cy < 0 || cx >= world.width || cy >= world.height || world.rocks.has(`${cx},${cy}`);
  const ahead = (): Point => ({ x: x + DX[dir]!, y: y + DY[dir]! });
  const fishAt = (p: Point) => world.fish.findIndex((f, i) => !eaten[i] && f.x === p.x && f.y === p.y);

  const builtins: Builtin[] = [
    {
      kind: 'builtin',
      name: 'move',
      arity: 0,
      call: () => {
        const next = ahead();
        if (blocked(next.x, next.y)) throw new Crash();
        body = [{ x, y }, ...body];
        [x, y] = [next.x, next.y];
        const fish = fishAt(next);
        if (fish >= 0) eaten[fish] = true;
        body = body.slice(0, 1 + eaten.filter(Boolean).length);
        return null;
      },
    },
    { kind: 'builtin', name: 'turn_left', arity: 0, call: () => ((dir = ((dir + 3) % 4) as Dir), null) },
    { kind: 'builtin', name: 'turn_right', arity: 0, call: () => ((dir = ((dir + 1) % 4) as Dir), null) },
    { kind: 'builtin', name: 'wall_ahead', arity: 0, call: () => blocked(ahead().x, ahead().y) },
    { kind: 'builtin', name: 'fish_ahead', arity: 0, call: () => fishAt(ahead()) >= 0 },
  ];

  const interpreter = new Interpreter(builtins);
  const steps: Snapshot[] = [];
  const snapshot = (line: number | null): Snapshot => ({
    line,
    x,
    y,
    dir,
    body: [...body],
    eaten: [...eaten],
    vars: interpreter.variables().map(([name, value]) => [name, repr(value)]),
  });
  const seen = new Set<string>();
  let line = 0;

  try {
    const program = parse(source);
    for (const pause of interpreter.run(program)) {
      line = pause.line;
      steps.push(snapshot(line));
      const key = JSON.stringify([line, x, y, dir, eaten, interpreter.fingerprint()]);
      if (seen.has(key) || steps.length >= maxSteps) return { steps, outcome: { kind: 'loop', line } };
      seen.add(key);
    }
  } catch (error) {
    if (error instanceof Crash) return { steps, outcome: { kind: 'crash', line } };
    if (error instanceof PyError) {
      return { steps, outcome: { kind: 'error', line: error.line, message: error.message } };
    }
    throw error;
  }
  steps.push(snapshot(null));
  const left = eaten.filter((e) => !e).length;
  return { steps, outcome: left === 0 ? { kind: 'success' } : { kind: 'missed', left } };
}
