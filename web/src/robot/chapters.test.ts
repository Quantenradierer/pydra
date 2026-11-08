import { describe, expect, it } from 'vitest';
import { ENEMIES } from './content/index.ts';
import { fightEnemy, fullBuild } from './fight.ts';

const enemy = (id: string) => ENEMIES.find((e) => e.id === id)!;
const run = (id: string, script: string, build = enemy(id).solutionBuild) => fightEnemy(enemy(id), ENEMIES, fullBuild(build), script);
const LOOP = (inner: string) =>
  `for i in range(30):\n    if see_right() == "enemy":\n        turn_right()\n    elif see_left() == "enemy":\n        turn_left()\n    elif see() == "enemy":\n${inner.replace(/^/gm, '        ')}`;

describe('Chapter 3', () => {
  it('Bubble: blind shooting wastes shots on the shield', () => {
    const r = run('bubble', LOOP('fire()'));
    expect(r.won).toBe(false);
    expect(r.fights.some((f) => f.unmet === 'waste')).toBe(true);
  });
  it('Gatekeeper: waiting instead of shielding takes too much damage', () => {
    const waiting = LOOP('if enemy_shielded():\n    wait()\nelse:\n    fire()');
    const r = run('gatekeeper', waiting);
    expect(r.won).toBe(false);
    expect(r.fights.some((f) => f.unmet === 'damage')).toBe(true);
    expect(run('gatekeeper', enemy('gatekeeper').solution).won).toBe(true);
  });
  it('Charger: the hammer finishes the fight with less damage than the blaster alone', () => {
    const hammer = run('charger', enemy('charger').solution);
    const blaster = run('charger', LOOP('if enemy_shielded():\n    wait()\nelse:\n    fire()'), enemy('gatekeeper').solutionBuild);
    expect(hammer.won && blaster.won).toBe(true);
    expect(hammer.damage).toBeLessThan(blaster.damage);
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
    const r = run('final-exam', enemy('hide-and-seek').solution, enemy('pg2-a').solutionBuild);
    expect(r.won).toBe(false);
  });
  it('the final script wins all eighteen fights of the Final Exam', () => {
    const r = run('final-exam', enemy('final-exam').solution);
    expect(r.fights).toHaveLength(18);
    expect(r.won).toBe(true);
  });
});

describe('the two late additions', () => {
  it('Backstep Dummy: standing still wins but takes damage, backing off takes none', () => {
    const r = run('backstep-dummy', 'fire()\nfire()');
    expect(r.won).toBe(false);
    expect(r.fights.every((f) => f.battle.outcome === 'win' && f.unmet === 'damage')).toBe(true);
    expect(run('backstep-dummy', 'backward()\nfire()\nfire()').won).toBe(true);
  });
  it('Growing Shots: a plain fire(3) does not count, fire(i) does', () => {
    expect(run('growing-shots', 'forward(4)\nfire(3)\nwait()\nwait()\nfire(3)').won).toBe(false);
  });
});
