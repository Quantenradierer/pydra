import { BODY_LAYER, type ChassisArt, type PartArt, type Socket, type SocketName } from './types.ts';

const round = (n: number) => Math.round(n * 100) / 100;

/** The SVG `transform` that puts a part's origin into the socket. */
export const socketTransform = (s: Socket): string => `translate(${round(s.x)} ${round(s.y)})${s.rot ? ` rotate(${s.rot})` : ''}${s.scale !== 1 ? ` scale(${s.scale})` : ''}`;

/** A point in part coordinates, as it lands in the chassis box (scale, then rotate, then move). */
export function anchorPoint(s: Socket, local: { x: number; y: number }): { x: number; y: number } {
  const a = (s.rot * Math.PI) / 180;
  const x = local.x * s.scale;
  const y = local.y * s.scale;
  return { x: round(s.x + x * Math.cos(a) - y * Math.sin(a)), y: round(s.y + x * Math.sin(a) + y * Math.cos(a)) };
}

/** The same point after the whole robot turned to face `dir` (the art faces east), around the box centre. */
export function turnedPoint(p: { x: number; y: number }, facing: 'N' | 'E' | 'S' | 'W'): { x: number; y: number } {
  const dx = p.x - 50;
  const dy = p.y - 50;
  const [x, y] = facing === 'E' ? [dx, dy] : facing === 'S' ? [-dy, dx] : facing === 'W' ? [-dx, -dy] : [dy, -dx];
  return { x: round(50 + x), y: round(50 + y) };
}

/** Degrees the robot element turns for a facing (the art faces east). */
export const FACING_DEG = { E: 0, S: 90, W: 180, N: 270 } as const;

/**
 * Gives every gear item a gear slot of the chassis: the parts that fit fewer sockets choose first, a perfect
 * matching is searched, and if there is none (never with the shipped art) leftovers take any free slot.
 * Returns the socket per gear id, in the order of `gear`.
 */
export function assignSockets(chassis: ChassisArt, gear: readonly string[], part: (id: string) => PartArt | undefined): Map<string, SocketName> {
  const slots = chassis.slots;
  const taken = new Map<string, SocketName>();
  const order = [...new Set(gear)];
  const fits = (id: string) => (part(id)?.fits ?? []).filter((s) => slots.includes(s));
  const search = (i: number, used: Set<SocketName>): boolean => {
    if (i === order.length) return true;
    const id = order[i]!;
    for (const s of fits(id)) {
      if (used.has(s)) continue;
      used.add(s);
      taken.set(id, s);
      if (search(i + 1, used)) return true;
      used.delete(s);
      taken.delete(id);
    }
    return false;
  };
  if (!search(0, new Set())) {
    taken.clear();
    const used = new Set<SocketName>();
    for (const id of order) {
      const s = fits(id).find((x) => !used.has(x)) ?? slots.find((x) => !used.has(x));
      if (s) (used.add(s), taken.set(id, s));
    }
  }
  return taken;
}

/** The gear slots no part sits in. */
export const emptySockets = (chassis: ChassisArt, assigned: ReadonlyMap<string, SocketName>): SocketName[] => {
  const used = new Set(assigned.values());
  return chassis.slots.filter((s) => !used.has(s));
};

/** Parts in paint order: behind the body first. Equal layers keep their order. */
export function paintOrder<T extends { socket: Socket }>(items: readonly T[]): T[] {
  return items.map((item, i) => ({ item, i })).sort((a, b) => a.item.socket.layer - b.item.socket.layer || a.i - b.i).map((x) => x.item);
}

export const isBehindBody = (s: Socket): boolean => s.layer < BODY_LAYER;
