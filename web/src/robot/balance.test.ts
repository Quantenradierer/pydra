import { describe, expect, it } from 'vitest';
import { BLASTER, BURST, CANNON, HAMMER, RANGE, period } from './balance.ts';
import { CHASSIS, START_BUILD, locomotionArmor, type Build } from './build.ts';
import { runBattle } from './battle.ts';
import { ENEMIES } from './content/index.ts';
import { DEFAULT_BUILD, fightEnemy } from './fight.ts';
import type { LayoutSpec } from './layout.ts';

/**
 * Balance rules (docs/robot-balance.md). If a number is changed so that one of these fails, the balance is broken:
 *  1. Ranged weapons deal less damage per round than melee, and no ranged shot does more than 2 (only the hammer does 3).
 *  2. Melee needs the enemy right in front of the robot.
 *  3. No part is strictly better than another one: each has a downside or a specialty.
 *  4. Every challenge lasts a reasonable number of rounds with its reference solution, and the default gear wins it.
 *  5. Enemy hit points rise gently along the chain.
 */
const TICKS = 24;
const layout = (map: string[], hp = 999): LayoutSpec => ({ map, enemies: [{ hp }], seed: 1, maxTicks: TICKS });
const build = (over: Partial<Build>): Build => ({ ...START_BUILD, ...over });

/** Damage per round of a weapon that fires as fast as it can at a target standing right in front of it (so range does not matter). */
function dps(b: Build, call: string, map = ['>D']): number {
  const r = runBattle({ build: b, script: `while True:\n    ${call}`, layout: layout(map) });
  const dealt = r.frames.flatMap((f) => f.events).reduce((sum, e) => (e.type === 'damage' && e.robot === 'enemy1' ? sum + e.amount : sum), 0);
  return dealt / TICKS;
}

const blaster = () => dps(START_BUILD, 'fire()');
const burst = () => dps(build({ blasterMark: 2 }), 'fire(3)');
const cannon = (power: number) => dps(build({ gear: ['cannon', 'eyes'] }), `fire(${power})`);
const hammer = () => dps(build({ gear: ['hammer', 'eyes'] }), 'smash()');

describe('damage per round: range is paid for', () => {
  it('blaster 1/round, hammer 1.5/round, and the numbers in balance.ts are what really happens', () => {
    expect(blaster()).toBeCloseTo(BLASTER.damage / period(BLASTER.cooldown), 1);
    expect(hammer()).toBeCloseTo(HAMMER.damage / period(HAMMER.cooldown), 1);
    for (let p = 1; p <= CANNON.maxPower; p++) expect(cannon(p)).toBeCloseTo(p / CANNON.cooldownOf(p), 1);
  });

  it('every ranged weapon deals less per round than the hammer', () => {
    const melee = hammer();
    expect(blaster()).toBeLessThan(melee);
    expect(burst()).toBeLessThan(melee);
    for (let p = 1; p <= CANNON.maxPower; p++) expect(cannon(p), `cannon power ${p}`).toBeLessThan(melee);
  });

  it('the cannon never out-damages 1.5x the blaster, and a bigger shot is paid for with a longer recharge', () => {
    for (let p = 1; p <= CANNON.maxPower; p++) expect(cannon(p), `power ${p}`).toBeLessThanOrEqual(blaster() * 1.5);
    for (let p = 1; p <= CANNON.maxPower; p++) expect(CANNON.cooldownOf(p)).toBeGreaterThan(p);
  });

  it('the burst blaster cannot sustain more than the plain one (it overheats)', () => {
    expect(burst()).toBeLessThanOrEqual(blaster());
    expect(BURST.maxShots * BURST.heatPerShot).toBeGreaterThanOrEqual(BURST.heatLimit - BURST.heatPerShot);
  });

  it('a ranged shot hits for 1 or 2; only the hammer hits for 3', () => {
    expect(BLASTER.damage).toBe(1);
    expect(CANNON.maxPower).toBeLessThanOrEqual(2);
    expect(HAMMER.damage).toBe(3);
    expect(HAMMER.damage).toBeGreaterThan(CANNON.maxPower);
  });

  it('weapon numbers stay small and readable', () => {
    expect(HAMMER.cooldown).toBeLessThanOrEqual(4);
    expect(CANNON.cooldownOf(CANNON.maxPower)).toBeLessThanOrEqual(4);
    expect(RANGE).toBeLessThanOrEqual(5);
  });
});

describe('melee needs contact', () => {
  it('the hammer hits the tile ahead and nothing further; the blaster shoots across the arena', () => {
    expect(dps(build({ gear: ['hammer', 'eyes'] }), 'smash()', ['>.D'])).toBe(0);
    expect(hammer()).toBeGreaterThan(0);
    expect(dps(START_BUILD, 'fire()', ['>....D'])).toBeGreaterThan(0);
    expect(dps(build({ gear: ['cannon', 'eyes'] }), 'fire(1)', ['>....D'])).toBeGreaterThan(0);
  });

  it('closing in costs rounds, and the enemy shoots back meanwhile', () => {
    const enemy = [{ hp: 999, script: 'while True:\n    fire()' }];
    const fight = (script: string, gear: Build['gear']) => runBattle({ build: build({ gear }), script, layout: { map: ['>....D'], enemies: enemy, seed: 1, maxTicks: 10 } });
    const closing = fight('forward(4)\nwhile True:\n    smash()', ['hammer', 'eyes']);
    expect(closing.damageTaken).toBeGreaterThanOrEqual(4);
  });
});

/** What a part is good at, from the numbers: higher is better in every dimension. */
interface Profile {
  dps: number;
  range: number;
  perHit: number;
  perCall: number;
}
const weapons: Record<string, Profile> = {
  blaster: { dps: 1, range: RANGE, perHit: BLASTER.damage, perCall: 1 },
  burst: { dps: 0.5, range: RANGE, perHit: BLASTER.damage, perCall: BURST.maxShots },
  cannon: { dps: CANNON.maxPower / CANNON.cooldownOf(CANNON.maxPower), range: RANGE, perHit: CANNON.maxPower, perCall: 1 },
  hammer: { dps: HAMMER.damage / period(HAMMER.cooldown), range: 1, perHit: HAMMER.damage, perCall: 1 },
};
const dominates = (a: Profile, b: Profile) => (Object.keys(a) as (keyof Profile)[]).every((k) => a[k] >= b[k]) && (Object.keys(a) as (keyof Profile)[]).some((k) => a[k] > b[k]);

describe('no part is strictly better than another', () => {
  it('weapons: for every pair, each is better in something', () => {
    for (const [an, a] of Object.entries(weapons)) for (const [bn, b] of Object.entries(weapons)) if (an !== bn) expect(dominates(a, b), `${an} dominates ${bn}`).toBe(false);
  });

  it('chassis: more slots and HP is paid for with slow turning', () => {
    const { light, medium } = CHASSIS;
    expect(medium.slots).toBeGreaterThan(light.slots);
    expect(medium.hp).toBeGreaterThan(light.hp);
    expect(light.slowTurn).toBe(false);
    expect(medium.slowTurn).toBe(true);
  });

  it('the medium chassis really turns slower (a lost round), the light one does not', () => {
    const turns = (chassis: Build['chassis']) => runBattle({ build: build({ chassis }), script: 'turn_left()\nturn_left()\nfire()', layout: layout(['D>.'], 1) });
    expect(turns('light').frames.length).toBeLessThan(turns('medium').frames.length);
  });

  it('treads: armor and rubble are paid for with slow turns; wheels are the fast ones', () => {
    expect(locomotionArmor('treads')).toBeGreaterThan(locomotionArmor('wheels'));
    expect(locomotionArmor('legs')).toBe(0);
  });

  it('the cannon breaks armor that the blaster cannot (its specialty)', () => {
    const armored: LayoutSpec = { map: ['>D'], enemies: [{ hp: 4, armor: 1 }], seed: 1, maxTicks: 12 };
    const win = (b: Build, script: string) => runBattle({ build: b, script, layout: armored }).outcome;
    expect(win(START_BUILD, 'while True:\n    fire()')).toBe('loss');
    expect(win(build({ gear: ['cannon', 'eyes'] }), 'while True:\n    fire(2)')).toBe('win');
  });
});

describe('every challenge, with its reference solution and the default gear', () => {
  /** Challenges that cannot reach the usual window, and why: [min, max] rounds. */
  const exceptions: Record<string, [number, number]> = {
    'first-contact': [2, 30], // the very first lesson: one line, one shot
  };
  for (const e of ENEMIES) {
    it(`${e.id}: won with the default gear in a reasonable number of rounds, without a hard fight`, () => {
      const r = fightEnemy(e, DEFAULT_BUILD, e.solution);
      expect(r.won).toBe(true);
      const rounds = r.fight.battle.frames.length - 1;
      const [min, max] = exceptions[e.id] ?? [3, 30];
      expect(rounds, `${e.id}: ${rounds} rounds`).toBeGreaterThanOrEqual(min);
      expect(rounds, `${e.id}: ${rounds} rounds`).toBeLessThanOrEqual(max);
      // The player keeps at least a third of the hit points.
      expect(r.damage).toBeLessThanOrEqual(CHASSIS.light.hp * (2 / 3));
    });
  }

  it('other builds also win with the same solutions (medium chassis with plates or a shield)', () => {
    for (const gear of [['blaster', 'eyes', 'plates'], ['blaster', 'eyes', 'shield']] as Build['gear'][])
      for (const e of ENEMIES) {
        if (!gear.includes('blaster')) continue; // the reference solutions call fire(): they need the blaster
        const b = build({ chassis: 'medium', gear });
        expect(fightEnemy(e, b, e.solution).won, `${e.id} with ${gear.join('+')}`).toBe(true);
      }
  });
});

describe('enemies ramp gently along the chain', () => {
  const chain = ENEMIES.filter((e) => e.chapter <= 5);
  const top = (e: (typeof ENEMIES)[number]) => Math.max(...e.enemies.map((x) => x.hp));
  it('the strongest enemy gains at most 3 hit points from one challenge to the next', () => {
    chain.forEach((e, i) => {
      if (i > 0) expect(top(e) - top(chain[i - 1]!), `${chain[i - 1]!.id} -> ${e.id}`).toBeLessThanOrEqual(3);
    });
  });
  it('no enemy has more than 8 hit points (the light chassis has 8)', () => {
    for (const e of ENEMIES) expect(top(e), e.id).toBeLessThanOrEqual(CHASSIS.light.hp);
  });
  it('enemies never out-damage the player: a shooting enemy is a blaster, so 1 damage per round', () => {
    for (const e of ENEMIES) for (const d of e.enemies) if (d.script) expect(d.script).not.toMatch(/fire\([2-9]\)|smash/);
  });
});

describe('enemies are not all alike', () => {
  it('a challenge with several enemies never gives all of them the same hit points', () => {
    for (const e of ENEMIES) {
      const hps = e.enemies.map((d) => d.hp);
      if (hps.length > 1) expect(new Set(hps).size, `${e.id}: ${hps.join(',')}`).toBeGreaterThanOrEqual(2);
    }
  });
  it('a walking enemy has at most 2 hit points (it is hard to hit); standing ones carry the big numbers', () => {
    for (const e of ENEMIES) for (const d of e.enemies) if (d.patrol) expect(d.hp, e.id).toBeLessThanOrEqual(2);
    expect(Math.max(...ENEMIES.flatMap((e) => e.enemies.filter((d) => !d.patrol).map((d) => d.hp)))).toBeGreaterThanOrEqual(4);
  });
  it('at most half of all enemy slots of the game have exactly 2 hit points', () => {
    const all = ENEMIES.flatMap((e) => e.enemies.map((d) => d.hp));
    expect(all.filter((hp) => hp === 2).length).toBeLessThanOrEqual(all.length / 2);
  });
});
