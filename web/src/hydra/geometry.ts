/**
 * Geometry of the quiz hydra: one neck and head per question, rising out of
 * the swamp of Lerna in a zigzag. Pure numbers and SVG path data, in viewBox
 * units (the hydra is drawn at about one unit per CSS pixel on a phone).
 */

export const WIDTH = 200;
export const HEIGHT = 54;

/** Head size relative to the logo artwork (icons/hydra.svg), whose head path is reused. */
const HEAD_SCALE = 0.22;
/** Left and right margin for the outermost necks, so their heads stay inside. */
const PAD = 14;
/** Head heights: right-facing heads are high, left-facing ones low. */
const HIGH_Y = 12;
const LOW_Y = 24;
/** Sideways swing of the S-curved necks. */
const CURL = 7;
/** Where along the neck (0 = water, 1 = head) a slash cuts. */
const CUT_AT = 0.6;

export interface Point {
  x: number;
  y: number;
}

export interface NeckShape {
  /** Where the neck leaves the water; the pivot of its idle sway. */
  base: Point;
  /** Path from the water to the cut: what is left after a slash. */
  stump: string;
  /** Path from the cut to the head. */
  neck: string;
  cut: Point;
  /** A short stroke across the neck at the cut, drawn when the head is slashed. */
  slash: string;
  /** SVG transform placing the head (the logo's head path) at the end of the neck. */
  head: string;
  /** 1 when the head faces right, -1 when it faces left. */
  facing: 1 | -1;
  /** High heads are drawn first, so the low ones in front overlap them. */
  high: boolean;
}

type Cubic = [Point, Point, Point, Point];

const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const round = (n: number) => Math.round(n * 10) / 10;
const pathOf = ([a, b, c, d]: Cubic) =>
  `M${round(a.x)} ${round(a.y)}C${round(b.x)} ${round(b.y)} ${round(c.x)} ${round(c.y)} ${round(d.x)} ${round(d.y)}`;

/** Splits a cubic Bézier at t (de Casteljau). */
function split([p0, p1, p2, p3]: Cubic, t: number): [Cubic, Cubic] {
  const a = lerp(p0, p1, t);
  const b = lerp(p1, p2, t);
  const c = lerp(p2, p3, t);
  const d = lerp(a, b, t);
  const e = lerp(b, c, t);
  const f = lerp(d, e, t);
  return [
    [p0, a, d, f],
    [f, e, c, p3],
  ];
}

/** Lays out `count` necks from left to right; the same count always gives the same hydra. */
export function necks(count: number): NeckShape[] {
  return Array.from({ length: count }, (_, i) => {
    const u = (i + 0.5) / count;
    const facing = i % 2 === 1 ? 1 : -1;
    const high = facing === 1;
    // A fixed pseudo-random jitter per head, so the necks do not look stamped.
    const jitter = Math.sin(i * 2.4);
    const joint = { x: PAD + u * (WIDTH - 2 * PAD) - facing, y: (high ? HIGH_Y : LOW_Y) + jitter * 2 };
    const base = { x: round(joint.x + facing * 2 + jitter * 3), y: HEIGHT + 2 };
    const rise = base.y - joint.y;
    const swing = i % 3 === 0 ? CURL : -CURL;
    const [stump, neck] = split(
      [
        base,
        { x: base.x + swing, y: base.y - rise * 0.5 },
        { x: joint.x - facing * CURL * 0.9 - swing * 0.5, y: joint.y + rise * 0.55 },
        joint,
      ],
      CUT_AT,
    );
    const cut = neck[0];
    // The slash crosses the neck at a slant: the neck direction turned by 70 degrees.
    const along = Math.atan2(neck[1].y - cut.y, neck[1].x - cut.x) + (70 * Math.PI) / 180;
    const reach = { x: Math.cos(along) * 9, y: Math.sin(along) * 9 };
    const angle = (high ? -12 : 10) + jitter * 8;
    return {
      base,
      stump: pathOf(stump),
      neck: pathOf(neck),
      cut: { x: round(cut.x), y: round(cut.y) },
      slash: `M${round(cut.x - reach.x)} ${round(cut.y - reach.y)}L${round(cut.x + reach.x)} ${round(cut.y + reach.y)}`,
      head: `translate(${round(joint.x)} ${round(joint.y)}) scale(${facing * HEAD_SCALE} ${HEAD_SCALE}) rotate(${round(angle)})`,
      facing,
      high,
    };
  });
}
