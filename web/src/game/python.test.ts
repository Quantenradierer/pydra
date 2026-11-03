import { describe, expect, it } from 'vitest';
import { Interpreter, parse, PyError, repr, type Builtin, type Value } from './python.ts';

/** Runs a program; returns the lines it paused on, the variables at the end and printed values. */
function run(source: string) {
  const printed: Value[] = [];
  const print: Builtin = { kind: 'builtin', name: 'print', arity: 1, call: ([v]) => (printed.push(v!), null) };
  const interpreter = new Interpreter([print]);
  const lines = [...interpreter.run(parse(source))].map((p) => p.line);
  return { lines, vars: Object.fromEntries(interpreter.variables()), printed: printed.map(repr) };
}

function error(source: string): PyError {
  try {
    run(source);
  } catch (e) {
    if (e instanceof PyError) return e;
    throw e;
  }
  throw new Error('no error');
}

describe('python subset', () => {
  it('evaluates arithmetic like Python (precedence, floor division, modulo of negatives)', () => {
    expect(run('a = 2 + 3 * 4\nb = (2 + 3) * 4\nc = -7 // 2\nd = -7 % 3\ne = 7 % -3\nf = 10 - 2 - 3').vars).toEqual({
      a: 14,
      b: 20,
      c: -4,
      d: 2,
      e: -2,
      f: 5,
    });
  });

  it('compares and combines with not/and/or, returning operands like Python', () => {
    const { printed } = run('print(1 < 2)\nprint(not 0)\nprint(0 or 5)\nprint(3 and 0)\nprint(True + 1)\nprint(2 == 2 and 3 != 4)');
    expect(printed).toEqual(['True', 'True', '5', '0', '2', 'True']);
  });

  it('short-circuits: the right side of and/or is not evaluated when not needed', () => {
    expect(run('x = False and undefined_name\ny = True or undefined_name').vars).toEqual({ x: false, y: true });
  });

  it('pauses before each statement and at every loop or branch check, in order', () => {
    const source = 'n = 0\nwhile n < 2:\n    n += 1\nif n == 1:\n    pass\nelif n == 2:\n    n -= 5\nelse:\n    pass';
    expect(run(source).lines).toEqual([1, 2, 3, 2, 3, 2, 4, 6, 7]);
    expect(run(source).vars).toEqual({ n: -3 });
  });

  it('runs for over range with one or two arguments, and not at all over an empty range', () => {
    const { printed, lines } = run('for i in range(3):\n    print(i)\nfor j in range(2, 4):\n    print(j)\nfor k in range(-1):\n    print(k)');
    expect(printed).toEqual(['0', '1', '2', '2', '3']);
    expect(lines).toEqual([1, 2, 1, 2, 1, 2, 3, 4, 3, 4, 5]);
  });

  it('calls functions with parameters and return values; the body pauses inside the call', () => {
    const source = 'def double(x):\n    y = x * 2\n    return y\n\nz = double(4)\nprint(double(z))\nprint(print(1))';
    const result = run(source);
    expect(result.vars).toEqual({ z: 8 });
    expect(result.printed).toEqual(['16', '1', 'None']);
    expect(result.lines.slice(0, 4)).toEqual([1, 5, 2, 3]);
  });

  it('keeps local variables inside the function, like Python', () => {
    expect(error('def f():\n    secret = 1\n\nf()\nprint(secret)')).toMatchObject({ type: 'NameError', line: 5 });
    expect(error('n = 1\ndef f():\n    n += 1\n\nf()')).toMatchObject({ type: 'UnboundLocalError', line: 3 });
    // Reading a global inside a function is fine.
    expect(run('n = 1\ndef f():\n    return n + 1\n\nm = f()').vars).toEqual({ n: 1, m: 2 });
  });

  it('reports runtime errors with their line', () => {
    expect(error('x = 1\nturn_rigth()')).toMatchObject({ type: 'NameError', line: 2 });
    expect(error('x = 5 // 0')).toMatchObject({ type: 'ZeroDivisionError', line: 1 });
    expect(error('def f(a):\n    pass\n\nf()')).toMatchObject({ type: 'TypeError', line: 4 });
    expect(error('for i in 3:\n    pass')).toMatchObject({ type: 'TypeError', line: 1 });
    expect(error('def f():\n    return f()\n\nf()')).toMatchObject({ type: 'RecursionError' });
  });

  it('rejects anything outside the subset as a SyntaxError', () => {
    for (const source of [
      'x = "text"',
      'x = 1.5',
      'if x:\nmove()',
      'move()\n    move()',
      'else:\n    pass',
      'x = 1 < 2 < 3',
      'x = [1, 2]',
      'move(',
      'return 1',
      'x\t= 1',
    ]) {
      expect(() => run(source), source).toThrow(PyError);
    }
  });

  it('ignores comments and blank lines', () => {
    expect(run('# start\n\nx = 1  # one\n\n').lines).toEqual([3]);
  });

  it('fingerprints the hidden loop position, so the same variables in another iteration differ', () => {
    const interpreter = new Interpreter([]);
    const prints = new Set<string>();
    for (const pause of interpreter.run(parse('for i in range(3):\n    j = 0'))) prints.add(`${pause.line} ${interpreter.fingerprint()}`);
    expect(prints.size).toBe(6);
  });
});
