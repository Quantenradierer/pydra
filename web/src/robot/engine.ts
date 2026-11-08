/**
 * The deterministic battle engine: a grid, robots with HP, walls, rubble and
 * pits, and a tick that resolves everybody's action at the same time. It knows
 * nothing about Python or parts; those hand it one `Intent` per robot and tick.
 */
import { Rng } from './rng.ts';

export type Dir = 'N' | 'E' | 'S' | 'W';
export const DIRS: readonly Dir[] = ['N', 'E', 'S', 'W'];
export const DELTA: Record<Dir, Pos> = { N: { x: 0, y: -1 }, E: { x: 1, y: 0 }, S: { x: 0, y: 1 }, W: { x: -1, y: 0 } };

export type Tile = 'floor' | 'wall' | 'rubble' | 'pit';

export interface Pos {
  x: number;
  y: number;
}

export const turnRight = (d: Dir): Dir => DIRS[(DIRS.indexOf(d) + 1) % 4]!;
export const turnLeft = (d: Dir): Dir => DIRS[(DIRS.indexOf(d) + 3) % 4]!;
export const opposite = (d: Dir): Dir => DIRS[(DIRS.indexOf(d) + 2) % 4]!;
export const step = (p: Pos, d: Dir, n = 1): Pos => ({ x: p.x + DELTA[d].x * n, y: p.y + DELTA[d].y * n });
export const samePos = (a: Pos, b: Pos): boolean => a.x === b.x && a.y === b.y;

/** The longest battle: after this many ticks it is a loss. */
export const MAX_TICKS = 200;

/** What one robot does in one tick. */
export type Intent =
  | { type: 'wait' }
  /** One step in an absolute direction (wheels work out the direction from the facing). */
  | { type: 'move'; dir: Dir }
  | { type: 'turn'; side: 'left' | 'right' }
  /** A straight shot along the facing; hits the first robot, stopped by walls. */
  | { type: 'shoot'; damage: number; range: number }
  /** A hit on the tile in front. */
  | { type: 'melee'; damage: number }
  | { type: 'shield' }
  /** A lost tick (an action that was not charged); `message` is shown in the replay. */
  | { type: 'fizzle'; message: string };

export interface Robot {
  id: string;
  team: 'player' | 'enemy';
  pos: Pos;
  facing: Dir;
  hp: number;
  maxHp: number;
  /** Whether the locomotion can cross rubble / pits. */
  canCross: { rubble: boolean; pit: boolean };
  /** A raised shield: blocks the next hit of the current tick (see World.step). */
  shieldUp: boolean;
  /** Set by a shield action; becomes `shieldUp` at the end of the tick. */
  shieldPending: boolean;
  hitsTaken: number;
  /** Where the last hit came from, as the side of this robot ("N", "E", ...), or null. */
  lastHit: Dir | null;
}

export type GameEvent =
  | { type: 'shot'; by: string; from: Pos; to: Pos; hit?: string; blocked?: boolean }
  | { type: 'smash'; by: string; at: Pos; hit?: string; blocked?: boolean }
  | { type: 'damage'; robot: string; amount: number }
  | { type: 'bump'; robot: string; reason: 'wall' | 'rubble' | 'pit' | 'robot' | 'edge' }
  | { type: 'shield'; robot: string }
  | { type: 'fizzle'; robot: string; message: string }
  | { type: 'death'; robot: string };

export type Outcome = 'win' | 'loss';

export interface RobotSetup {
  id: string;
  team: 'player' | 'enemy';
  pos: Pos;
  facing: Dir;
  hp: number;
  canCross?: { rubble?: boolean; pit?: boolean };
}

export interface WorldSetup {
  tiles: Tile[][];
  robots: RobotSetup[];
  seed: number;
}

export class World {
  readonly width: number;
  readonly height: number;
  readonly tiles: Tile[][];
  readonly robots: Robot[];
  readonly rng: Rng;
  /** Ticks resolved so far. */
  tick = 0;

  constructor(setup: WorldSetup) {
    this.tiles = setup.tiles.map((row) => [...row]);
    this.height = this.tiles.length;
    this.width = this.tiles[0]?.length ?? 0;
    this.rng = new Rng(setup.seed);
    this.robots = setup.robots.map((r) => ({
      id: r.id,
      team: r.team,
      pos: { ...r.pos },
      facing: r.facing,
      hp: r.hp,
      maxHp: r.hp,
      canCross: { rubble: r.canCross?.rubble ?? false, pit: r.canCross?.pit ?? false },
      shieldUp: false,
      shieldPending: false,
      hitsTaken: 0,
      lastHit: null,
    }));
  }

  robot(id: string): Robot {
    const r = this.robots.find((x) => x.id === id);
    if (!r) throw new Error(`no robot ${id}`);
    return r;
  }

  inside(p: Pos): boolean {
    return p.x >= 0 && p.y >= 0 && p.x < this.width && p.y < this.height;
  }

  /** The tile at a position; everything outside the arena counts as wall. */
  tileAt(p: Pos): Tile {
    return this.inside(p) ? this.tiles[p.y]![p.x]! : 'wall';
  }

  robotAt(p: Pos): Robot | undefined {
    return this.robots.find((r) => r.hp > 0 && samePos(r.pos, p));
  }

  alive(): Robot[] {
    return this.robots.filter((r) => r.hp > 0);
  }

  /** The player's robot (the first of the player team). */
  get player(): Robot {
    return this.robots.find((r) => r.team === 'player')!;
  }

  /** The result once the battle is over: a win needs every enemy down and the player standing; running out of ticks is a loss. */
  outcome(): Outcome | undefined {
    const player = this.robots.filter((r) => r.team === 'player');
    const enemies = this.robots.filter((r) => r.team === 'enemy');
    const playerDown = player.every((r) => r.hp <= 0);
    const enemiesDown = enemies.every((r) => r.hp <= 0);
    if (playerDown) return 'loss';
    if (enemiesDown) return 'win';
    return this.tick >= MAX_TICKS ? 'loss' : undefined;
  }

  /** Whether a robot may enter a tile (ignoring other robots). */
  passable(robot: Robot, p: Pos): true | 'edge' | 'wall' | 'rubble' | 'pit' {
    if (!this.inside(p)) return 'edge';
    const tile = this.tileAt(p);
    if (tile === 'floor') return true;
    if (tile === 'rubble') return robot.canCross.rubble ? true : 'rubble';
    if (tile === 'pit') return robot.canCross.pit ? true : 'pit';
    return 'wall';
  }

  /**
   * What the first thing ahead of `from` in direction `dir` is, up to `range`
   * tiles: a robot, "wall" (also the arena edge), "rubble" or null for nothing.
   * Pits are not an obstacle. `distance` counts tiles to it (1 = adjacent).
   */
  ahead(from: Pos, dir: Dir, range: number, ignore?: Robot): { what: 'enemy' | 'robot' | 'wall' | 'rubble'; distance: number; robot?: Robot } | null {
    for (let d = 1; d <= range; d++) {
      const p = step(from, dir, d);
      const tile = this.tileAt(p);
      if (tile === 'wall') return { what: 'wall', distance: d };
      const robot = this.robotAt(p);
      if (robot && robot !== ignore) return { what: ignore && robot.team !== ignore.team ? 'enemy' : 'robot', distance: d, robot };
      if (tile === 'rubble') return { what: 'rubble', distance: d };
    }
    return null;
  }

  /**
   * Resolves one tick. Order: turns, then moves (a move into a tile that is
   * wall, edge, impassable, taken by a robot that stays, or wanted by another
   * robot fails), then all attacks against the new positions, applied at the
   * same time. A shield blocks one hit.
   */
  step(intents: ReadonlyMap<string, Intent>): GameEvent[] {
    const events: GameEvent[] = [];
    const live = this.alive();
    const intentOf = (r: Robot): Intent => intents.get(r.id) ?? { type: 'wait' };

    // Turns and shields.
    for (const r of live) {
      const i = intentOf(r);
      if (i.type === 'turn') r.facing = i.side === 'left' ? turnLeft(r.facing) : turnRight(r.facing);
      else if (i.type === 'shield') {
        r.shieldPending = true;
        events.push({ type: 'shield', robot: r.id });
      } else if (i.type === 'fizzle') events.push({ type: 'fizzle', robot: r.id, message: i.message });
    }

    // Moves.
    const wants = new Map<Robot, Pos>();
    for (const r of live) {
      const i = intentOf(r);
      if (i.type !== 'move') continue;
      const target = step(r.pos, i.dir);
      const ok = this.passable(r, target);
      if (ok !== true) events.push({ type: 'bump', robot: r.id, reason: ok });
      else wants.set(r, target);
    }
    let changed = true;
    while (changed) {
      changed = false;
      for (const [r, target] of [...wants]) {
        const blocker = live.find((o) => o !== r && samePos(o.pos, target) && !wants.has(o));
        const rival = [...wants].find(([o, t]) => o !== r && samePos(t, target));
        const swap = [...wants].find(([o, t]) => o !== r && samePos(t, r.pos) && samePos(o.pos, target));
        if (blocker || rival || swap) {
          wants.delete(r);
          if (rival) wants.delete(rival[0]);
          events.push({ type: 'bump', robot: r.id, reason: 'robot' });
          changed = true;
        }
      }
    }
    for (const [r, target] of wants) r.pos = target;

    // Attacks, resolved against the positions after the moves.
    const damage = new Map<Robot, { amount: number; from: Dir }>();
    const hit = (target: Robot, amount: number, from: Dir): boolean => {
      if (target.shieldUp) {
        target.shieldUp = false;
        return false;
      }
      const old = damage.get(target);
      damage.set(target, { amount: (old?.amount ?? 0) + amount, from: old?.from ?? from });
      return true;
    };
    for (const r of live) {
      const i = intentOf(r);
      if (i.type === 'shoot') {
        const found = this.ahead(r.pos, r.facing, i.range, r);
        const reach = found ? found.distance : i.range;
        const to = step(r.pos, r.facing, found?.what === 'wall' ? Math.max(found.distance - 1, 0) : reach);
        if (found?.robot) {
          const landed = hit(found.robot, i.damage, opposite(r.facing));
          events.push({ type: 'shot', by: r.id, from: r.pos, to, hit: found.robot.id, ...(landed ? {} : { blocked: true }) });
        } else events.push({ type: 'shot', by: r.id, from: r.pos, to });
      } else if (i.type === 'melee') {
        const at = step(r.pos, r.facing);
        const target = this.robotAt(at);
        if (target) {
          const landed = hit(target, i.damage, opposite(r.facing));
          events.push({ type: 'smash', by: r.id, at, hit: target.id, ...(landed ? {} : { blocked: true }) });
        } else events.push({ type: 'smash', by: r.id, at });
      }
    }
    for (const [target, { amount, from }] of damage) {
      target.hp = Math.max(0, target.hp - amount);
      target.hitsTaken++;
      target.lastHit = from;
      events.push({ type: 'damage', robot: target.id, amount });
      if (target.hp === 0) events.push({ type: 'death', robot: target.id });
    }

    // Shields: a raised one lasts through this tick only; a pending one rises for the next.
    for (const r of this.robots) {
      r.shieldUp = r.shieldPending;
      r.shieldPending = false;
    }
    this.tick++;
    return events;
  }
}
