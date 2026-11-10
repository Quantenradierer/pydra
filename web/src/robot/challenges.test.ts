import { describe, expect, it } from 'vitest';
import { runBattle } from './battle.ts';
import { ENEMIES } from './content/index.ts';
import { DEFAULT_BUILD, fightEnemy, layoutOf } from './fight.ts';
import { parseMap } from './layout.ts';

/**
 * The design list of docs/robot-challenges.md as tests: for every challenge the reference solution wins, and the script
 * "without the new idea" (the solution of the challenge before, or the naive way named in the list) does not.
 */
const enemy = (id: string) => ENEMIES.find((e) => e.id === id)!;
const run = (id: string, script: string) => fightEnemy(enemy(id), DEFAULT_BUILD, script);
const sol = (id: string) => enemy(id).solution;
const frames = (id: string, script = sol(id)) => runBattle({ build: DEFAULT_BUILD, script, layout: layoutOf(enemy(id)) }).frames;
const robot = (id: string, who: string, script?: string) => frames(id, script).map((f) => f.robots.find((r) => r.id === who)!);
/** A block of code one level deeper. */
const indent = (code: string) => code.split('\n').map((l) => `    ${l}`).join('\n');

const ORDER = [
  'first-contact', 'one-more-line', 'training-dummy', 'wall-dummy',
  'long-way', 'tank', 'beat',
  'patrol', 'flank', 'flicker',
  'scout', 'twice', 'healer', 'sniper',
  'drill',
  'lanes',
];

describe('the list of challenges', () => {
  it('is the design list, in order: 16 challenges in 6 chapters', () => {
    expect(ENEMIES.map((e) => e.id)).toEqual(ORDER);
    expect(ENEMIES.map((e) => e.chapter)).toEqual([0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 5]);
  });

  it('every arena is 5 rows high, at most 10 wide, and the robot starts on the left edge or in the middle, looking east', () => {
    for (const e of ENEMIES) {
      const m = parseMap(e.map);
      expect(e.map.length, e.id).toBe(5);
      expect(e.map[0]!.length, e.id).toBeGreaterThanOrEqual(7);
      expect(e.map[0]!.length, e.id).toBeLessThanOrEqual(10);
      expect(m.player.facing, e.id).toBe('E');
    }
  });

  for (const id of ORDER) {
    it(`${id}: the reference solution wins with the default gear`, () => {
      const r = run(id, sol(id));
      expect([r.won, r.fight.battle.reason, r.fight.unmet, r.tooLong]).toEqual([true, 'win', undefined, false]);
    });
  }

  for (let i = 1; i < ORDER.length; i++) {
    const [prev, next] = [enemy(ORDER[i - 1]!), enemy(ORDER[i]!)];
    if (!prev || !next || prev.chapter !== next.chapter) continue;
    it(`${next.id}: the solution of ${prev.id} (without the new idea) loses`, () => {
      expect(run(next.id, prev.solution).won).toBe(false);
    });
  }
});

describe('Chapter 0: commands in a row', () => {
  it('First Contact: the dummy is out of range from the start, so fire() alone does nothing', () => {
    expect(run('first-contact', 'fire()').won).toBe(false);
    expect(run('first-contact', 'forward()\nfire()').won).toBe(true);
  });
  it('Second Dummy: shooting without turning never hits the dummy on the side', () => {
    expect(run('training-dummy', `${sol('one-more-line')}\nfire()\nfire()\nfire()`).won).toBe(false);
  });
  it('Wall Dummy: the wall is two tiles right under the start, between the robot and the third dummy', () => {
    const m = parseMap(enemy('wall-dummy').map);
    const third = m.enemies.find((e) => e.def === 2)!.pos;
    expect(third.x).toBe(m.player.pos.x);
    expect(third.y).toBe(m.player.pos.y + 2);
    expect(m.tiles[m.player.pos.y + 1]![m.player.pos.x]).toBe('wall');
    expect(m.tiles[m.player.pos.y + 1]![m.player.pos.x + 1]).toBe('wall');
  });
  it('Wall Dummy: a shot at the wall bounces off; only the detour wins', () => {
    const through = `${sol('training-dummy')}\nturn_left()\nturn_left()\nfire()\nfire()`;
    expect(run('wall-dummy', through).won).toBe(false);
    expect(run('wall-dummy', 'turn_right()\nfire()').won).toBe(false);
  });
});

describe('Chapter 1: numbers and for loops', () => {
  it('Far Away: the dummy is 7 tiles away and the blaster reaches 5', () => {
    expect(run('long-way', 'fire()\nfire()').won).toBe(false);
  });
  it('Far Away: forward() written three times wins the fight but is too long', () => {
    const r = run('long-way', 'forward()\nforward()\nforward()\nfire()\nfire()');
    expect([r.fight.battle.outcome, r.tooLong, r.won]).toEqual(['win', true, false]);
  });
  it('Tank: five fire() lines win the fight but break the line limit; the loop fits', () => {
    const r = run('tank', `${sol('long-way')}\n${'fire()\n'.repeat(5).trim()}`);
    expect([r.fight.battle.outcome, r.tooLong, r.won]).toEqual(['win', true, false]);
    expect(enemy('tank').enemies.map((d) => d.hp)).toEqual([2, 5]);
  });
  it('Beat Shield: the tank gets a shield that is down 1 round and up 2, forever; nothing else changes', () => {
    expect(enemy('beat').map).toEqual(enemy('tank').map);
    expect(enemy('beat').enemies[1]).toEqual({ ...enemy('tank').enemies[1]!, shieldCycle: { up: 2, down: 1 } });
    expect(robot('beat', 'enemy2').slice(0, 7).map((r) => (r.shieldUp ? 1 : 0))).toEqual([0, 1, 1, 0, 1, 1, 0]);
  });
  it('Beat Shield: the Tank loop shoots into the shield (a miss); so does a beat that is off by one', () => {
    expect(run('beat', sol('tank'))).toMatchObject({ won: false });
    const spam = sol('tank').replace('range(5)', 'range(15)');
    expect(run('beat', spam)).toMatchObject({ won: false, fight: { unmet: 'miss' } });
    const off = sol('tank').replace('    fire()', '    fire()\n    wait()\n    wait()');
    expect(run('beat', off).won).toBe(false);
  });
  it('Beat Shield: every shot of the reference solution lands, and the beat written out line by line is too long', () => {
    const shots = frames('beat').flatMap((f) => f.events).filter((e) => e.type === 'shot' && e.by === 'player');
    expect(shots.length).toBe(2 + 5);
    expect(shots.every((e) => e.type === 'shot' && e.hit !== undefined && !e.blocked)).toBe(true);
    const r = run('beat', `${sol('long-way')}\n${'wait()\nfire()\nwait()\n'.repeat(5).trim()}`);
    expect([r.fight.battle.outcome, r.fight.unmet, r.tooLong]).toEqual(['win', undefined, true]);
  });
  it('Beat Shield: no turn is involved, so the beat is the same for every chassis', () => {
    expect(sol('beat')).not.toMatch(/turn_/);
  });
});

describe('Chapter 2: if / elif / else', () => {
  it('Patrol: the walker has 2 HP and crosses the robot\'s row at irregular times (rounds 2, 4, 8, 10, ...)', () => {
    expect(enemy('patrol').enemies[0]).toMatchObject({ hp: 2, patrol: { dir: 'S', steps: 3 } });
    const row = parseMap(enemy('patrol').map).player.pos.y;
    const ys = robot('patrol', 'enemy1', 'for i in range(12):\n    wait()').map((r) => r.pos.y);
    expect(ys.slice(0, 12)).toEqual([0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1]);
    expect(ys.map((y, t) => (y === row ? t : -1)).filter((t) => t >= 0).slice(0, 4)).toEqual([2, 4, 8, 10]);
  });
  it('Patrol: shooting every round misses; so does a fixed beat of fire() and wait()', () => {
    expect(run('patrol', 'for i in range(40):\n    fire()')).toMatchObject({ won: false, fight: { unmet: 'miss' } });
    expect(run('patrol', 'for i in range(20):\n    fire()\n    wait()').won).toBe(false);
    expect(run('patrol', 'for i in range(20):\n    wait()\n    fire()').won).toBe(false);
  });
  it('Flank: the regenerator heals 1 HP every 2 rounds; a shot every other round never gets it down', () => {
    expect(enemy('flank').enemies[1]).toMatchObject({ hp: 3, regen: { every: 2, amount: 1 } });
    const slow = 'turn_left()\nfor i in range(40):\n    fire()\n    wait()';
    expect(run('flank', slow).fight.battle.outcome).toBe('loss');
  });
  it('Flank: without the way back (see_right) the robot kills the regenerator and then never faces the walker again', () => {
    const noBack = sol('flank').replace('    elif see_right() == "enemy":\n        turn_right()\n', '');
    expect(noBack).not.toBe(sol('flank'));
    expect(run('flank', noBack).won).toBe(false);
  });
  it('Flicker Shield: the shield has a rhythm of 3 rounds, the walk one of 6; both states are seen', () => {
    const def = enemy('flicker').enemies[0]!;
    expect(def.patrol).toEqual(enemy('patrol').enemies[0]!.patrol);
    expect(def.shieldCycle!.up + def.shieldCycle!.down).toBe(3);
    const b = runBattle({ build: DEFAULT_BUILD, script: sol('flicker'), layout: layoutOf(enemy('flicker')) });
    const seen = new Set(b.frames.flatMap((f) => f.sensors.player ?? []).filter((s) => s.startsWith('enemy_shielded()')));
    expect(seen).toEqual(new Set(['enemy_shielded() → True', 'enemy_shielded() → False']));
  });
  it('Flicker Shield: the Flank solution shoots into the shield; a fixed beat does not help either', () => {
    expect(run('flicker', sol('flank'))).toMatchObject({ won: false, fight: { unmet: 'miss' } });
    for (const beat of ['fire()\n    wait()', 'fire()\n    wait()\n    wait()', 'wait()\n    fire()\n    wait()'])
      expect(run('flicker', `turn_left()\nfor i in range(5):\n    fire()\nturn_right()\nfor i in range(30):\n    ${beat}`).won, beat).toBe(false);
  });
});

describe('Chapter 3: while loops', () => {
  it('Scout: the walker starts 7 tiles away, out of range; a shot from the start misses', () => {
    expect(run('scout', 'fire()').won).toBe(false);
    expect(robot('scout', 'enemy1', 'for i in range(6):\n    wait()').map((r) => r.pos.x).slice(0, 5)).toEqual([7, 8, 7, 8, 7]);
  });
  it('Scout: the rule asks for while (in this one fight forward(2) would do the same)', () => {
    expect(run('scout', 'forward(2)\nfire()')).toMatchObject({ won: false, fight: { unmet: 'uses' } });
  });
  it('Twice: after the first hit the walker is out of range, so a second fire() right away misses', () => {
    expect(run('twice', `${sol('scout')}\nfire()`)).toMatchObject({ won: false });
    expect(run('twice', sol('twice')).won).toBe(true);
  });
  it('Healer: it is out of range after the walker is down, and it heals: a fixed four shots are not enough', () => {
    expect(enemy('healer').enemies[1]).toMatchObject({ hp: 4, regen: { every: 2, amount: 1 } });
    const four = sol('healer').replace('while see() == "enemy":\n    fire()', 'for k in range(4):\n    fire()');
    expect(four).not.toBe(sol('healer'));
    expect(run('healer', four).won).toBe(false);
  });
  it('Sniper: it shoots back down its column once it sees the robot, so the reference solution takes damage but keeps half its HP', () => {
    const r = run('sniper', sol('sniper'));
    expect(r.won).toBe(true);
    expect(r.damage).toBeGreaterThanOrEqual(1);
    expect(r.damage).toBeLessThanOrEqual(4);
    expect(enemy('sniper').enemies[2]!.script).toContain('fire()');
  });
  it('Sniper: coming at it from the side costs no HP (it only looks down its column)', () => {
    const m = parseMap(enemy('sniper').map);
    const sniper = m.enemies.find((e) => e.def === 2)!.pos;
    expect(sniper.y).toBe(0);
    const flank = `${sol('healer')}\nturn_left()\nforward(2)\nturn_right()\nwhile see() != "enemy":\n    forward()\nwhile see() == "enemy":\n    fire()`;
    const r = run('sniper', flank);
    expect([r.won, r.damage]).toEqual([true, 0]);
  });
});

describe('Chapter 4: functions', () => {
  const body = 'while see() == "enemy":\n    if enemy_shielded():\n        wait()\n    else:\n        fire()';
  it('All Around: two different shields and a regenerator around the robot', () => {
    const defs = enemy('drill').enemies;
    expect(defs.map((d) => d.hp)).toEqual([2, 3, 4]);
    expect(defs[0]!.shieldCycle).not.toEqual(defs[1]!.shieldCycle);
    expect(defs[2]!.regen).toBeDefined();
  });
  it('All Around: the block written out three times wins the fight but is too long; def fits', () => {
    const r = run('drill', `${body}\nturn_left()\n${body}\nturn_left()\nturn_left()\n${body}`);
    expect([r.fight.battle.outcome, r.fight.unmet, r.tooLong, r.won]).toEqual(['win', undefined, true, false]);
    expect(sol('drill')).toContain(`def attack():\n${indent(body)}`);
  });
  it('All Around: short blind volleys fit the limit but miss', () => {
    const blind = 'for i in range(4):\n    fire()\nturn_left()\nfor i in range(6):\n    fire()\nturn_left()\nturn_left()\nfor i in range(9):\n    fire()';
    expect(run('drill', blind)).toMatchObject({ won: false, fight: { unmet: 'miss' } });
  });
});

describe('Chapter 5: parameters', () => {
  const shoot = 'while see() == "enemy":\n    fire()';
  it('Three Lanes: walls leave three lanes that only meet in the start column; the enemies are 8, 7 and 6 tiles in', () => {
    const m = parseMap(enemy('lanes').map);
    expect(m.player.pos).toEqual({ x: 0, y: 2 });
    for (const y of [1, 3]) for (let x = 1; x < 9; x++) expect(m.tiles[y]![x]).toBe('wall');
    expect(m.enemies.map((e) => [e.pos.x, e.pos.y]).sort()).toEqual([[6, 4], [7, 0], [8, 2]]);
  });
  it('Three Lanes: written out three times it wins the fight but is too long', () => {
    const inline = `forward(3)\n${shoot}\nbackward(3)\nturn_left()\nforward(2)\nturn_right()\nforward(2)\n${shoot}\nbackward(2)\nturn_right()\nforward(4)\nturn_left()\nforward(1)\n${shoot}`;
    const r = run('lanes', inline);
    expect([r.fight.battle.outcome, r.tooLong, r.won]).toEqual(['win', true, false]);
  });
  it('Three Lanes: a function without the way back leaves the robot stuck in the first lane', () => {
    const stuck = sol('lanes').replace('\n    backward(n)', '');
    expect(stuck).not.toBe(sol('lanes'));
    expect(run('lanes', stuck).won).toBe(false);
  });
  it('Three Lanes: one function, three different arguments', () => {
    expect(sol('lanes')).toMatch(/def strike\(n\):/);
    expect([...sol('lanes').matchAll(/^strike\((\d)\)$/gm)].map((m) => m[1])).toEqual(['3', '2', '1']);
  });
});
