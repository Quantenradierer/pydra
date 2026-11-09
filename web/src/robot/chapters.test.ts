import { describe, expect, it } from 'vitest';
import { ENEMIES } from './content/index.ts';
import { START_BUILD, type Build } from './build.ts';
import { DEFAULT_BUILD, fightEnemy } from './fight.ts';

const enemy = (id: string) => ENEMIES.find((e) => e.id === id)!;
const run = (id: string, script: string, build: Build = DEFAULT_BUILD) => fightEnemy(enemy(id), build, script);
const SHIELD_BUILD: Build = { ...START_BUILD, chassis: 'medium', gear: ['blaster', 'eyes', 'shield'] };
const LOOP = (inner: string) =>
  `for i in range(30):\n    if see_right() == "enemy":\n        turn_right()\n    elif see_left() == "enemy":\n        turn_left()\n    elif see() == "enemy":\n${inner.replace(/^/gm, '        ')}`;

describe('Chapter 3', () => {
  it('Bubble: blind shooting wastes shots on the shield', () => {
    const r = run('bubble', LOOP('fire()'));
    expect(r.won).toBe(false);
    expect(r.fight.unmet).toBe('waste');
  });
  it('Gatekeeper: the plain script wins with the starting gear; a shield is an optional way to lose less', () => {
    const waiting = LOOP('if enemy_shielded():\n    wait()\nelse:\n    fire()');
    const plain = run('gatekeeper', waiting);
    expect(plain.won).toBe(true);
    expect(run('gatekeeper', enemy('gatekeeper').solution).won).toBe(true);
    const shielded = run('gatekeeper', LOOP('if enemy_shielded():\n    shield.activate()\nelse:\n    fire()'), SHIELD_BUILD);
    expect(shielded.won).toBe(true);
    expect(shielded.damage).toBeLessThan(plain.damage);
  });
  it('Charger: the plain script wins with the starting gear; the hammer is an optional way to lose less', () => {
    const plain = run('charger', enemy('charger').solution);
    const hammer = run('charger', LOOP('if distance() == 1:\n    smash()\nelif enemy_shielded():\n    wait()\nelse:\n    fire()'), { ...START_BUILD, chassis: 'medium', gear: ['blaster', 'eyes', 'hammer'] });
    expect(plain.won && hammer.won).toBe(true);
    expect(hammer.damage).toBeLessThanOrEqual(plain.damage);
  });
  it('Peekaboo: code that only fires ahead loses the sideways layout', () => {
    expect(run('peekaboo', 'fire()\nfire()').won).toBe(false);
  });
  it('Rhythm Dummy: the clock rhythm wins, the scanner is not allowed', () => {
    expect(run('rhythm-dummy', LOOP('if enemy_shielded():\n    wait()\nelse:\n    fire()')).won).toBe(false);
  });
  it('Order Matters: the wide check first never says critical', () => {
    const wrong = 'for i in range(12):\n    if hp() < 10:\n        say("hurt")\n    elif hp() < 5:\n        say("critical")\n    fire()';
    expect(run('order-matters', wrong).won).toBe(false);
  });
});

describe('Proving Grounds II', () => {
  it('the Chapter 4 boss script is not enough for the Final Exam (no shield awareness)', () => {
    const r = run('final-exam', enemy('hide-and-seek').solution);
    expect(r.won).toBe(false);
  });
  it('the final script wins the Final Exam', () => {
    const r = run('final-exam', enemy('final-exam').solution);
    expect(r.won).toBe(true);
  });
});

describe('the two late additions', () => {
  it('Backstep Dummy: standing still wins but takes damage, backing off takes none', () => {
    const r = run('backstep-dummy', 'fire()\nfire()');
    expect(r.won).toBe(false);
    expect([r.fight.battle.outcome, r.fight.unmet]).toEqual(['win', 'damage']);
    expect(run('backstep-dummy', 'backward()\nfire()\nfire()').won).toBe(true);
  });
  it('Growing Shots: six plain shots are not enough, the loop variable decides', () => {
    expect(run('growing-shots', 'forward(4)\nfor i in range(6):\n    fire()').won).toBe(false);
    expect(run('growing-shots', enemy('growing-shots').solution).won).toBe(true);
  });
  it('Staircase: wheels climb it with turns; spider legs are an optional shortcut', () => {
    expect(run('staircase', enemy('staircase').solution).won).toBe(true);
    expect(run('staircase', 'for i in range(3):\n    move_north()\n    move_east()\nfire()\nfire()', { ...START_BUILD, locomotion: 'legs' }).won).toBe(true);
  });
});
