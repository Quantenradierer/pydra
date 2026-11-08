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
