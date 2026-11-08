import { DELTA, type Dir, type Pos, type RobotSetup, type Tile, type WorldSetup } from './engine.ts';
import { Rng } from './rng.ts';

/** An enemy as the data files describe it; the digit (or `D`) in the map picks it. */
export interface EnemyDef {
  hp: number;
  armor?: number;
  /** Facing; defaults to the side that faces the player. */
  face?: Dir;
  /** Parts: gear object names, locomotion. Enemies use the same parts as the player. */
  locomotion?: 'wheels' | 'legs';
  gear?: string[];
  /** The enemy's Python script (same API as the player's); none = a dummy. */
  script?: string;
}

const PLAYER_FACING: Record<string, Dir> = { '^': 'N', '>': 'E', v: 'S', '<': 'W' };

export interface ParsedMap {
  tiles: Tile[][];
  player: { pos: Pos; facing: Dir };
  enemies: { def: number; pos: Pos }[];
}

/**
 * Reads an ASCII map. `.` floor, `#` wall, `~` rubble, `o` pit; the player is
 * `^ > v <` (its facing); `D` is the first enemy definition, `1`-`9` the
 * n-th. Tiles under a robot are floor.
 */
export function parseMap(rows: readonly string[]): ParsedMap {
  const tiles: Tile[][] = [];
  let player: ParsedMap['player'] | undefined;
  const enemies: ParsedMap['enemies'] = [];
  rows.forEach((row, y) => {
    tiles.push(
      [...row].map((ch, x): Tile => {
        if (ch === '#') return 'wall';
        if (ch === '~') return 'rubble';
        if (ch === 'o') return 'pit';
        if (ch in PLAYER_FACING) player = { pos: { x, y }, facing: PLAYER_FACING[ch]! };
        else if (ch === 'D') enemies.push({ def: 0, pos: { x, y } });
        else if (/[1-9]/.test(ch)) enemies.push({ def: Number(ch) - 1, pos: { x, y } });
        else if (ch !== '.') throw new Error(`unknown map symbol ${JSON.stringify(ch)}`);
        return 'floor';
      }),
    );
  });
  if (!player) throw new Error('map has no player');
  if (new Set(rows.map((r) => r.length)).size > 1) throw new Error('map rows differ in length');
  return { tiles, player, enemies };
}

/** Mirrors a map left to right (the seeded "side" of a layout). */
export function mirrorMap(rows: readonly string[]): string[] {
  const flip: Record<string, string> = { '>': '<', '<': '>' };
  return rows.map((row) => [...row].reverse().map((ch) => flip[ch] ?? ch).join(''));
}

const MIRROR: Record<Dir, Dir> = { N: 'N', S: 'S', E: 'W', W: 'E' };

/** The facing of an enemy that looks at the player along the longer axis. */
function towards(from: Pos, to: Pos): Dir {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : dy > 0 ? 'S' : 'N';
}

/** A fight to set up: one map variant, the enemy definitions and a seed (which may mirror the map). */
export interface LayoutSpec {
  map: readonly string[];
  enemies: readonly EnemyDef[];
  seed: number;
  maxTicks?: number;
  /** Whether the seed may mirror the map left to right. */
  mirror?: boolean;
}

export interface BuiltLayout {
  setup: WorldSetup;
  mapRows: string[];
  mirrored: boolean;
  enemyDefs: EnemyDef[];
  /** The index of each enemy's definition, by robot id ("enemy1", ...). */
  defOf: Record<string, EnemyDef>;
}

export function buildLayout(spec: LayoutSpec, playerHp: number, player: { canCross: { rubble: boolean; pit: boolean } }): BuiltLayout {
  const rng = new Rng(spec.seed);
  const mirrored = spec.mirror === true && rng.chance(0.5);
  const rows = mirrored ? mirrorMap(spec.map) : [...spec.map];
  const parsed = parseMap(rows);
  const robots: RobotSetup[] = [
    { id: 'player', team: 'player', pos: parsed.player.pos, facing: parsed.player.facing, hp: playerHp, canCross: player.canCross },
  ];
  const defOf: Record<string, EnemyDef> = {};
  parsed.enemies.forEach((e, i) => {
    const def = spec.enemies[e.def];
    if (!def) throw new Error(`map names enemy ${e.def + 1} but only ${spec.enemies.length} are defined`);
    const id = `enemy${i + 1}`;
    defOf[id] = def;
    const facing = def.face ? (mirrored ? MIRROR[def.face] : def.face) : towards(e.pos, parsed.player.pos);
    robots.push({ id, team: 'enemy', pos: e.pos, facing, hp: def.hp, armor: def.armor ?? 0, canCross: { rubble: def.locomotion === 'legs' } });
  });
  return { setup: { tiles: parsed.tiles, robots, seed: spec.seed, ...(spec.maxTicks ? { maxTicks: spec.maxTicks } : {}) }, mapRows: rows, mirrored, enemyDefs: [...spec.enemies], defOf };
}

export { DELTA };
