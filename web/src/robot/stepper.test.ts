import { describe, expect, it } from 'vitest';
import { START_BUILD } from './build.ts';
import { runBattle } from './battle.ts';
import type { LayoutSpec } from './layout.ts';
import { buildBeats, hasTrace, idleRunEnd, isIdleBeat, nextBeat, stackNames, stateAt } from './stepper.ts';

const fight = (script: string, map = ['>..D']) => {
  const layout: LayoutSpec = { map, enemies: [{ hp: 1 }], seed: 1 };
  return runBattle({ build: START_BUILD, script, layout, trace: true });
};

describe('beats', () => {
  const r = fight('x = distance()\nforward()\nif x > 1:\n    fire()');

  it('are a start, then one beat per executed line and one resolve per tick', () => {
    const beats = buildBeats(r.frames);
    expect(beats.map((b) => `${b.tick}:${b.kind}:${b.line}`)).toEqual(['0:start:null', '1:line:1', '1:line:2', '1:resolve:2', '2:line:3', '2:line:4', '2:resolve:4']);
    expect(beats[1]!.events.map((e) => e.k)).toEqual(['line', 'call', 'set']);
  });

  it('steps forward by line and by tick', () => {
    const beats = buildBeats(r.frames);
    expect(nextBeat(beats, 0, 'line')).toBe(1);
    expect(nextBeat(beats, 0, 'tick')).toBe(3);
    expect(nextBeat(beats, 3, 'tick')).toBe(6);
    expect(nextBeat(beats, 6, 'line')).toBe(6);
  });

  it('a multi-tick action gives resolve beats without lines; a result assigned later gets its own line beat', () => {
    const m = fight('forward(2)\nfire()');
    expect(buildBeats(m.frames).map((b) => `${b.tick}:${b.kind}`)).toEqual(['0:start', '1:line', '1:resolve', '2:resolve', '3:line', '3:resolve']);
  });

  it('puts a line that ran after the winning action behind the last resolve beat', () => {
    const w = fight('forward()\nfire()\nprint("done")', ['>.D']);
    const beats = buildBeats(w.frames);
    expect(beats.at(-2)).toMatchObject({ kind: 'resolve', tick: 2 });
    expect(beats.at(-1)).toMatchObject({ kind: 'line', line: 3, after: true, tick: 2 });
  });

  it('knows whether a replay has a trace', () => {
    expect(hasTrace(r.frames)).toBe(true);
  });
});

describe('state at a beat', () => {
  it('collects globals and per-line hints (sensor result, branch, assignment)', () => {
    const r = fight('x = distance()\nforward()\nif x > 1:\n    fire()');
    const beats = buildBeats(r.frames);
    expect(stateAt(beats, 0).globals).toEqual([]);
    const s1 = stateAt(beats, 1);
    expect(s1.globals).toEqual([['x', '3']]);
    expect(s1.hints.get(1)).toEqual({ call: 'distance() → 3', set: 'x = 3' });
    const s2 = stateAt(beats, 4);
    expect(s2.hints.get(3)?.branch).toEqual({ kind: 'if', taken: true, hasElse: false });
    expect(s2.hints.get(2)?.call).toBe('forward()');
  });

  it('shows loop pass and loop variable, and later values replace earlier ones', () => {
    const r = fight('for i in range(3):\n    forward()\nfire()', ['>...D']);
    const beats = buildBeats(r.frames);
    const end = stateAt(beats, beats.length - 1);
    expect(end.globals).toEqual([['i', '2']]);
    expect(end.hints.get(1)?.branch).toEqual({ kind: 'for', taken: false });
    const mid = stateAt(beats, beats.findIndex((b) => b.tick === 2 && b.kind === 'line'));
    expect(mid.hints.get(1)?.branch).toMatchObject({ kind: 'for', taken: true, n: 2, value: '1' });
  });

  it('tracks the call stack with arguments and locals, and pops it on return', () => {
    const r = fight('def go(n):\n    steps = n + 1\n    forward(steps)\ngo(1)\nfire()', ['>...D']);
    const beats = buildBeats(r.frames);
    const inside = beats.findIndex((b) => b.line === 3);
    const s = stateAt(beats, inside);
    expect(s.stack).toHaveLength(1);
    expect(stackNames(s)).toEqual(['go(1)']);
    expect(s.stack[0]).toMatchObject({ fn: 'go', callLine: 4, vars: [['n', '1'], ['steps', '2']] });
    expect(s.globals).toEqual([]);
    // After the call returned (second beat of tick 3: back on the call line) the stack is empty again.
    const back = beats.findIndex((b) => b.tick === 3 && b.kind === 'line');
    expect(beats[back]!.line).toBe(4);
    expect(stateAt(beats, back).stack).toEqual([]);
  });
});

describe('idle rounds (the script ended and nothing happens)', () => {
  const r = fight('forward()', ['>...D']);
  const beats = buildBeats(r.frames);

  it('are resolve beats with no line, no events, no speech', () => {
    expect(beats.filter((_, i) => isIdleBeat(beats, r.frames, i)).length).toBeGreaterThan(100);
    expect(isIdleBeat(beats, r.frames, 0)).toBe(false);
    expect(isIdleBeat(beats, r.frames, 1)).toBe(false); // the forward() line
    expect(isIdleBeat(beats, r.frames, 2)).toBe(false); // its move
  });

  it('a run of them ends at its last beat, so the playback jumps over the waiting', () => {
    const first = beats.findIndex((_, i) => isIdleBeat(beats, r.frames, i));
    expect(first).toBeGreaterThan(0);
    expect(idleRunEnd(beats, r.frames, first)).toBe(beats.length - 1);
    expect(idleRunEnd(beats, r.frames, 1)).toBe(1);
  });
});
