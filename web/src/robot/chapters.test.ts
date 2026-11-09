import { describe, expect, it } from 'vitest';
import { ENEMIES } from './content/index.ts';
import { START_BUILD, type Build } from './build.ts';
import { DEFAULT_BUILD, fightEnemy } from './fight.ts';

const enemy = (id: string) => ENEMIES.find((e) => e.id === id)!;
const run = (id: string, script: string, build: Build = DEFAULT_BUILD) => fightEnemy(enemy(id), build, script);
const SHIELD_BUILD: Build = { ...START_BUILD, chassis: 'medium', gear: ['blaster', 'eyes', 'shield'] };
const LOOP = (inner: string) =>
  `for i in range(30):\n    if see_right() == "enemy":\n        turn_right()\n    elif see_left() == "enemy":\n        turn_left()\n    elif see() == "enemy":\n${inner.replace(/^/gm, '        ')}`;

describe('Chapter 2', () => {
  it('Tank Dummy: five plain shots are not a loop, so they do not count', () => {
    expect(run('tank-dummy', 'forward(4)\nfire()\nfire()\nfire()\nfire()\nfire()').won).toBe(false);
  });
  it('After the Loop: "done" inside the loop is said too often', () => {
    expect(run('after-the-loop', 'forward(4)\nfor i in range(5):\n    fire()\n    say("done")\nturn_right()\nfor i in range(5):\n    fire()').won).toBe(false);
  });
  it('Dummy Army: a loop around the first loop wins within the line limit; the line limit is real', () => {
    expect(run('dummy-army', enemy('dummy-army').solution).won).toBe(true);
    const spam = 'forward(4)\n' + 'fire()\n'.repeat(20) + 'turn_right()\nfor i in range(5):\n    fire()\nturn_right()\nturn_right()\nfor i in range(5):\n    fire()\nsay("done")';
    const r = run('dummy-army', spam);
    expect([r.fight.battle.outcome, r.tooLong]).toEqual(['win', true]);
  });
});

describe('Chapter 3', () => {
  it('Bubble: blind shooting wastes shots on the shield', () => {
    const r = run('bubble', enemy('bubble').solution.replace('if enemy_shielded():\n            wait()\n        else:\n            fire()', 'fire()').replace('        fire()\n        fire()', '        fire()'));
    expect(r.won).toBe(false);
    expect(r.fight.unmet).toBe('waste');
  });
  it('Bubble: waiting while the shield is up wins', () => {
    expect(run('bubble', enemy('bubble').solution).won).toBe(true);
  });
  it('Peekaboo: code that only fires ahead loses once an enemy is on the side', () => {
    expect(run('wall-or-not', 'fire()\nfire()').won).toBe(false);
  });
  it('Health Check: without saying "low" the sniper fight is not won', () => {
    const r = run('health-check', enemy('bubble').solution);
    expect([r.fight.battle.outcome, r.fight.unmet]).toEqual(['win', 'sayPrefix']);
    expect(run('health-check', enemy('health-check').solution).won).toBe(true);
  });
  it('Health Check: the sniper also wins with a shield, a hammer or other gear added', () => {
    expect(run('bubble', enemy('bubble').solution, SHIELD_BUILD).won).toBe(true);
  });
});

describe('Chapter 4', () => {
  it('Regenerator: the old script stops after two shots and loses', () => {
    expect(run('regenerator', enemy('far-far-dummy').solution).won).toBe(false);
  });
  it('Countdown: no for, and "Liftoff!" exactly once', () => {
    expect(run('countdown', enemy('countdown').solution.replace('while n > 0:', 'for n in range(5):')).won).toBe(false);
    expect(run('countdown', enemy('regenerator').solution).won).toBe(false);
  });
  it('Break Out: needs while True and break', () => {
    expect(run('break-out', enemy('maze-runner').solution).won).toBe(false);
  });
});

describe('Practice Fields and Exams', () => {
  it('the final script wins the Final Exam', () => {
    expect(run('final-exam', enemy('final-exam').solution).won).toBe(true);
  });
});
