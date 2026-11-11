import { describe, expect, it } from 'vitest';
import { START_BUILD } from './build.ts';
import { runBattle, TRACE_CAP } from './battle.ts';
import type { LayoutSpec } from './layout.ts';
import { Program } from './py/interp.ts';
import { parse } from './py/parser.ts';
import type { TraceEvent } from './py/trace.ts';

const traceOf = (src: string): TraceEvent[] => {
  const events: TraceEvent[] = [];
  new Program(parse(src), { trace: (e) => events.push(e) }).runAll();
  return events;
};
const layout = (map: string[], enemies: LayoutSpec['enemies'] = [{ hp: 1 }], seed = 1): LayoutSpec => ({ map, enemies, seed });
const run = (script: string, map = ['>..D'], enemies?: LayoutSpec['enemies']) => runBattle({ build: START_BUILD, script, layout: layout(map, enemies), trace: true });

describe('interpreter trace', () => {
  it('records statements, assignments and the branch taken', () => {
    expect(traceOf('x = 2\nif x > 3:\n    y = 1\nelse:\n    y = 5')).toEqual([
      { k: 'line', line: 1 },
      { k: 'set', line: 1, name: 'x', value: '2', depth: 0 },
      { k: 'line', line: 2 },
      { k: 'branch', line: 2, kind: 'if', taken: false, hasElse: true },
      { k: 'line', line: 5 },
      { k: 'set', line: 5, name: 'y', value: '5', depth: 0 },
    ]);
  });

  it('records loop passes with the loop variable, and the end of a for loop', () => {
    const t = traceOf('for i in range(2):\n    pass');
    expect(t.filter((e) => e.k === 'branch')).toEqual([
      { k: 'branch', line: 1, kind: 'for', taken: true, n: 1, value: '0' },
      { k: 'branch', line: 1, kind: 'for', taken: true, n: 2, value: '1' },
      { k: 'branch', line: 1, kind: 'for', taken: false },
    ]);
  });

  it('records while tests with the pass number', () => {
    const t = traceOf('n = 0\nwhile n < 2:\n    n += 1');
    expect(t.filter((e) => e.k === 'branch').map((e) => e.k === 'branch' && [e.taken, e.n])).toEqual([[true, 1], [true, 2], [false, 3]]);
    expect(t.filter((e) => e.k === 'set').map((e) => e.k === 'set' && e.value)).toEqual(['0', '1', '2']);
  });

  it('records user functions entering and leaving with arguments, depth and value', () => {
    const t = traceOf('def twice(a):\n    b = a * 2\n    return b\nr = twice(4)');
    expect(t).toContainEqual({ k: 'enter', line: 4, fn: 'twice', args: ['a=4'], depth: 1 });
    expect(t).toContainEqual({ k: 'set', line: 2, name: 'b', value: '8', depth: 1 });
    expect(t).toContainEqual({ k: 'leave', line: 4, fn: 'twice', value: '8', depth: 1 });
    expect(t.at(-1)).toEqual({ k: 'set', line: 4, name: 'r', value: '8', depth: 0 });
    // The function itself is defined silently.
    expect(t.some((e) => e.k === 'set' && e.name === 'twice')).toBe(false);
  });

  it('costs nothing without a trace hook and does not change the result', () => {
    const src = 'a = 0\nfor i in range(5):\n    a += i';
    const plain = new Program(parse(src));
    plain.runAll();
    const traced = new Program(parse(src), { trace: () => {} });
    traced.runAll();
    expect(traced.variables()).toEqual(plain.variables());
  });
});

describe('battle trace', () => {
  it('puts sensors, print and the action of a tick into that tick, with the call and its result', () => {
    const r = run('d = distance()\nprint("hi")\nforward()\nfire()', ['>..D']);
    const t1 = r.frames[1]!.trace!;
    expect(t1.filter((e) => e.k === 'call')).toEqual([
      { k: 'call', line: 1, fn: 'distance', args: [], kind: 'sensor', result: '3' },
      { k: 'call', line: 2, fn: 'print', args: ["'hi'"], kind: 'print', result: 'None' },
      { k: 'call', line: 3, fn: 'forward', args: [], kind: 'action' },
    ]);
    expect(t1).toContainEqual({ k: 'set', line: 1, name: 'd', value: '3', depth: 0 });
    // Tick 2 starts at the next line, the first tick's lines are not repeated.
    expect(r.frames[2]!.trace).toEqual([{ k: 'line', line: 4 }, { k: 'call', line: 4, fn: 'fire', args: [], kind: 'action' }]);
  });

  it('a multi-tick action leaves the following ticks without script events', () => {
    const r = run('forward(2)\nfire()');
    expect(r.frames[1]!.trace!.length).toBeGreaterThan(0);
    expect(r.frames[2]!.trace).toEqual([]);
    expect(r.frames[3]!.trace).toContainEqual({ k: 'line', line: 2 });
  });

  it('shows the branch of an if/else and the loop passes of a while', () => {
    const r = run('while alive():\n    if distance() < 2:\n        fire()\n    else:\n        forward()', ['>..D']);
    const all = r.frames.flatMap((f) => f.trace ?? []);
    const branches = all.filter((e) => e.k === 'branch' && e.kind === 'if').map((e) => e.k === 'branch' && e.taken);
    expect(branches.slice(0, 3)).toEqual([false, false, true]);
    expect(all.filter((e) => e.k === 'branch' && e.kind === 'while').length).toBeGreaterThanOrEqual(3);
    expect(r.outcome).toBe('win');
  });

  it('is deterministic and identical to an untraced run apart from the trace', () => {
    const script = 'for i in range(3):\n    forward()\nfire()';
    const a = run(script, ['>...D']);
    expect(run(script, ['>...D'])).toEqual(a);
    const plain = runBattle({ build: START_BUILD, script, layout: layout(['>...D']) });
    expect(a.frames.map(({ trace: _t, traces: _ts, ...f }) => f)).toEqual(plain.frames);
    expect(plain.frames[1]!.trace).toBeUndefined();
  });

  it('keeps the events after the winning action (print) in the last frame', () => {
    const r = run('forward()\nfire()\nprint("done")', ['>.D']);
    expect(r.outcome).toBe('win');
    expect(r.frames.at(-1)!.after).toContainEqual(expect.objectContaining({ k: 'call', fn: 'print', kind: 'print' }));
    expect(r.frames.at(-1)!.trace).not.toContainEqual(expect.objectContaining({ fn: 'print' }));
  });

  it('cuts a tick that runs very long without acting', () => {
    const r = run('n = 0\nwhile True:\n    n += 1');
    expect(r.reason).toBe('budget');
    const t = r.frames.at(-1)!.trace!;
    expect(t.length).toBeLessThanOrEqual(TRACE_CAP + 1);
    expect(t.at(-1)).toEqual({ k: 'cut' });
  });

  it('calls of the player\'s own functions show enter / leave around the line that called', () => {
    const r = run('def go():\n    forward()\n    forward()\ngo()\nfire()', ['>..D']);
    expect(r.frames[1]!.trace!.map((e) => (e.k === 'line' ? `line ${e.line}` : e.k === 'enter' ? `enter ${e.fn}` : e.k === 'call' ? `call ${e.fn}` : e.k))).toEqual(['line 1', 'line 4', 'enter go', 'line 2', 'call forward']);
    const second = r.frames[2]!.trace!;
    expect(second).toEqual([{ k: 'line', line: 3 }, { k: 'call', line: 3, fn: 'forward', args: [], kind: 'action' }]);
    const third = r.frames[3]!.trace!;
    expect(third[0]).toEqual({ k: 'leave', line: 4, fn: 'go', value: 'None', depth: 1 });
  });
});
