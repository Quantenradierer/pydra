import { describe, expect, it } from 'vitest';
import { MAX_TICKS, World, type Intent, type WorldSetup } from './engine.ts';
import { buildLayout, mirrorMap, parseMap } from './layout.ts';
import { Rng } from './rng.ts';

const world = (rows: string[], extra: Partial<WorldSetup> = {}, hp = 3) => {
  const m = parseMap(rows);
  return new World({
    tiles: m.tiles,
    seed: 1,
    robots: [
      { id: 'player', team: 'player', pos: m.player.pos, facing: m.player.facing, hp: 10 },
      ...m.enemies.map((e, i) => ({ id: `enemy${i + 1}`, team: 'enemy' as const, pos: e.pos, facing: 'S' as const, hp })),
    ],
    ...extra,
  });
};
const intents = (o: Record<string, Intent>) => new Map(Object.entries(o));

describe('Rng', () => {
  it('repeats for the same seed and differs for another', () => {
    const a = new Rng(7);
    const b = new Rng(7);
    const seq = (r: Rng) => Array.from({ length: 5 }, () => r.int(100));
    expect(seq(a)).toEqual(seq(b));
    expect(seq(new Rng(8))).not.toEqual(seq(new Rng(7)));
  });

  it('stays in range and shuffles without losing items', () => {
    const r = new Rng(3);
    for (let i = 0; i < 100; i++) expect(r.between(2, 4)).toBeGreaterThanOrEqual(2);
    expect(r.shuffle([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
  });
});

describe('parseMap', () => {
  it('reads tiles, the player and its facing, and enemies', () => {
    const m = parseMap(['#.~o', '^.D2']);
    expect(m.tiles[0]).toEqual(['wall', 'floor', 'rubble', 'pit']);
    expect(m.player).toEqual({ pos: { x: 0, y: 1 }, facing: 'N' });
    expect(m.enemies).toEqual([
      { def: 0, pos: { x: 2, y: 1 } },
      { def: 1, pos: { x: 3, y: 1 } },
    ]);
  });

  it('rejects maps without a player, unknown symbols and ragged rows', () => {
    expect(() => parseMap(['...'])).toThrow();
    expect(() => parseMap(['^?'])).toThrow();
    expect(() => parseMap(['^..', '..'])).toThrow();
  });

  it('mirrors left to right, swapping the facing', () => {
    expect(mirrorMap(['>.#', 'D..'])).toEqual(['#.<', '..D']);
  });
});

describe('movement', () => {
  it('moves one tile and turns', () => {
    const w = world(['>...']);
    w.step(intents({ player: { type: 'move', dir: 'E' } }));
    expect(w.player.pos).toEqual({ x: 1, y: 0 });
    w.step(intents({ player: { type: 'turn', side: 'left' } }));
    expect(w.player.facing).toBe('N');
    expect(w.tick).toBe(2);
  });

  it('is stopped by walls, the edge, rubble and pits', () => {
    const w = world(['>#~o']);
    expect(w.step(intents({ player: { type: 'move', dir: 'E' } }))).toContainEqual({ type: 'bump', robot: 'player', reason: 'wall' });
    expect(w.player.pos.x).toBe(0);
    expect(w.step(intents({ player: { type: 'move', dir: 'W' } }))).toContainEqual({ type: 'bump', robot: 'player', reason: 'edge' });
    const r = world(['>~o']);
    expect(r.step(intents({ player: { type: 'move', dir: 'E' } }))).toContainEqual({ type: 'bump', robot: 'player', reason: 'rubble' });
    r.player.canCross.rubble = true;
    r.step(intents({ player: { type: 'move', dir: 'E' } }));
    expect(r.player.pos.x).toBe(1);
    expect(r.step(intents({ player: { type: 'move', dir: 'E' } }))).toContainEqual({ type: 'bump', robot: 'player', reason: 'pit' });
  });

  it('does not let robots share a tile, run through each other or swap', () => {
    const w = world(['>D']);
    w.step(intents({ player: { type: 'move', dir: 'E' } }));
    expect(w.player.pos.x).toBe(0);
    w.step(intents({ player: { type: 'move', dir: 'E' }, enemy1: { type: 'move', dir: 'W' } }));
    expect([w.player.pos.x, w.robot('enemy1').pos.x]).toEqual([0, 1]);
    const meet = world(['>.D']);
    meet.step(intents({ player: { type: 'move', dir: 'E' }, enemy1: { type: 'move', dir: 'W' } }));
    expect([meet.player.pos.x, meet.robot('enemy1').pos.x]).toEqual([0, 2]);
  });

  it('lets a robot follow one that moves away', () => {
    const w = world(['>D.']);
    w.step(intents({ player: { type: 'move', dir: 'E' }, enemy1: { type: 'move', dir: 'E' } }));
    expect([w.player.pos.x, w.robot('enemy1').pos.x]).toEqual([1, 2]);
  });
});

describe('attacks', () => {
  it('a shot hits the first robot in line within range, walls stop it', () => {
    const w = world(['>..D']);
    const events = w.step(intents({ player: { type: 'shoot', damage: 1, range: 5 } }));
    expect(w.robot('enemy1').hp).toBe(2);
    expect(events).toContainEqual({ type: 'shot', by: 'player', from: { x: 0, y: 0 }, to: { x: 3, y: 0 }, hit: 'enemy1' });
    const far = world(['>......D']);
    far.step(intents({ player: { type: 'shoot', damage: 1, range: 5 } }));
    expect(far.robot('enemy1').hp).toBe(3);
    const walled = world(['>.#D']);
    walled.step(intents({ player: { type: 'shoot', damage: 1, range: 5 } }));
    expect(walled.robot('enemy1').hp).toBe(3);
  });

  it('hits are simultaneous: both can fall in the same tick', () => {
    const w = world(['>D'], {}, 1);
    w.player.hp = 1;
    w.robot('enemy1').facing = 'W';
    const events = w.step(intents({ player: { type: 'shoot', damage: 1, range: 5 }, enemy1: { type: 'shoot', damage: 1, range: 5 } }));
    expect(events.filter((e) => e.type === 'death')).toHaveLength(2);
    expect(w.outcome()).toBe('loss');
  });

  it('a melee hit reaches only the adjacent tile', () => {
    const w = world(['>D']);
    w.step(intents({ player: { type: 'melee', damage: 3 } }));
    expect(w.robot('enemy1').hp).toBe(0);
    expect(w.outcome()).toBe('win');
    const far = world(['>.D']);
    far.step(intents({ player: { type: 'melee', damage: 3 } }));
    expect(far.robot('enemy1').hp).toBe(3);
  });

  it('a shield, raised the tick before, blocks one hit and then drops', () => {
    const w = world(['>D']);
    w.robot('enemy1').facing = 'W';
    w.step(intents({ enemy1: { type: 'shield' } }));
    expect(w.robot('enemy1').shieldUp).toBe(true);
    const events = w.step(intents({ player: { type: 'shoot', damage: 1, range: 5 } }));
    expect(events).toContainEqual(expect.objectContaining({ type: 'shot', blocked: true }));
    expect(w.robot('enemy1').hp).toBe(3);
    expect(w.robot('enemy1').shieldUp).toBe(false);
    w.step(intents({ player: { type: 'shoot', damage: 1, range: 5 } }));
    expect(w.robot('enemy1').hp).toBe(2);
  });

  it('records who hit from where', () => {
    const w = world(['D.>'], {}, 3);
    w.player.facing = 'W';
    w.robot('enemy1').facing = 'E';
    w.step(intents({ enemy1: { type: 'shoot', damage: 2, range: 5 } }));
    expect(w.player.hp).toBe(8);
    expect(w.player.lastHit).toBe('W');
    expect(w.player.hitsTaken).toBe(1);
  });
});

describe('ahead', () => {
  it('names the first thing ahead and its distance', () => {
    const w = world(['>..~.D']);
    expect(w.ahead(w.player.pos, 'E', 5, w.player)).toEqual({ what: 'rubble', distance: 3 });
    expect(w.ahead(w.player.pos, 'W', 5, w.player)).toEqual({ what: 'wall', distance: 1 });
    expect(w.ahead({ x: 4, y: 0 }, 'E', 5, w.player)).toMatchObject({ what: 'enemy', distance: 1 });
    expect(w.ahead({ x: 0, y: 0 }, 'E', 2, w.player)).toBeNull();
  });
});

describe('outcome', () => {
  it('is undecided, then a loss when the ticks run out', () => {
    const w = world(['>D']);
    expect(w.outcome()).toBeUndefined();
    for (let i = 0; i < MAX_TICKS; i++) w.step(new Map());
    expect(w.outcome()).toBe('loss');
  });

  it('is a loss when the player is down, a win when the enemies are', () => {
    const w = world(['>D']);
    w.player.hp = 0;
    expect(w.outcome()).toBe('loss');
  });
});

describe('buildLayout', () => {
  const spec = { map: ['>..D', '....'], enemies: [{ hp: 2 }], seed: 5, mirror: true };

  it('is the same for the same seed and may mirror for another', () => {
    const a = buildLayout(spec, 8, { canCross: { rubble: false, pit: false } });
    const b = buildLayout(spec, 8, { canCross: { rubble: false, pit: false } });
    expect(a).toEqual(b);
    const sides = new Set(Array.from({ length: 12 }, (_, seed) => buildLayout({ ...spec, seed }, 8, { canCross: { rubble: false, pit: false } }).mirrored));
    expect(sides).toEqual(new Set([true, false]));
  });

  it('makes enemies face the player by default and gives them their hp', () => {
    const l = buildLayout({ ...spec, mirror: false }, 8, { canCross: { rubble: false, pit: false } });
    expect(l.setup.robots[1]).toMatchObject({ id: 'enemy1', facing: 'W', hp: 2 });
    expect(l.setup.robots[0]).toMatchObject({ id: 'player', hp: 8 });
  });
});

describe('patrol: an enemy that walks a fixed path back and forth', () => {
  const patrolWorld = (patrol: { dir: 'N' | 'E' | 'S' | 'W'; steps: number; every?: number }, rows = ['.....', '.....', '..^..', '.....', 'D....']) => {
    const w = world(rows, {}, 2);
    w.robot('enemy1').patrol = { heading: patrol.dir, steps: patrol.steps, every: patrol.every ?? 1, done: 0 };
    return w;
  };
  const path = (w: World, n: number) => Array.from({ length: n }, () => (w.step(intents({})), { ...w.robot('enemy1').pos }));

  it('walks `steps` tiles, turns around, walks back, and repeats', () => {
    const w = patrolWorld({ dir: 'E', steps: 3 });
    expect(path(w, 8).map((p) => p.x)).toEqual([1, 2, 3, 2, 1, 0, 1, 2]);
  });

  it('with `circle` it walks a square: a right turn after `steps` tiles', () => {
    const w = patrolWorld({ dir: 'E', steps: 1 }, ['.....', '.D...', '.....', '..^..', '.....']);
    w.robot('enemy1').patrol!.circle = true;
    expect(path(w, 5).map((p) => `${p.x},${p.y}`)).toEqual(['2,1', '2,2', '1,2', '1,1', '2,1']);
  });

  it('moves only every `every` rounds', () => {
    const w = patrolWorld({ dir: 'E', steps: 2, every: 3 });
    expect(path(w, 7).map((p) => p.x)).toEqual([0, 0, 1, 1, 1, 2, 2]);
  });

  it('is built from the setup (EnemyDef patrol)', () => {
    const m = parseMap(['^..', '...', 'D..']);
    const w = new World({ tiles: m.tiles, seed: 1, robots: [{ id: 'player', team: 'player', pos: m.player.pos, facing: 'N', hp: 5 }, { id: 'enemy1', team: 'enemy', pos: m.enemies[0]!.pos, facing: 'N', hp: 2, patrol: { dir: 'E', steps: 2 } }] });
    w.step(intents({}));
    expect(w.robot('enemy1').pos).toEqual({ x: 1, y: 2 });
  });

  it('turns around at once in front of a wall or a robot, and stops when it is dead', () => {
    const w = patrolWorld({ dir: 'E', steps: 9 }, ['^....', '.....', '.....', '.....', 'D.#..']);
    expect(path(w, 4).map((p) => p.x)).toEqual([1, 0, 1, 0]);
    const dead = patrolWorld({ dir: 'E', steps: 3 }, ['>.D..']);
    dead.robot('enemy1').patrol = { heading: 'E', steps: 3, every: 1, done: 0 };
    dead.robot('enemy1').hp = 0;
    dead.step(intents({}));
    expect(dead.robot('enemy1').pos).toEqual({ x: 2, y: 0 });
  });

  it('moves after the attacks of the round: a shot at the tile it stands on hits it', () => {
    const w = world(['>.D..'], {}, 2);
    w.robot('enemy1').patrol = { heading: 'E', steps: 2, every: 1, done: 0 };
    const ev = w.step(intents({ player: { type: 'shoot', damage: 1, range: 5 } }));
    expect(ev.some((e) => e.type === 'shot' && e.hit === 'enemy1')).toBe(true);
    expect(w.robot('enemy1').hp).toBe(1);
    expect(w.robot('enemy1').pos).toEqual({ x: 3, y: 0 });
  });

  it('is deterministic', () => {
    const a = path(patrolWorld({ dir: 'N', steps: 2 }), 12);
    const b = path(patrolWorld({ dir: 'N', steps: 2 }), 12);
    expect(a).toEqual(b);
  });
});

describe('shield cycle: an enemy shield that comes and goes on its own', () => {
  const cycleWorld = (up: number, down: number) => {
    const w = world(['>D'], {}, 3);
    w.robot('enemy1').cycle = { up, down };
    w.robot('enemy1').shieldUp = false;
    return w;
  };
  const states = (w: World, n: number) => Array.from({ length: n }, () => ((w.step(intents({})), w.robot('enemy1').shieldUp)));

  it('is down for `down` rounds, then up for `up` rounds, and repeats', () => {
    // state after round t is the state during round t+1
    expect(states(cycleWorld(3, 2), 10)).toEqual([false, true, true, true, false, false, true, true, true, false]);
  });

  it('starts as the setup defines (down first)', () => {
    const m = parseMap(['>D']);
    const w = new World({ tiles: m.tiles, seed: 1, robots: [{ id: 'player', team: 'player', pos: m.player.pos, facing: 'E', hp: 5 }, { id: 'enemy1', team: 'enemy', pos: m.enemies[0]!.pos, facing: 'W', hp: 2, shieldCycle: { up: 2, down: 3 } }] });
    expect(w.robot('enemy1').shieldUp).toBe(false);
  });

  it('blocks every shot while it is up (it is not used up) and takes shots while it is down', () => {
    const w = cycleWorld(3, 2);
    const shoot = { player: { type: 'shoot', damage: 1, range: 5 } as Intent };
    w.step(intents(shoot)); // rounds 1 and 2: down -> hits
    w.step(intents(shoot));
    expect(w.robot('enemy1').hp).toBe(1);
    const blocked: boolean[] = [];
    for (let i = 0; i < 3; i++) {
      const ev = w.step(intents(shoot));
      blocked.push(ev.some((e) => e.type === 'shot' && e.blocked === true));
      if (i < 2) expect(w.robot('enemy1').shieldUp).toBe(true); // a block does not use it up
    }
    expect(blocked).toEqual([true, true, true]);
    expect(w.robot('enemy1').hp).toBe(1);
  });

  it('is deterministic and independent of the patrol period', () => {
    const run = () => {
      const w = world(['>D...'], {}, 2);
      w.robot('enemy1').cycle = { up: 3, down: 2 };
      w.robot('enemy1').patrol = { heading: 'E', steps: 4, every: 1, done: 0 };
      return Array.from({ length: 20 }, () => (w.step(intents({})), `${w.robot('enemy1').pos.x}${w.robot('enemy1').shieldUp ? 'S' : '-'}`)).join(' ');
    };
    expect(run()).toBe(run());
    // patrol period 8, shield period 5: the pattern only repeats after 40 rounds
    expect(run().split(' ').slice(0, 8).join()).not.toBe(run().split(' ').slice(8, 16).join());
  });
});
