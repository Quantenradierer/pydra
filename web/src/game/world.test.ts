import { describe, expect, it } from 'vitest';
import { MAX_STEPS, parseMap, simulate } from './world.ts';

const corridor = parseMap(['>.F.#']);

describe('parseMap', () => {
  it('reads rocks, fish and the start', () => {
    const world = parseMap(['#F.', '.v.']);
    expect(world).toMatchObject({ width: 3, height: 2, fish: [{ x: 1, y: 0 }], start: { x: 1, y: 1, dir: 2 } });
    expect([...world.rocks]).toEqual(['0,0']);
  });

  it('rejects broken maps', () => {
    expect(() => parseMap(['..', '.'])).toThrow();
    expect(() => parseMap(['..'])).toThrow();
    expect(() => parseMap(['>>'])).toThrow();
    expect(() => parseMap(['>x'])).toThrow();
  });
});

describe('simulate', () => {
  it('moves, eats fish on the way and grows the body by one per fish', () => {
    const trace = simulate(corridor, 'move()\nmove()\nmove()');
    expect(trace.outcome).toEqual({ kind: 'success' });
    const end = trace.steps.at(-1)!;
    expect(end).toMatchObject({ line: null, x: 3, y: 0, eaten: [true] });
    expect(end.body).toEqual([
      { x: 2, y: 0 },
      { x: 1, y: 0 },
    ]);
    expect(trace.steps.map((s) => s.line)).toEqual([1, 2, 3, null]);
  });

  it('shows the state before each line runs', () => {
    const trace = simulate(corridor, 'move()\nturn_left()');
    expect(trace.steps.map((s) => [s.line, s.x, s.dir])).toEqual([
      [1, 0, 1],
      [2, 1, 1],
      [null, 1, 0],
    ]);
  });

  it('crashes into rocks and the edge, in the line of the move', () => {
    expect(simulate(corridor, 'move()\nmove()\nmove()\nmove()').outcome).toEqual({ kind: 'crash', line: 4 });
    expect(simulate(corridor, 'turn_left()\nmove()').outcome).toEqual({ kind: 'crash', line: 2 });
    expect(simulate(corridor, 'turn_right()\nturn_right()\nmove()').outcome).toEqual({ kind: 'crash', line: 3 });
  });

  it('senses walls and fish right ahead', () => {
    const trace = simulate(corridor, 'a = fish_ahead()\nmove()\nb = fish_ahead()\nc = wall_ahead()\nmove()\nmove()\nd = wall_ahead()');
    expect(Object.fromEntries(trace.steps.at(-1)!.vars)).toEqual({ a: 'False', b: 'True', c: 'False', d: 'True' });
  });

  it('counts fish left when the program ends early', () => {
    expect(simulate(parseMap(['>F.F']), 'move()').outcome).toEqual({ kind: 'missed', left: 1 });
  });

  it('detects an endless loop as soon as a state repeats', () => {
    const trace = simulate(corridor, 'while True:\n    turn_left()');
    expect(trace.outcome).toEqual({ kind: 'loop', line: 1 });
    // Four turns bring the hydra back: a few steps, not MAX_STEPS.
    expect(trace.steps.length).toBeLessThan(12);
    expect(simulate(corridor, 'while not wall_ahead():\n    pass').outcome).toEqual({ kind: 'loop', line: 1 });
  });

  it('does not mistake a counting loop for an endless one', () => {
    expect(simulate(corridor, 'for i in range(8):\n    turn_left()').outcome).toEqual({ kind: 'missed', left: 1 });
  });

  it('stops a loop that never repeats exactly after MAX_STEPS', () => {
    const trace = simulate(corridor, 'n = 0\nwhile True:\n    n += 1');
    expect(trace.outcome.kind).toBe('loop');
    expect(trace.steps).toHaveLength(MAX_STEPS);
  });

  it('turns Python errors into an error outcome', () => {
    expect(simulate(corridor, 'move()\nswim()').outcome).toMatchObject({ kind: 'error', line: 2, message: expect.stringContaining('NameError') });
    expect(simulate(corridor, 'move(1)').outcome).toMatchObject({ kind: 'error', line: 1 });
    expect(simulate(corridor, 'move(').outcome).toMatchObject({ kind: 'error', line: 1 });
  });

  it('is deterministic', () => {
    const source = 'for i in range(3):\n    move()';
    expect(simulate(corridor, source)).toEqual(simulate(corridor, source));
  });
});
