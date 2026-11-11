import { describe, expect, it } from 'vitest';
import { START_BUILD } from './build.ts';
import { runBattle } from './battle.ts';
import { enemyScript } from './enemy-script.ts';
import type { EnemyDef } from './layout.ts';

const fight = (rows: string[], enemy: EnemyDef, script = '', n = 12, trace = false) => runBattle({ build: START_BUILD, script, layout: { map: rows, enemies: [enemy], seed: 1, maxTicks: n }, trace });
const path = (rows: string[], enemy: EnemyDef, n = 12) => fight(rows, enemy, '', n).frames.slice(1).map((f) => f.robots.find((r) => r.id === 'enemy1')!.pos);
const FREE = ['.....', '.....', '..^..', '.....', 'D....'];

describe('the script of an enemy', () => {
  it('a dummy runs "while True: wait()"', () => {
    expect(enemyScript({ hp: 1 })).toBe('while True:\n    wait()');
  });
  it('an explicit script is used as it is', () => {
    expect(enemyScript({ hp: 1, script: 'fire()' })).toBe('fire()');
  });
  it('a walker walks `steps` tiles, turns around, walks back and repeats', () => {
    expect(enemyScript({ hp: 1, patrol: { dir: 'E', steps: 3 } })).toBe('while True:\n    for i in range(3):\n        walk("east")\n    for i in range(3):\n        walk("west")');
    expect(path(FREE, { hp: 2, patrol: { dir: 'E', steps: 3 } }, 8).map((p) => p.x)).toEqual([1, 2, 3, 2, 1, 0, 1, 2]);
  });
  it('with `circle` it walks a square, facing the way it walks', () => {
    const rows = ['.....', '.D...', '.....', '..^..', '.....'];
    const def: EnemyDef = { hp: 1, patrol: { dir: 'E', steps: 1, circle: true } };
    expect(path(rows, def, 5).map((p) => `${p.x},${p.y}`)).toEqual(['2,1', '2,2', '1,2', '1,1', '2,1']);
    const faces = fight(rows, def, '', 4).frames.slice(1).map((f) => f.robots.find((r) => r.id === 'enemy1')!.facing);
    expect(faces).toEqual(['E', 'S', 'W', 'N']);
  });
  it('`start` is how far into its first leg the walker begins', () => {
    expect(path(['.....', '.....', '..^..', '.....', '.D...'], { hp: 1, patrol: { dir: 'E', steps: 3, start: 2 } }, 4).map((p) => p.x)).toEqual([2, 1, 0, 0]);
  });
  it('the script is what runs: the line of the enemy is recorded each round', () => {
    const r = fight(FREE, { hp: 1, patrol: { dir: 'E', steps: 3 } }, '', 3);
    expect(r.scripts!.enemy1).toBe(enemyScript({ hp: 1, patrol: { dir: 'E', steps: 3 } }));
    expect(r.frames.slice(1).map((f) => f.lines.enemy1)).toEqual([3, 3, 3]);
  });
  it('records its trace per enemy when tracing', () => {
    const r = fight(FREE, { hp: 1, patrol: { dir: 'E', steps: 3 } }, '', 3, true);
    expect(r.frames[1]!.traces!.enemy1!.some((e) => e.k === 'call' && e.fn === 'walk')).toBe(true);
  });
  it('a script cannot use the enemy functions', () => {
    const r = fight(FREE, { hp: 1 }, 'walk("east")', 2);
    expect(r.reason).toBe('error');
  });
});

describe('an enemy that aims: shoots at the player when in line, then waits', () => {
  const rows = ['..^..', '.....', '.....', '.....', 'D....'];
  const def = (every: number): EnemyDef => ({ hp: 3, patrol: { dir: 'E', steps: 4 }, aim: { every } });
  it('does not shoot before its cooldown is over, and only when the player is in line', () => {
    const r = fight(rows, def(3), 'wait()', 12);
    const shots = r.frames.filter((f) => f.events.some((e) => e.type === 'shot' && e.by === 'enemy1')).map((f) => f.robots.find((x) => x.id === 'enemy1')!.pos.x);
    expect(shots.length).toBeGreaterThan(0);
    expect(new Set(shots)).toEqual(new Set([2]));
  });
  it('turns to the player to shoot, and damages it', () => {
    const r = fight(rows, def(1), 'wait()', 10);
    expect(r.damageTaken).toBeGreaterThan(0);
  });
  it('is made of a cooldown, a look and a shot', () => {
    expect(enemyScript(def(8))).toContain('if cooldown == 0 and player_in_line():\n        shoot_player()');
  });
});

describe('stepping through an enemy script', () => {
  it('beats follow the enemy: its lines, its calls', async () => {
    const { buildBeats, stateAt } = await import('./stepper.ts');
    const r = fight(FREE, { hp: 1, patrol: { dir: 'E', steps: 3 } }, '', 4, true);
    const beats = buildBeats(r.frames, 'enemy1');
    expect(beats.filter((b) => b.kind === 'resolve').map((b) => b.line)).toEqual([3, 3, 3, 5]);
    const last = beats.length - 1;
    expect([...stateAt(beats, last).hints.values()].some((h) => h.call?.startsWith('walk('))).toBe(true);
  });
});
