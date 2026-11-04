import { describe, expect, it } from 'vitest';
import { Interpreter, parse, PyError, repr, str, type Builtin, type Value } from './python.ts';

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
      'x = 1.5',
      'x = "a\\n"',
      "x = 'open",
      'break',
      'while True:\n    def f():\n        break',
      'def f(a=1, b):\n    pass',
      'if x:\nmove()',
      'move()\n    move()',
      'else:\n    pass',
      'x = 1 < 2 < 3',
      'x = {1: 2}',
      'move(',
      'return 1',
      'x\t= 1',
    ]) {
      expect(() => run(source), source).toThrow(PyError);
    }
  });

  it('has strings: literals in either quotes, ==, +, len, indexing and looping over the letters', () => {
    const { printed } = run(
      "s = 'ab' + \"c\"\nprint(s)\nprint(len(s))\nprint(s[0])\nprint(s[-1])\nprint(s == 'abc')\nprint('R' == 'r')\nfor c in s:\n    print(c)\nprint('')\nprint(not '')\nprint(\"it's\")",
    );
    expect(printed).toEqual(["'abc'", '3', "'a'", "'c'", 'True', 'False', "'a'", "'b'", "'c'", "''", 'True', '"it\'s"']);
  });

  it('has lists: literals, len, indexing from the front and the back, + and ==, looping over the items', () => {
    const { printed, vars } = run('xs = [3, 1, 2]\nprint(xs[0])\nprint(xs[-1])\nprint(len(xs))\nprint(xs + [4])\nprint(xs == [3, 1, 2])\nprint([] or [0])\ntotal = 0\nfor x in xs:\n    total += x\nnames = [\'a\', [1]]');
    expect(printed).toEqual(['3', '2', '3', '[3, 1, 2, 4]', 'True', '[0]']);
    expect(vars).toEqual({ xs: [3, 1, 2], total: 6, x: 2, names: ['a', [1]] });
    expect(repr(['a', [1, true]])).toBe("['a', [1, True]]");
  });

  it('reports bad indexing like Python', () => {
    expect(error('xs = [1, 2]\nx = xs[2]')).toMatchObject({ type: 'IndexError', line: 2, message: 'IndexError: list index out of range' });
    expect(error("s = 'ab'\nx = s[-3]")).toMatchObject({ type: 'IndexError', message: 'IndexError: string index out of range' });
    expect(error('x = 5[0]')).toMatchObject({ type: 'TypeError', message: "TypeError: 'int' object is not subscriptable" });
    expect(error("x = [1]['a']")).toMatchObject({ type: 'TypeError' });
    expect(error('x = len(5)')).toMatchObject({ type: 'TypeError', message: "TypeError: object of type 'int' has no len()" });
    expect(error('for i in 3:\n    pass')).toMatchObject({ message: "TypeError: 'int' object is not iterable" });
  });

  it('runs range with a step, also backwards, and refuses a step of 0', () => {
    const { printed } = run('for i in range(1, 8, 3):\n    print(i)\nfor i in range(3, 0, -1):\n    print(i)\nfor i in range(0, 3, -1):\n    print(i)');
    expect(printed).toEqual(['1', '4', '7', '3', '2', '1']);
    expect(error('x = 1\nfor i in range(0, 5, 0):\n    pass')).toMatchObject({ type: 'ValueError', line: 2 });
  });

  it('leaves the innermost loop with break and skips to its next pass with continue', () => {
    const source =
      'for i in range(3):\n    for j in range(5):\n        if j == 2:\n            break\n        print(j)\nn = 0\nwhile True:\n    n += 1\n    if n % 2 == 0:\n        continue\n    if n > 4:\n        break\n    print(n)';
    expect(run(source).printed).toEqual(['0', '1', '0', '1', '0', '1', '1', '3']);
    // break pauses on its own line; the loop variable keeps its last value.
    const loop = run('for i in range(5):\n    if i == 1:\n        break');
    expect(loop.lines).toEqual([1, 2, 1, 2, 3]);
    expect(loop.vars).toEqual({ i: 1 });
  });

  it('fills in default values, evaluated once when def runs', () => {
    const { printed } = run('n = 2\ndef go(a, b=n, c=1):\n    print(a + b + c)\n\nn = 100\ngo(1)\ngo(1, 10)\ngo(1, 10, 20)');
    expect(printed).toEqual(['4', '12', '31']);
    expect(error('def go(a, b=1):\n    pass\n\ngo()')).toMatchObject({ type: 'TypeError', line: 4 });
    expect(error('def go(a, b=1):\n    pass\n\ngo(1, 2, 3)')).toMatchObject({ type: 'TypeError' });
    expect(error('def go(n=steps):\n    pass')).toMatchObject({ type: 'NameError', line: 1 });
  });

  it('shows the running calls with their arguments and locals, and the call that just returned', () => {
    const interpreter = new Interpreter([]);
    const seen: string[] = [];
    for (const pause of interpreter.run(parse('def f(a, b=2):\n    c = a + b\n    return c\n\nx = f(1)\ny = 0'))) {
      const stack = interpreter.stack().map((s) => `${s.name}(${s.args.join(', ')}) ${s.vars.map(([k, v]) => `${k}=${repr(v)}`).join(' ')}`);
      const back = interpreter.takeReturn();
      seen.push(`${pause.line}: ${stack.join(' | ')}${back ? ` <- ${back.name} ${repr(back.value)}` : ''}`);
    }
    expect(seen).toEqual(['1: ', '5: ', '2: f(1) a=1 b=2', '3: f(1) a=1 b=2 c=3', '6:  <- f 3']);
    expect(interpreter.globalVariables()).toEqual([
      ['x', 3],
      ['y', 0],
    ]);
  });

  it('words argument errors like Python', () => {
    expect(error('def f(a, b):\n    pass\n\nf(1)').message).toBe("TypeError: f() missing 1 required positional argument: 'b'");
    expect(error('def f(a, b, c):\n    pass\n\nf()').message).toBe("TypeError: f() missing 3 required positional arguments: 'a', 'b' and 'c'");
    expect(error('def f(a):\n    pass\n\nf(1, 2)').message).toBe('TypeError: f() takes 1 positional argument but 2 were given');
    expect(error('def f():\n    pass\n\nf(1)').message).toBe('TypeError: f() takes 0 positional arguments but 1 was given');
    expect(error('def f(a, b=1):\n    pass\n\nf(1, 2, 3)').message).toBe('TypeError: f() takes from 1 to 2 positional arguments but 3 were given');
    expect(error('def f():\n    pass\n\nx = f + 1').message).toBe("TypeError: unsupported operand type(s) for +: 'function' and 'int'");
  });

  it('formats print output like str(): text without quotes', () => {
    expect([str('a b'), str(3), str(['a']), str(null)]).toEqual(['a b', '3', "['a']", 'None']);
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
