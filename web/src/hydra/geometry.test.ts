import { describe, expect, it } from 'vitest';
import { HEIGHT, WIDTH, necks } from './geometry.ts';

/** The points of an "M x y C x y x y x y" path. */
function points(path: string): { x: number; y: number }[] {
  const n = path.match(/-?\d+(\.\d+)?/g)!.map(Number);
  return Array.from({ length: n.length / 2 }, (_, i) => ({ x: n[2 * i]!, y: n[2 * i + 1]! }));
}

describe('hydra geometry', () => {
  const shapes = necks(10);

  it('draws ten distinct necks and heads', () => {
    expect(shapes).toHaveLength(10);
    for (const key of ['stump', 'neck', 'head', 'slash'] as const) {
      expect(new Set(shapes.map((s) => s[key])).size).toBe(10);
    }
  });

  it('cuts each neck where the stump ends and the upper neck begins', () => {
    for (const shape of shapes) {
      expect(points(shape.stump).at(-1)).toEqual(shape.cut);
      expect(points(shape.neck)[0]).toEqual(shape.cut);
      expect(points(shape.stump)[0]).toEqual(shape.base);
    }
  });

  it('keeps the necks inside the drawing, rising from the bottom edge', () => {
    for (const shape of shapes) {
      for (const p of [...points(shape.stump), ...points(shape.neck)]) {
        expect(p.x).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(WIDTH);
        expect(p.y).toBeGreaterThan(0);
        expect(p.y).toBeLessThanOrEqual(HEIGHT + 2);
      }
      expect(shape.base.y).toBeGreaterThanOrEqual(HEIGHT);
    }
  });

  it('places the necks left to right, heads facing both ways', () => {
    const cuts = shapes.map((s) => s.cut.x);
    expect(cuts).toEqual([...cuts].sort((a, b) => a - b));
    expect(new Set(shapes.map((s) => s.facing))).toEqual(new Set([1, -1]));
  });

  it('is the same hydra every time', () => {
    expect(necks(10)).toEqual(shapes);
  });
});
