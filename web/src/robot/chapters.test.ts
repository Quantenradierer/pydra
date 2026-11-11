import { describe, expect, it } from 'vitest';
import { ENEMIES } from './content/index.ts';
import { START_BUILD, type Build } from './build.ts';
import { DEFAULT_BUILD, fightEnemy } from './fight.ts';

const enemy = (id: string) => ENEMIES.find((e) => e.id === id)!;
const run = (id: string, script: string, build: Build = DEFAULT_BUILD) => fightEnemy(enemy(id), build, script);
const SHIELD_BUILD: Build = { ...START_BUILD, chassis: 'medium', gear: ['blaster', 'eyes', 'shield'] };

describe('Chapter 2', () => {
  it('Tank Dummy: three plain shots win too, a for loop is not required', () => {
    expect(run('tank-dummy', 'forward(4)\nfire()\nfire()\nfire()').won).toBe(true);
  });
  it('Corner Dummy: the corner dummy is not in any line of the robot, it has to walk', () => {
    expect(run('corner-dummy', enemy('patrol-dummy').solution + '\nturn_right()\nturn_right()\nfor i in range(4):\n    fire()').won).toBe(false);
  });
  it('Boss Dummy: the loop around the loop wins within the line limit; the line limit is real', () => {
    expect(run('dummy-army', enemy('dummy-army').solution).won).toBe(true);
    const spam = enemy('dummy-army').solution.replace('for k in range(2):', 'fire()\nfire()\nfire()\nfire()\nfire()\nfor k in range(2):');
    const r = run('dummy-army', spam);
    expect([r.fight.battle.outcome, r.tooLong]).toEqual(['win', true]);
  });
});

describe('Chapter 3', () => {
  it('Bubble: blind shooting wastes shots on the shield', () => {
    const r = run('bubble', enemy('right-dummy').solution);
    expect(r.won).toBe(false);
  });
  it('Bubble: waiting while the shield is up wins', () => {
    expect(run('bubble', enemy('bubble').solution).won).toBe(true);
  });
  it('Right or Ahead: code that only fires ahead loses once an enemy is on the side', () => {
    expect(run('right-dummy', 'fire()\nfire()').won).toBe(false);
  });
  it('Three-Way: without the else branch the enemy behind is never found', () => {
    expect(run('three-way', enemy('right-dummy').solution).won).toBe(false);
  });
  it('Sniper: the sniper shoots every round; whoever deals with the others first loses', () => {
    const r = run('sniper', enemy('bubble').solution);
    expect([r.won, r.fight.battle.outcome]).toEqual([false, 'loss']);
    expect(run('sniper', enemy('sniper').solution).won).toBe(true);
  });
  it('Sniper: the same script also wins with a shield added', () => {
    expect(run('sniper', enemy('sniper').solution, SHIELD_BUILD).won).toBe(true);
  });
});

describe('Chapter 1: the ring', () => {
  it('Roamer: the dummy walks past the robot; waiting three rounds and then firing wins, one round too early or too late does not', () => {
    expect(run('roamer', 'wait()\nwait()\nwait()\nfire()').won).toBe(true);
    expect(run('roamer', 'wait()\nwait()\nfire()').won).toBe(false);
  });
  it('Circle Search: it starts at another place on the circle; timing alone is not enough, looking is', () => {
    expect(run('ring-search', 'wait()\nwait()\nwait()\nfire()').won).toBe(false);
    expect(run('ring-search', enemy('ring-search').solution).won).toBe(true);
  });
  it('Circle Search: a fight is won only if it is won from every start (a script that finds just one of the four does not win)', () => {
    const turnsOnce = 'for i in range(40):\n    if see() == "enemy":\n        fire()';
    expect(run('ring-search', turnsOnce).won).toBe(false);
  });
  it('Four Spots: staying put loses, turning and looking wins from all four places', () => {
    expect(run('four-spots', 'fire()\nfire()').won).toBe(false);
    expect(run('four-spots', enemy('four-spots').solution).won).toBe(true);
  });
});

describe('Chapter 4', () => {
  it('Regenerator: the old script stops after one shot and loses', () => {
    expect(run('regenerator', enemy('far-far-dummy').solution).won).toBe(false);
  });
  it('Patrol: no shot may miss', () => {
    expect(run('patroller', enemy('side-guard').solution).won).toBe(false);
  });
});
