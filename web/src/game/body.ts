import type { Point } from './world.ts';

/** Distance between the points the body outline is built from, in viewBox units. */
const STEP = 1.6;
/** Wavelength of the slither. */
const WAVE = 18;

export interface BodyOptions {
  /** Width of the body at the neck and at the tip of the tail. */
  headWidth?: number;
  tailWidth?: number;
  /** Slither: how far the body swings sideways at the tail (0 = still) and how far the wave has travelled. */
  sway?: number;
  phase?: number;
  /** A swelling that travels down the body (after a meal): how far along it is (0 = neck, 1 = tail tip) and its extra width. */
  bulge?: { at: number; extra: number };
}

export interface BodyShapes {
  /** Closed outline of the tapered body, ending in a rounded tail. */
  body: string;
  /** Closed lighter stripe along the back. */
  stripe: string;
}

/** Points along a path from the first point to the last that rounds every corner (like quadratic curves between midpoints). */
function trace(pts: Point[]): Point[] {
  const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const out: Point[] = [pts[0]!];
  let cur = pts[0]!;
  const to = (c: Point, end: Point) => {
    for (let k = 1; k <= 6; k++) {
      const t = k / 6;
      out.push({
        x: (1 - t) * (1 - t) * cur.x + 2 * (1 - t) * t * c.x + t * t * end.x,
        y: (1 - t) * (1 - t) * cur.y + 2 * (1 - t) * t * c.y + t * t * end.y,
      });
    }
    cur = end;
  };
  if (pts.length < 3) {
    out.push(...pts.slice(1));
    return out;
  }
  const first = mid(pts[0]!, pts[1]!);
  out.push(first);
  cur = first;
  for (let i = 1; i < pts.length - 1; i++) to(pts[i]!, mid(pts[i]!, pts[i + 1]!));
  out.push(pts.at(-1)!);
  return out;
}

/** The traced path again, with the points evenly spaced. */
function resample(line: Point[]): { p: Point; s: number }[] {
  const res = [{ p: line[0]!, s: 0 }];
  let travelled = 0;
  let next = STEP;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!;
    const b = line[i]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    while (len > 0 && travelled + len >= next) {
      const k = (next - travelled) / len;
      res.push({ p: { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }, s: next });
      next += STEP;
    }
    travelled += len;
  }
  const last = line.at(-1)!;
  if (travelled - res.at(-1)!.s > 0.2) res.push({ p: last, s: travelled });
  return res;
}

const num = (n: number) => Math.round(n * 100) / 100;

/**
 * The look of a hydra's body, shared by the fishing and the hunting games:
 * fat at the neck and tapering to a round tail tip, with a lighter stripe
 * down the back. `route` runs from the neck to the tail
 * and may have corners; they are rounded. The shapes are filled paths, so
 * they can be given an outline and colours in CSS.
 */
export function bodyShapes(route: Point[], opts: BodyOptions = {}): BodyShapes {
  const { headWidth = 4.6, tailWidth = 1.1, sway = 0, phase = 0, bulge } = opts;
  const line = resample(trace(route));
  const total = line.at(-1)!.s || 1;
  const n = line.length;
  const centre: Point[] = [];
  const width: number[] = [];
  const side: Point[] = [];
  for (let i = 0; i < n; i++) {
    const { p, s } = line[i]!;
    const t = s / total;
    const a = line[Math.max(0, i - 1)]!.p;
    const b = line[Math.min(n - 1, i + 1)]!.p;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    // Thick through the neck and chest, then narrowing towards the tail.
    let w = tailWidth + (headWidth - tailWidth) * Math.pow(1 - Math.min(1, s / Math.max(total, 40)), 0.85);
    if (bulge) w += bulge.extra * Math.exp(-(((s - bulge.at * total) / 3.5) ** 2));
    // The swing grows from nothing at the neck to its full size at the tail.
    const swing = sway * Math.min(1, s / 12) * Math.sin((s / WAVE) * Math.PI * 2 - phase);
    centre.push({ x: p.x + nx * swing, y: p.y + ny * swing });
    side.push({ x: nx, y: ny });
    width.push(w);
  }
  const outline = (factor: number, cap: boolean) => {
    const left = centre.map((c, i) => `${num(c.x + side[i]!.x * (width[i]! * factor) / 2)} ${num(c.y + side[i]!.y * (width[i]! * factor) / 2)}`);
    const right = centre.map((c, i) => `${num(c.x - side[i]!.x * (width[i]! * factor) / 2)} ${num(c.y - side[i]!.y * (width[i]! * factor) / 2)}`).reverse();
    const r = num((width[n - 1]! * factor) / 2);
    // The end of the tail is a half circle bulging forwards (sweep 0 from the left side to the right).
    return `M${left.join('L')}${cap ? `A${r} ${r} 0 0 0 ${right[0]}` : `L${right[0]}`}L${right.join('L')}Z`;
  };
  return {
    body: outline(1, true),
    stripe: outline(0.38, true),
  };
}
