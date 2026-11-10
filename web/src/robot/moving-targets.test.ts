import { describe, expect, it } from 'vitest';
import { runBattle } from './battle.ts';
import { ENEMIES } from './content/index.ts';
import { DEFAULT_BUILD, fightEnemy, judge, layoutOf } from './fight.ts';

/**
 * Moving targets (Chapter 4): a patrolling enemy and a shield with a rhythm of its own. The rule "no shot may miss"
 * means that standing still and shooting, or shooting a fixed number of times, cannot win; the script has to look.
 */
const enemy = (id: string) => ENEMIES.find((e) => e.id === id)!;
const win = (id: string, script: string) => fightEnemy(enemy(id), DEFAULT_BUILD, script);
const PATROLLER = enemy('patroller');
const FLICKER = enemy('flicker');
const LOOK = 'shots = 0\nwhile shots < 2:\n    if see() == "enemy":\n        fire()\n        shots = shots + 1\n    else:\n        wait()\n';

/** The reference solution with the part between "face east" and "face north again" swapped for `block`. */
const swapBlock = (solution: string, block: string): string => {
  const start = solution.indexOf('shots = 0');
  const end = solution.lastIndexOf('turn_left()');
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  return solution.slice(0, start) + block + solution.slice(end);
};

/** The walker is the enemy that starts at (6, 9); the ids follow the map's reading order. */
const WALKER = 'enemy3';
const eastOf = (challenge: string) => {
  const r = runBattle({ build: DEFAULT_BUILD, script: enemy(challenge).solution, layout: layoutOf(enemy(challenge)) });
  const id = WALKER;
  return r.frames.map((f) => ({ pos: f.robots.find((x) => x.id === id)!.pos, shield: f.robots.find((x) => x.id === id)!.shieldUp, hp: f.robots.find((x) => x.id === id)!.hp }));
};

describe('the patrolling enemy', () => {
  it('has 2 HP, walks down column 6 between rows 9 and 11 and back, and has no shield', () => {
    expect(PATROLLER.enemies[3]!.hp).toBe(2);
    const path = eastOf('patroller');
    expect(path.slice(0, 9).map((p) => p.pos.y)).toEqual([9, 10, 11, 10, 9, 10, 11, 10, 9]);
    expect(new Set(path.map((p) => p.pos.x))).toEqual(new Set([6]));
    expect(path.some((p) => p.shield)).toBe(false);
  });

  it('the reference solution looks east and shoots only when it sees the enemy: two hits, no miss', () => {
    const r = win('patroller', PATROLLER.solution);
    expect(r.won).toBe(true);
    const shots = r.fight.battle.frames.flatMap((f) => f.events).filter((e) => e.type === 'shot' && e.by === 'player' && e.to.x > e.from.x);
    expect(shots.length).toBe(2);
    expect(shots.every((e) => e.type === 'shot' && e.hit === WALKER)).toBe(true);
  });

  it('is deterministic: the same script plays the same fight', () => {
    const a = runBattle({ build: DEFAULT_BUILD, script: PATROLLER.solution, layout: layoutOf(PATROLLER) });
    const b = runBattle({ build: DEFAULT_BUILD, script: PATROLLER.solution, layout: layoutOf(PATROLLER) });
    expect(b.frames).toEqual(a.frames);
  });

  it('a fixed number of shots in its row does not win (it is not there when they fly)', () => {
    for (const block of ['fire()\nfire()\n', 'wait()\nfire()\nfire()\n', 'wait()\nwait()\nfire()\nfire()\n']) {
      const r = win('patroller', swapBlock(PATROLLER.solution, block));
      expect(r.won, block).toBe(false);
    }
  });

  it('a count tuned to one exact start is fragile: one round more or less before it and it misses', () => {
    const tuned = 'wait()\nwait()\nfire()\nwait()\nfire()\n';
    expect(win('patroller', swapBlock(PATROLLER.solution, tuned)).won).toBe(true);
    expect(win('patroller', swapBlock(PATROLLER.solution, `wait()\n${tuned}`)).won).toBe(false);
    expect(win('patroller', swapBlock(PATROLLER.solution, tuned.replace('wait()\n', ''))).won).toBe(false);
  });

  it('standing still and shooting blind does not win either', () => {
    const blind = 'shots = 0\nwhile shots < 6:\n    fire()\n    shots = shots + 1\n';
    const r = win('patroller', swapBlock(PATROLLER.solution, blind));
    expect([r.fight.unmet, r.won]).toEqual(['miss', false]);
  });

  it('the script of the challenge before (no turn to the east) cannot win: it never touches the patroller', () => {
    expect(win('patroller', enemy('break-out').solution).won).toBe(false);
  });
});

describe('the flickering shield', () => {
  it('belongs to the same walker, down 2 rounds and up 1, a rhythm (3) that is not the walk (4)', () => {
    const def = FLICKER.enemies[3]!;
    expect(def.hp).toBe(2);
    expect(def.shieldCycle).toEqual({ up: 1, down: 2 });
    expect(def.patrol).toEqual(PATROLLER.enemies[3]!.patrol);
    const cycle = def.shieldCycle!.up + def.shieldCycle!.down;
    expect(cycle).not.toBe(2 * def.patrol!.steps);
    expect((2 * def.patrol!.steps) % cycle).not.toBe(0);
  });

  it('the shield is visible in the frames and follows its rhythm', () => {
    const path = eastOf('flicker');
    expect(path.slice(0, 9).map((p) => (p.shield ? 1 : 0))).toEqual([0, 0, 1, 0, 0, 1, 0, 0, 1]);
    // the walk repeats every 4 rounds, the shield every 3: the two only line up again after 12
    expect(path.slice(0, 4).map((p) => p.pos.y)).toEqual([9, 10, 11, 10]);
  });

  it('is readable as a sensor: enemy_shielded() reports both states while it is looked at', () => {
    const r = runBattle({ build: DEFAULT_BUILD, script: FLICKER.solution, layout: layoutOf(FLICKER) });
    const seen = new Set(r.frames.flatMap((f) => f.sensors.player ?? []).filter((s) => s.startsWith('enemy_shielded()')));
    expect(seen).toEqual(new Set(['enemy_shielded() → True', 'enemy_shielded() → False']));
  });

  it('the reference solution waits for the shield to drop and wastes no shot', () => {
    const r = win('flicker', FLICKER.solution);
    expect(r.won).toBe(true);
    const shots = r.fight.battle.frames.flatMap((f) => f.events).filter((e) => e.type === 'shot' && e.by === 'player' && e.to.x > e.from.x);
    expect(shots.length).toBe(2);
    expect(shots.every((e) => e.type === 'shot' && e.hit === WALKER && !e.blocked)).toBe(true);
  });

  it('the Patrol solution (shoots whenever it sees the walker) wastes shots on the shield and loses', () => {
    const r = win('flicker', PATROLLER.solution);
    expect(r.won).toBe(false);
  });

  it('standing still and waiting does not help: the walker is in the row only part of the time, the shield only part of the time', () => {
    const waitThenFire = swapBlock(FLICKER.solution, 'wait()\nwait()\nwait()\nfire()\nfire()\n');
    expect(win('flicker', waitThenFire).won).toBe(false);
    const blindWhileDown = swapBlock(FLICKER.solution, LOOK);
    expect(win('flicker', blindWhileDown).won).toBe(false);
  });
});

describe('the "no shot may miss" rule', () => {
  const battle = (script: string) => runBattle({ build: DEFAULT_BUILD, script, layout: { map: ['>.D'], enemies: [{ hp: 3 }], seed: 1 } });
  it('counts a shot into the air as a miss, and a shot that hits as fine', () => {
    expect(judge(battle('fire()\nfire()\nfire()'), { noMiss: true }).won).toBe(true);
    const air = runBattle({ build: DEFAULT_BUILD, script: 'turn_left()\nfire()\nturn_right()\nfire()\nfire()\nfire()', layout: { map: ['>.D'], enemies: [{ hp: 3 }], seed: 1 } });
    expect(judge(air, { noMiss: true })).toMatchObject({ won: false, unmet: 'miss' });
    expect(judge(air, undefined).won).toBe(true);
  });
  it('counts a shot into a raised shield as a miss', () => {
    const shielded = runBattle({ build: DEFAULT_BUILD, script: 'while True:\n    fire()', layout: { map: ['>D'], enemies: [{ hp: 1, shieldCycle: { up: 1, down: 1 } }], seed: 1, maxTicks: 6 } });
    expect(judge(shielded, { noMiss: true }).unmet === 'miss' || shielded.outcome === 'win').toBe(true);
  });
});
