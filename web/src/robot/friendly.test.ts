import { describe, expect, it } from 'vitest';
import { friendlyError } from './friendly.ts';
import { checkProgram } from './py/check.ts';
import { RbError } from './py/errors.ts';
import { Program } from './py/interp.ts';
import { parse } from './py/parser.ts';

function errorOf(src: string, lang: 'de' | 'en' = 'en'): { line: number; text: string; error: RbError } {
  try {
    const r = new Program(parse(src), { globals: { fire: { kind: 'host', name: 'fire', call: () => null } } }).runAll();
    if (r.kind !== 'error') throw new Error('no error');
    return { line: r.error.line, text: friendlyError(r.error, lang), error: r.error };
  } catch (e) {
    if (!(e instanceof RbError)) throw e;
    return { line: e.line, text: friendlyError(e, lang), error: e };
  }
}

describe('friendly errors', () => {
  it('points at the line and suggests a name', () => {
    const e = errorOf('x = 1\nfire_laser()');
    expect(e.line).toBe(2);
    expect(e.text).toBe('Your robot does not know "fire_laser". Did you mean fire()?');
    expect(errorOf('foward()', 'de').text).toMatch(/kennt „foward“ nicht/);
  });

  it('explains common beginner mistakes', () => {
    expect(errorOf('if 1 == 1\n    pass').text).toBe('After "if" the colon (:) at the end of the line is missing.');
    expect(errorOf('if x = 1:\n    pass').text).toMatch(/==/);
    expect(errorOf('print("a" + 1)').text).toMatch(/str\(\)/);
    expect(errorOf('x = 1 / 0').text).toBe('Dividing by 0 is not possible.');
    expect(errorOf('for i in range(3):\nprint(i)').text).toMatch(/must be indented/);
    expect(errorOf('x = "abc').text).toMatch(/closing quotation mark/);
    expect(errorOf('x = [1, 2][5]').text).toMatch(/does not exist/);
  });

  it('names what is not part of Robot Battler', () => {
    for (const src of ['import os', 'try:\n    pass\nexcept:\n    pass', 'f = lambda: 1', 'class A:\n    pass', 'with x:\n    pass']) {
      expect(errorOf(src).error.code).toBe('unsupported');
    }
    expect(errorOf('import os').text).toBe('"import" is not available in Robot Battler.');
    expect(errorOf('try:\n    pass', 'de').text).toBe('„try / except“ gibt es in Robot Battler nicht.');
  });

  it('keeps the original Python error for the curious', () => {
    expect(errorOf('x = 1 / 0').error.message).toBe('ZeroDivisionError: division by zero');
  });

  it('falls back to the plain message for what has no friendly text', () => {
    const e = errorOf('print(1)\nx = "a"[5:"b"]');
    expect(e.text).toContain('TypeError');
  });
});

describe('checkProgram', () => {
  const env = { known: ['fire', 'forward', 'print'], notEquipped: new Map([['move_north', { kind: 'move-absolute', dir: 'north' }]]) };

  it('finds unknown names anywhere, with a hint', () => {
    const e = checkProgram(parse('forward()\nif False:\n    foward()'), env)!;
    expect([e.code, e.line, e.params.suggestion]).toEqual(['unknown-name', 3, 'forward()']);
  });

  it('knows names the script defines itself', () => {
    expect(checkProgram(parse('def attack(n):\n    for i in range(n):\n        fire()\nsteps = 2\nattack(steps)\nfor k, v in [(1, 2)]:\n    print(k + v)'), env)).toBeUndefined();
  });

  it('reports parts that are not equipped', () => {
    const e = checkProgram(parse('move_north()'), env)!;
    expect([e.code, e.params.kind]).toEqual(['not-equipped', 'move-absolute']);
  });
});
