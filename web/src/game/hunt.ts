import { Interpreter, parse, PyError, repr, type Builtin } from './python.ts';
import type { Point } from './world.ts';

/**
 * "Hydra hunt": a warrior walks a grid, slays the hydras on it and picks up
 * the gold. A hydra is a snake: a head and a body a few cells long. The
 * warrior may walk on the body, and `attack()` there cuts the hydra and
 * slays it; but stepping onto the head of a living hydra gets him eaten.
 */

/** A hydra on the map: its head and its body, from the neck to the tail. */
export interface Hydra {
  head: Point;
  body: Point[];
}

export interface HuntWorld {
  width: number;
  height: number;
  /** Rock cells as "x,y". Outside the grid counts as rock too. */
  rocks: ReadonlySet<string>;
  hydras: readonly Hydra[];
  gold: readonly Point[];
  start: Point;
}

const NEIGHBOURS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;

/**
 * Reads a map: one string per row, `#` rock, `.` grass, `@` the warrior's
 * start, `G` gold, `H` a hydra's head and `o` its body. Every head needs a
 * body that runs from it as one line of `o` cells, apart from other hydras.
 */
export function parseHuntMap(rows: readonly string[]): HuntWorld {
  const rocks = new Set<string>();
  const gold: Point[] = [];
  const heads: Point[] = [];
  const bodyCells = new Set<string>();
  let start: Point | undefined;
  const width = rows[0]?.length ?? 0;
  for (const [y, row] of rows.entries()) {
    if (row.length !== width) throw new Error(`map row ${y} has length ${row.length}, expected ${width}`);
    for (const [x, cell] of [...row].entries()) {
      if (cell === '#') rocks.add(`${x},${y}`);
      else if (cell === 'G') gold.push({ x, y });
      else if (cell === 'H') heads.push({ x, y });
      else if (cell === 'o') bodyCells.add(`${x},${y}`);
      else if (cell === '@') {
        if (start) throw new Error('map has two starts');
        start = { x, y };
      } else if (cell !== '.') throw new Error(`unknown map cell ${JSON.stringify(cell)}`);
    }
  }
  if (!start) throw new Error('map has no start');
  const hydras = heads.map((head) => {
    const body: Point[] = [];
    let at = head;
    for (;;) {
      const here = at;
      const next = NEIGHBOURS.map(([dx, dy]) => ({ x: here.x + dx, y: here.y + dy })).filter((p) => bodyCells.has(`${p.x},${p.y}`));
      if (next.length > 1) throw new Error(`hydra body at ${at.x},${at.y} forks`);
      if (next.length === 0) break;
      at = next[0]!;
      bodyCells.delete(`${at.x},${at.y}`);
      body.push(at);
    }
    if (body.length === 0) throw new Error(`hydra head at ${head.x},${head.y} has no body`);
    return { head, body };
  });
  if (bodyCells.size > 0) throw new Error(`body cell ${[...bodyCells][0]} belongs to no hydra`);
  return { width, height: rows.length, rocks, hydras, gold, start };
}

/** What the warrior did in the step before a snapshot, for the animation. */
export type HuntAction = 'move' | 'attack' | null;

export interface HuntSnapshot {
  /** The line highlighted, whose effect the picture already shows; null once the program has ended. */
  line: number | null;
  x: number;
  y: number;
  /** Per hydra of the world: slain yet? */
  slain: boolean[];
  /** Per gold of the world: picked up yet? */
  taken: boolean[];
  /** The last command the warrior carried out. */
  action: HuntAction;
  /** Variables in scope as [name, Python repr]. */
  vars: [string, string][];
}

/** How a run ended. Only `success` solves a level. */
export type HuntOutcome =
  | { kind: 'success' }
  /** The program ended with hydras alive or gold left. */
  | { kind: 'missed'; hydras: number; gold: number }
  /** A step into a rock or off the map, in `line`. */
  | { kind: 'crash'; line: number }
  /** A step onto the head of a living hydra, in `line`. */
  | { kind: 'eaten'; line: number }
  /** attack() where there is no hydra body, in `line`. */
  | { kind: 'air'; line: number }
  /** The program reached exactly the same state again: it would run forever. */
  | { kind: 'loop'; line: number }
  /** A Python error such as NameError. */
  | { kind: 'error'; line: number; message: string };

export interface HuntTrace {
  steps: HuntSnapshot[];
  outcome: HuntOutcome;
}

/** Longest run before it counts as endless, even without a repeated state. */
export const MAX_HUNT_STEPS = 300;

class Stop {
  readonly kind: 'crash' | 'eaten' | 'air';
  constructor(kind: Stop['kind']) {
    this.kind = kind;
  }
}

const MOVES: [string, number, number][] = [
  ['move_north', 0, -1],
  ['move_east', 1, 0],
  ['move_south', 0, 1],
  ['move_west', -1, 0],
];

const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

/** Runs a program in a world and records every step. Deterministic. */
export function simulateHunt(world: HuntWorld, source: string, maxSteps = MAX_HUNT_STEPS): HuntTrace {
  let { x, y } = world.start;
  const slain = world.hydras.map(() => false);
  const taken = world.gold.map(() => false);
  let action: HuntAction = null;
  const blocked = (cx: number, cy: number) =>
    cx < 0 || cy < 0 || cx >= world.width || cy >= world.height || world.rocks.has(`${cx},${cy}`);
  /** The living hydra whose body is on the warrior's cell, or -1. */
  const bodyHere = () => world.hydras.findIndex((h, i) => !slain[i] && h.body.some((p) => same(p, { x, y })));

  const builtins: Builtin[] = [
    ...MOVES.map(
      ([name, dx, dy]): Builtin => ({
        kind: 'builtin',
        name,
        arity: 0,
        call: () => {
          if (blocked(x + dx, y + dy)) throw new Stop('crash');
          x += dx;
          y += dy;
          action = 'move';
          if (world.hydras.some((h, i) => !slain[i] && same(h.head, { x, y }))) throw new Stop('eaten');
          const gold = world.gold.findIndex((g, i) => !taken[i] && same(g, { x, y }));
          if (gold >= 0) taken[gold] = true;
          return null;
        },
      }),
    ),
    {
      kind: 'builtin',
      name: 'attack',
      arity: 0,
      call: () => {
        const hydra = bodyHere();
        if (hydra < 0) throw new Stop('air');
        slain[hydra] = true;
        action = 'attack';
        return null;
      },
    },
    { kind: 'builtin', name: 'body_here', arity: 0, call: () => bodyHere() >= 0 },
  ];

  const interpreter = new Interpreter(builtins);
  const steps: HuntSnapshot[] = [];
  const snapshot = (line: number | null): HuntSnapshot => ({
    line,
    x,
    y,
    slain: [...slain],
    taken: [...taken],
    action,
    vars: interpreter.variables().map(([name, value]) => [name, repr(value)]),
  });
  const seen = new Set<string>();
  /** The line that is running: a step shows the world after it, so the warrior acts when his line is reached. */
  let line = 0;
  let running = false;
  const finish = () => {
    if (running) steps.push(snapshot(line));
    running = false;
    action = null;
  };

  try {
    const program = parse(source);
    for (const pause of interpreter.run(program)) {
      finish();
      line = pause.line;
      running = true;
      const key = JSON.stringify([line, x, y, slain, taken, interpreter.fingerprint()]);
      if (seen.has(key) || steps.length >= maxSteps) {
        if (steps.length < maxSteps) finish();
        return { steps, outcome: { kind: 'loop', line } };
      }
      seen.add(key);
    }
    finish();
  } catch (error) {
    // A swing into the air is drawn on the step of its line; a warrior who is eaten already stands on the head.
    if (error instanceof Stop && error.kind === 'air') action = 'attack';
    finish();
    if (error instanceof Stop) return { steps, outcome: { kind: error.kind, line } };
    if (error instanceof PyError) {
      // A program that does not even parse still shows the map, with the line at fault.
      if (steps.length === 0) steps.push(snapshot(error.line));
      return { steps, outcome: { kind: 'error', line: error.line, message: error.message } };
    }
    throw error;
  }
  steps.push(snapshot(null));
  const hydras = slain.filter((s) => !s).length;
  const gold = taken.filter((t) => !t).length;
  return { steps, outcome: hydras === 0 && gold === 0 ? { kind: 'success' } : { kind: 'missed', hydras, gold } };
}
