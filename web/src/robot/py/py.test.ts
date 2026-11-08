import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { RbError } from './errors.ts';
import { Program } from './interp.ts';
import { parse } from './parser.ts';
import golden from './golden.json';
import { GOLDEN } from './golden-snippets.ts';
import { ActionRequest, type Value } from './values.ts';

interface Result {
  out: string;
  error: string | null;
  line: number | null;
}

function runSnippet(code: string): Result {
  let out = '';
  try {
    const program = new Program(parse(code), { print: (t) => (out += t) });
    const r = program.runAll(2_000_000);
    if (r.kind === 'error') return { out, error: r.error.type, line: r.error.type === 'RecursionError' ? null : r.error.line };
    if (r.kind === 'budget') return { out, error: 'Budget', line: null };
    return { out, error: null, line: null };
  } catch (e) {
    if (e instanceof RbError) return { out, error: e.type, line: e.line };
    throw e;
  }
}

const expected = golden as Record<string, Result>;

describe('golden tests against CPython', () => {
  for (const [group, snippets] of Object.entries(GOLDEN)) {
    describe(group, () => {
      for (const code of snippets) {
        it(JSON.stringify(code).slice(0, 90), () => {
          const want = expected[code];
          expect(want, 'run `npm run golden -w web` to record this snippet').toBeDefined();
          expect(runSnippet(code)).toEqual(want);
        });
      }
    });
  }

  it('golden.json is what the CPython on this machine says (when python3 is installed)', () => {
    let fresh: Result[];
    try {
      const runner = new URL('../../../scripts/golden-runner.py', import.meta.url).pathname;
      fresh = JSON.parse(execFileSync('python3', ['-I', runner], { input: JSON.stringify(Object.values(GOLDEN).flat()), encoding: 'utf8' })) as Result[];
    } catch {
      return; // no python3 here: the recorded results are all we have
    }
    // Error lines can differ between Python versions for syntax errors; the rest must not.
    const all = Object.values(GOLDEN).flat();
    fresh.forEach((r, i) => expect({ ...r, line: r.error?.endsWith('SyntaxError') ? 0 : r.line, error: r.error }, all[i]).toEqual({ ...expected[all[i]!]!, line: expected[all[i]!]!.error?.endsWith('SyntaxError') ? 0 : expected[all[i]!]!.line }));
  });
});

describe('Program', () => {
  const host = (name: string, payload: unknown) => ({ kind: 'host' as const, name, call: () => new ActionRequest(payload) });

  it('pauses at an action in the middle of an expression and resumes with its result', () => {
    const p = new Program(parse('x = 1 + act()\nprint(x)'), { globals: { act: host('act', 'A') }, print: (t) => out.push(t) });
    const out: string[] = [];
    const first = p.runUntilAction(100);
    expect(first).toMatchObject({ kind: 'action', line: 1 });
    expect((first as { request: ActionRequest }).request.payload).toBe('A');
    expect(p.runUntilAction(100, 41)).toEqual({ kind: 'done' });
    expect(out).toEqual(['42\n']);
  });

  it('reports the line of each action', () => {
    const p = new Program(parse('act()\n\nif True:\n    act()'), { globals: { act: host('act', 1) } });
    expect(p.runUntilAction(100)).toMatchObject({ line: 1 });
    expect(p.runUntilAction(100)).toMatchObject({ line: 4 });
    expect(p.runUntilAction(100)).toEqual({ kind: 'done' });
  });

  it('stops a script that never acts after the step budget, with the line it was in', () => {
    const p = new Program(parse('x = 0\nwhile True:\n    x += 1'));
    expect(p.runUntilAction(1000)).toMatchObject({ kind: 'budget', line: expect.any(Number) });
    expect(p.done).toBe(true);
  });

  it('gives each tick a fresh budget', () => {
    const p = new Program(parse('for i in range(100):\n    act()'), { globals: { act: host('act', 0) } });
    for (let i = 0; i < 100; i++) expect(p.runUntilAction(50).kind).toBe('action');
    expect(p.runUntilAction(50)).toEqual({ kind: 'done' });
  });

  it('keeps state between pauses, including loops and calls', () => {
    const src = 'def twice(n):\n    act()\n    act()\n    return n * 2\ntotal = 0\nfor i in range(3):\n    total += twice(i)\nprint(total)';
    const out: string[] = [];
    const p = new Program(parse(src), { globals: { act: host('act', 0) }, print: (t) => out.push(t) });
    let n = 0;
    while (p.runUntilAction(100).kind === 'action') n++;
    expect(n).toBe(6);
    expect(out).toEqual(['6\n']);
  });

  it('reports errors with the line and a did-you-mean hint', () => {
    const p = new Program(parse('x = 1\nfire_laser()'), { globals: { fire: { kind: 'host', name: 'fire', call: () => null } } });
    const r = p.runUntilAction(100);
    expect(r.kind).toBe('error');
    const e = (r as { error: RbError }).error;
    expect([e.type, e.code, e.line, e.params.suggestion]).toEqual(['NameError', 'unknown-name', 2, 'fire()']);
  });

  it('honours the recursion limit without overflowing the JS stack', () => {
    const p = new Program(parse('def f(n):\n    return f(n + 1)\nf(0)'));
    expect((p.runAll() as { error: RbError }).error.type).toBe('RecursionError');
  });

  it('can be handed values (host objects with methods)', () => {
    const calls: Value[][] = [];
    const obj = { kind: 'object' as const, name: 'gun', names: () => ['shoot'], get: (a: string) => (a === 'shoot' ? { kind: 'host' as const, name: 'shoot', call: (args: Value[]) => (calls.push(args), null) } : undefined) };
    const p = new Program(parse('gun.shoot(3, "x")\ngun.reload()'), { globals: { gun: obj } });
    const r = p.runAll();
    expect(calls).toEqual([[3, 'x']]);
    expect((r as { error: RbError }).error).toMatchObject({ type: 'AttributeError', line: 2, params: { name: 'reload' } });
  });
});
