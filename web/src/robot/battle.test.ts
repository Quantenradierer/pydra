import { describe, expect, it } from 'vitest';
import { START_BUILD, type Build } from './build.ts';
import { precheck, runBattle } from './battle.ts';
import type { LayoutSpec } from './layout.ts';

const layout = (map: string[], enemies: LayoutSpec['enemies'] = [{ hp: 1 }], seed = 1): LayoutSpec => ({ map, enemies, seed });
const withGear = (b: Partial<Build>): Build => ({ ...START_BUILD, ...b });

describe('runBattle', () => {
  it('wins against a dummy ahead: forward, fire', () => {
    const r = runBattle({ build: START_BUILD, script: 'forward()\nfire()', layout: layout(['>..D']) });
    expect(r.outcome).toBe('win');
    expect(r.reason).toBe('win');
    expect(r.frames.length - 1).toBe(2);
    expect(r.frames[1]!.lines.player).toBe(1);
    expect(r.frames[2]!.lines.player).toBe(2);
    expect(r.frames[2]!.events).toContainEqual(expect.objectContaining({ type: 'shot', hit: 'enemy1' }));
  });

  it('is a loss when the script ends without winning (timeout), and replays identically', () => {
    const input = { build: START_BUILD, script: 'turn_left()', layout: layout(['>..D']) };
    const a = runBattle(input);
    expect(a.outcome).toBe('loss');
    expect(a.reason).toBe('timeout');
    expect(a.frames.length - 1).toBe(200);
    expect(runBattle(input)).toEqual(a);
  });

  it('stops with the error and its line when the script fails', () => {
    const r = runBattle({ build: START_BUILD, script: 'forward()\nfoward()', layout: layout(['>..D']) });
    expect(r.reason).toBe('error');
    expect([r.error?.code, r.error?.line]).toEqual(['unknown-name', 2]);
  });

  it('stops a loop that never acts (loop guard)', () => {
    const r = runBattle({ build: START_BUILD, script: 'n = 0\nwhile True:\n    n += 1', layout: layout(['>..D']) });
    expect(r.reason).toBe('budget');
    expect(r.budgetLine).toBeGreaterThan(0);
  });

  it('forward(n) takes n ticks and a say() bubble is free', () => {
    const r = runBattle({ build: START_BUILD, script: 'say("go")\nforward(2)\nfire()', layout: layout(['>..D']) });
    expect(r.frames[1]!.bubbles).toEqual([{ robot: 'player', text: 'go' }]);
    expect(r.frames.length - 1).toBe(3);
    expect(r.outcome).toBe('win');
  });

  it('records sensor values and lets see() steer the script', () => {
    const r = runBattle({ build: START_BUILD, script: 'if see() == "enemy":\n    fire()', layout: layout(['>.D']) });
    expect(r.frames[1]!.sensors.player).toEqual(['see() → \'enemy\'']);
    expect(r.outcome).toBe('win');
  });

  it('legs move in absolute directions and cross rubble; wheels cannot', () => {
    const legs = runBattle({ build: withGear({ locomotion: 'legs' }), script: 'move_east(2)\nfire()', layout: layout(['>~.D']) });
    expect(legs.outcome).toBe('win');
    const wheels = runBattle({ build: START_BUILD, script: 'forward(2)\nfire()', layout: layout(['>~.D']) });
    expect(wheels.frames[1]!.events).toContainEqual({ type: 'bump', robot: 'player', reason: 'rubble' });
  });

  it('cannon power is damage and cooldown; an uncharged action loses the tick', () => {
    const r = runBattle({ build: withGear({ gear: ['cannon', 'eyes'] }), script: 'fire(3)\nfire(1)\nfire(1)', layout: layout(['>D'], [{ hp: 4 }]) });
    expect(r.frames[1]!.events).toContainEqual(expect.objectContaining({ type: 'damage', amount: 3 }));
    expect(r.frames[2]!.events).toContainEqual({ type: 'fizzle', robot: 'player', part: 'cannon', reason: 'charging', ticks: 2 });
    expect(r.frames[3]!.events).toContainEqual({ type: 'fizzle', robot: 'player', part: 'cannon', reason: 'charging', ticks: 1 });
  });

  it('hammer hits the adjacent tile for 3 with cooldown 2', () => {
    const r = runBattle({ build: withGear({ chassis: 'medium', gear: ['hammer', 'eyes'] }), script: 'smash()\nsmash()\nsmash()', layout: layout(['>D'], [{ hp: 5 }]) });
    expect(r.frames[1]!.events).toContainEqual(expect.objectContaining({ type: 'smash', hit: 'enemy1' }));
    expect(r.frames[2]!.events).toContainEqual(expect.objectContaining({ type: 'fizzle', ticks: 1 }));
    expect(r.outcome).toBe('win');
  });

  it('a shield, activated the tick before, blocks an enemy shot; enemies run Python too', () => {
    const enemy = { hp: 3, face: 'W' as const, script: 'fire()\nfire()' };
    const r = runBattle({ build: withGear({ chassis: 'medium', gear: ['shield', 'blaster', 'eyes'] }), script: 'shield.activate()\nwait()\nwait()', layout: layout(['>D'], [enemy]) });
    // Tick 1: enemy hits (shield not up yet); tick 2: shield is up and blocks.
    expect(r.frames[1]!.events).toContainEqual(expect.objectContaining({ type: 'damage', robot: 'player' }));
    expect(r.frames[2]!.events).toContainEqual(expect.objectContaining({ type: 'shot', blocked: true }));
  });

  it('wide-angle eyes see to the sides, gps tells the position', () => {
    const build = withGear({ chassis: 'medium', gear: ['eyes', 'gps', 'blaster'], addons: ['wide', 'scanner'] });
    const r = runBattle({ build, script: 'say(eyes.see_right())\nwait()\nsay(gps.position())\nwait()\nsay(enemy_shielded())\nwait()', layout: layout(['>.', 'D.']) });
    expect(r.frames[1]!.bubbles[0]!.text).toBe('enemy');
    expect(r.frames[2]!.bubbles[0]!.text).toBe('(0, 0)');
    expect(r.frames[3]!.bubbles[0]!.text).toBe('False');
  });

  it('burst blaster overheats after too many shots', () => {
    const r = runBattle({ build: withGear({ blasterMark: 2 }), script: 'fire(3)\nfire(3)\nfire(3)', layout: layout(['>.....D'], [{ hp: 9 }]) });
    expect(r.frames.some((f) => f.events.some((e) => e.type === 'fizzle' && e.reason === 'overheated'))).toBe(true);
  });
});

describe('precheck', () => {
  it('finds parts that are not equipped before the fight', () => {
    expect(precheck(START_BUILD, 'move_north()')?.params).toMatchObject({ kind: 'move-absolute' });
    expect(precheck(START_BUILD, 'shield.activate()')?.params).toMatchObject({ kind: 'part', need: 'shield' });
    expect(precheck(START_BUILD, 'forward()\nfire()')).toBeUndefined();
    expect(precheck(START_BUILD, 'fire(')?.code).toBe('unclosed-bracket');
  });
});
