import { describe, expect, it } from 'vitest';
import { parseHuntMap, simulateHunt } from './hunt.ts';

const run = (map: string[], source: string) => simulateHunt(parseHuntMap(map), source);

describe('parseHuntMap', () => {
  it('reads rocks, gold, the start and each hydra as a head with a body from the neck to the tail', () => {
    const world = parseHuntMap(['@.#G', 'Hoo.', '..o.']);
    expect(world).toMatchObject({ width: 4, height: 3, start: { x: 0, y: 0 }, gold: [{ x: 3, y: 0 }] });
    expect(world.hydras).toEqual([
      {
        head: { x: 0, y: 1 },
        body: [
          { x: 1, y: 1 },
          { x: 2, y: 1 },
          { x: 2, y: 2 },
        ],
      },
    ]);
    expect([...world.rocks]).toEqual(['2,0']);
  });

  it('rejects bad maps', () => {
    expect(() => parseHuntMap(['...'])).toThrow('no start');
    expect(() => parseHuntMap(['@@'])).toThrow('two starts');
    expect(() => parseHuntMap(['@x'])).toThrow('unknown');
    expect(() => parseHuntMap(['@.', '.'])).toThrow('length');
    expect(() => parseHuntMap(['@H'])).toThrow('no body');
    expect(() => parseHuntMap(['@o'])).toThrow('belongs to no hydra');
    expect(() => parseHuntMap(['oHo', '@..'])).toThrow('forks');
  });
});

describe('simulateHunt', () => {
  it('walks in all four directions and picks up gold on the way', () => {
    const trace = run(['...', '.@G', '...'], 'move_north()\nmove_east()\nmove_south()\nmove_south()\nmove_west()');
    expect(trace.outcome).toEqual({ kind: 'success' });
    expect(trace.steps.map((s) => [s.x, s.y])).toEqual([
      [1, 1],
      [1, 0],
      [2, 0],
      [2, 1],
      [2, 2],
      [1, 2],
    ]);
    expect(trace.steps.map((s) => s.taken[0])).toEqual([false, false, false, true, true, true]);
  });

  it('slays a hydra with one blow on any cell of its body; then its head is harmless', () => {
    const trace = run(['@ooH'], 'move_east()\nattack()\nmove_east()\nmove_east()');
    expect(trace.steps.map((s) => s.slain[0])).toEqual([false, false, true, true, true]);
    expect(trace.steps.map((s) => s.action)).toEqual([null, 'move', 'attack', 'move', 'move']);
    expect(trace.outcome).toEqual({ kind: 'success' });
  });

  it('gets the warrior eaten for stepping onto a living head', () => {
    const trace = run(['@oH'], 'move_east()\nmove_east()');
    expect(trace.outcome).toEqual({ kind: 'eaten', line: 2 });
    expect(trace.steps.at(-1)).toMatchObject({ x: 2, y: 0, line: 2 });
  });

  it('crashes into rocks and the edge', () => {
    expect(run(['@#'], 'move_east()').outcome).toEqual({ kind: 'crash', line: 1 });
    expect(run(['@.'], 'move_west()').outcome).toEqual({ kind: 'crash', line: 1 });
  });

  it('stops an attack where there is no living hydra body', () => {
    const trace = run(['@oH'], 'attack()');
    expect(trace.outcome).toEqual({ kind: 'air', line: 1 });
    expect(trace.steps.at(-1)!.action).toBe('attack');
    expect(run(['@oH'], 'move_east()\nattack()\nattack()').outcome).toEqual({ kind: 'air', line: 3 });
  });

  it('tells whether the warrior is on a living body, and counts what is left', () => {
    expect(run(['@..oH'], 'while not body_here():\n    move_east()\nattack()').outcome).toEqual({ kind: 'success' });
    expect(run(['@oH', 'G..'], 'move_east()\nb = body_here()').steps.at(-1)!.vars).toEqual([['b', 'True']]);
    expect(run(['@oH', 'G..'], 'move_east()').outcome).toEqual({ kind: 'missed', hydras: 1, gold: 1 });
  });

  it('notices endless loops and Python errors', () => {
    expect(run(['@oH'], 'while True:\n    pass').outcome.kind).toBe('loop');
    expect(run(['@oH'], 'attak()').outcome).toMatchObject({ kind: 'error', line: 1, message: expect.stringContaining('NameError') });
  });
});
