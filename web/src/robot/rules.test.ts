import { describe, expect, it } from 'vitest';
import { START_BUILD } from './build.ts';
import { runBattle } from './battle.ts';
import { bareCode, judge, repeatsNumber, usesWord } from './fight.ts';
import { World } from './engine.ts';
import { parseMap } from './layout.ts';

describe('code rules', () => {
  it('finds words outside comments and strings', () => {
    expect(usesWord('while True:\n    break', 'while')).toBe(true);
    expect(usesWord('while True:\n    break', 'while True')).toBe(true);
    expect(usesWord('x = 1  # for fun\nprint("for")', 'for')).toBe(false);
    expect(usesWord('format = 1', 'for')).toBe(false);
    expect(bareCode('print("a#b") # c').trim()).toBe('print("")');
  });
  it('sees repeated numbers', () => {
    expect(repeatsNumber('forward(4)\nfire(3)')).toBe(false);
    expect(repeatsNumber('fire(3)\nwait()\nfire(3)')).toBe(true);
    expect(repeatsNumber('x = 2.5\ny = 25')).toBe(false);
    expect(repeatsNumber('print("3")\nfire(3)')).toBe(false);
  });
});

describe('regeneration', () => {
  it('heals every few ticks up to the maximum', () => {
    const { tiles } = parseMap(['^...', '....']);
    const w = new World({ tiles, seed: 1, robots: [{ id: 'player', team: 'player', pos: { x: 0, y: 0 }, facing: 'E', hp: 5 }, { id: 'enemy1', team: 'enemy', pos: { x: 3, y: 1 }, facing: 'W', hp: 3, regen: { every: 2, amount: 1 } }] });
    w.robot('enemy1').hp = 1;
    w.step(new Map());
    expect(w.robot('enemy1').hp).toBe(1);
    const ev = w.step(new Map());
    expect(w.robot('enemy1').hp).toBe(2);
    expect(ev).toContainEqual({ type: 'heal', robot: 'enemy1', amount: 1 });
    for (let i = 0; i < 10; i++) w.step(new Map());
    expect(w.robot('enemy1').hp).toBe(3);
  });
});

describe('judge: damage and waste', () => {
  const map = ['.....', '.D...', '.....', '.....', '..^..'];
  const fight = (script: string) => runBattle({ build: { ...START_BUILD, chassis: 'medium' }, script, layout: { map: ['..D..', '.....', '.....', '..^..'], enemies: [{ hp: 1, script: 'while True:\n    wait()' }], seed: 1 } });
  it('limits the damage taken', () => {
    const b = fight('fire()');
    expect(b.outcome).toBe('win');
    expect(judge(b, { maxDamage: 0 }).won).toBe(true);
    expect(judge({ ...b, damageTaken: 3 }, { maxDamage: 2 })).toMatchObject({ won: false, unmet: 'damage' });
  });
  it('flags shots into a raised shield', () => {
    const b = runBattle({
      build: { ...START_BUILD, chassis: 'medium' },
      script: 'fire()\nfire()\nfire()\nfire()',
      layout: { map: ['..D..', '.....', '.....', '..^..'], enemies: [{ hp: 2, gear: ['shield'], script: 'while True:\n    shield.activate()\n    wait()' }], seed: 1 },
    });
    expect(b.outcome).toBe('win');
    expect(judge(b, { noWaste: true })).toMatchObject({ won: false, unmet: 'waste' });
    expect(judge(b, {}).won).toBe(true);
  });
  void map;
});
