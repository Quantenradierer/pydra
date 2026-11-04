import { describe, expect, it } from 'vitest';
import { simulateHeads, type HeadsLevel } from './heads.ts';

const level = (goal: HeadsLevel['goal']): HeadsLevel => ({
  id: 'test',
  title: { de: '', en: '' },
  intro: { de: '', en: '' },
  code: '___',
  choices: [],
  answerIndex: 0,
  goal,
});

describe('heads simulation', () => {
  it('grows a head per running call, with its arguments and locals, and pulls it back on return', () => {
    const source = 'def double(x):\n    y = x * 2\n    return y\n\ndef quad(x):\n    return double(double(x))\n\nr = quad(3)';
    const { steps, outcome } = simulateHeads(level({ vars: { r: '12' } }), source);
    expect(outcome).toEqual({ kind: 'success' });
    expect(steps.map((s) => s.heads.map((h) => h.label))).toEqual([
      [],
      [],
      [],
      ['quad(3)'],
      ['quad(3)', 'double(3)'],
      ['quad(3)', 'double(3)'],
      ['quad(3)', 'double(6)'],
      ['quad(3)', 'double(6)'],
      [],
    ]);
    // Locals sit on their own head; the body (globals) never shows them.
    expect(steps[5]!.heads[1]!.vars).toEqual([
      ['x', '3'],
      ['y', '6'],
    ]);
    expect(steps.at(-1)!.globals).toEqual([['r', '12']]);
    // A finished call hands its value down on the next step.
    expect(steps[6]!.returned).toEqual({ name: 'double', value: '6' });
    expect(steps.at(-1)!.returned).toEqual({ name: 'quad', value: '12' });
    expect(steps[5]!.returned).toBeUndefined();
  });

  it('records print output like Python (text without quotes, several values with spaces)', () => {
    const { steps, outcome } = simulateHeads(level({ output: ['Hi 3', "['a']", 'None'] }), "print('Hi', 3)\nprint(['a'])\nprint(print())");
    expect(steps.at(-1)!.output).toEqual(['Hi 3', "['a']", '', 'None']);
    expect(outcome).toEqual({ kind: 'output' });
  });

  it('tells a wrong value and a missing variable apart', () => {
    expect(simulateHeads(level({ vars: { r: '8' } }), 'r = 16').outcome).toEqual({ kind: 'wrong', name: 'r', got: '16', want: '8' });
    expect(simulateHeads(level({ vars: { r: '8' } }), 'x = 8').outcome).toEqual({ kind: 'wrong', name: 'r', got: null, want: '8' });
    expect(simulateHeads(level({ vars: { r: "'8'" } }), "r = '8'").outcome).toEqual({ kind: 'success' });
  });

  it('ends endless recursion with a RecursionError, the heads still up on the last step', () => {
    const { steps, outcome } = simulateHeads(level({ output: [] }), 'def f(n):\n    f(n + 1)\n\nf(0)');
    expect(outcome).toMatchObject({ kind: 'error', line: 2, message: 'RecursionError: maximum recursion depth exceeded' });
    expect(steps.at(-1)!.heads.length).toBeGreaterThan(20);
  });

  it('stops a program that would run forever', () => {
    expect(simulateHeads(level({ output: [] }), 'while True:\n    pass').outcome).toEqual({ kind: 'loop', line: 1 });
  });
});
