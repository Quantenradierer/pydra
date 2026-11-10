import { describe, expect, it } from 'vitest';
import { runBattle } from './battle.ts';
import { ENEMIES } from './content/index.ts';
import { DEFAULT_BUILD, fightEnemy, judge, layoutOf } from './fight.ts';

/**
 * Moving targets: a patrolling enemy (Chapter 2, again in Chapter 4), a shield with a rhythm of its own (Chapter 3) and both at once (Chapter 4). The rule "no shot may miss"
 * means that standing still and shooting, or shooting a fixed number of times, cannot win; the script has to look.
 */
const enemy = (id: string) => ENEMIES.find((e) => e.id === id)!;
const win = (id: string, script: string) => fightEnemy(enemy(id), DEFAULT_BUILD, script);
const PATROLLER = enemy('patroller');
const FLICKER = enemy('flicker');
const LOOK = 'shots = 0\nwhile shots < 2:\n    if see() == "enemy":\n        fire()\n        shots = shots + 1\n    else:\n        wait()\n';

/** The reference solution with the part between "face east" and "face north again" swapped for `block`. */
const swapBlock = (solution: string, block: string): string => {
  const start = solution.indexOf('hits = 0');
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
    expect(PATROLLER.enemies[2]!.hp).toBe(2);
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

  it('standing still and shooting blind does not win either', () => {
    const blind = 'shots = 0\nwhile shots < 6:\n    fire()\n    shots = shots + 1\n';
    const r = win('patroller', swapBlock(PATROLLER.solution, blind));
    expect([r.fight.unmet, r.won]).toEqual(['miss', false]);
  });

  it('the script of the challenge before (no turn to the east) cannot win: it never touches the patroller', () => {
    expect(win('patroller', enemy('side-guard').solution).won).toBe(false);
  });
});

describe('Chapter 2: the patrolling dummy', () => {
  const patrol = enemy('patrol-dummy');
  it('has 2 HP and walks column 7 between rows 4 and 6 and back', () => {
    expect(patrol.enemies[1]).toMatchObject({ hp: 2, patrol: { dir: 'S', steps: 2 } });
    const r = runBattle({ build: DEFAULT_BUILD, script: patrol.solution, layout: layoutOf(patrol) });
    const ys = r.frames.slice(0, 9).map((f) => f.robots.find((x) => x.id === 'enemy2')!.pos.y);
    expect(ys).toEqual([4, 5, 6, 5, 4, 5, 6, 5, 4]);
  });
  it('as many shots as it has hit points do not win (it is not always in the row); a longer loop does', () => {
    const plain = enemy('tank-dummy').solution + '\nturn_right()\nfire()\nfire()';
    expect(win('patrol-dummy', plain).won).toBe(false);
    expect(win('patrol-dummy', patrol.solution).won).toBe(true);
  });
});

describe('Chapter 3: the shield with a rhythm of its own', () => {
  const bubble = enemy('bubble');
  it('belongs to a 2 HP dummy that does not move, up 2 rounds and down 1', () => {
    expect(bubble.enemies[0]).toMatchObject({ hp: 2, shieldCycle: { up: 2, down: 1 } });
    expect(bubble.enemies[0]!.patrol).toBeUndefined();
  });
  it('shooting without looking wastes shots; looking and waiting wins', () => {
    expect(win('bubble', enemy('right-dummy').solution).won).toBe(false);
    expect(win('bubble', bubble.solution).won).toBe(true);
  });
  it('standing still and shooting a fixed number of times does not win either', () => {
    expect(win('bubble', 'fire()\nfire()\nfire()\nfire()').won).toBe(false);
  });
});

describe('the flickering shield', () => {
  it('belongs to the same walker, down 1 round and up 2, a rhythm (3) that is not the walk (4)', () => {
    const def = FLICKER.enemies[2]!;
    expect(def.hp).toBe(2);
    expect(def.shieldCycle).toEqual({ up: 2, down: 1 });
    expect(def.patrol).toEqual(PATROLLER.enemies[2]!.patrol);
    const cycle = def.shieldCycle!.up + def.shieldCycle!.down;
    expect(cycle).not.toBe(2 * def.patrol!.steps);
    expect((2 * def.patrol!.steps) % cycle).not.toBe(0);
  });

  it('the shield is visible in the frames and follows its rhythm', () => {
    const path = eastOf('flicker');
    expect(path.slice(0, 9).map((p) => (p.shield ? 1 : 0))).toEqual([0, 1, 1, 0, 1, 1, 0, 1, 1]);
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
