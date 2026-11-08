import type { EnemyData, Text } from './types.ts';

export const T = (de: string, en: string): Text => ({ de, en });

/** An ASCII map of w x h tiles with symbols placed at (x, y): `mk(8, 8, ['^', 3, 7], ['D', 3, 4], ['#', 3, 2])`. */
export function mk(w: number, h: number, ...items: [string, number, number][]): string[] {
  const rows = Array.from({ length: h }, () => Array.from({ length: w }, () => '.'));
  for (const [sym, x, y] of items) rows[y]![x] = sym;
  return rows.map((r) => r.join(''));
}

/** Marks every tile of a vertical or horizontal wall run. */
export const wallCol = (x: number, y0: number, y1: number): [string, number, number][] => Array.from({ length: y1 - y0 + 1 }, (_, i) => ['#', x, y0 + i]);
export const wallRow = (y: number, x0: number, x1: number): [string, number, number][] => Array.from({ length: x1 - x0 + 1 }, (_, i) => ['#', x0 + i, y]);

export const chapter = (n: number, list: Omit<EnemyData, 'chapter'>[]): EnemyData[] => list.map((e) => ({ ...e, chapter: n }));
