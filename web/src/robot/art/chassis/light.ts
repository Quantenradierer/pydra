import { circle, line, path, rect, spark } from '../kit.ts';
import type { ChassisArt } from '../types.ts';

/** Light chassis: a small, round-nosed hull with two gear slots (front, top). */
export const light: ChassisArt = {
  id: 'light',
  slots: ['front', 'top'],
  sockets: {
    underside: { x: 50, y: 50, rot: 0, scale: 0.84, layer: 0 },
    back: { x: 29, y: 50, rot: 180, scale: 0.84, layer: 25 },
    left: { x: 50, y: 36, rot: -90, scale: 0.84, layer: 25 },
    right: { x: 50, y: 64, rot: 90, scale: 0.84, layer: 25 },
    top: { x: 46, y: 50, rot: 0, scale: 0.86, layer: 30 },
    front: { x: 69, y: 50, rot: 0, scale: 0.86, layer: 40 },
  },
  body:
    path('M31 38Q31 35 35 35L62 35Q69 35 72 42L72 58Q69 65 62 65L35 65Q31 65 31 62Z', 'body') +
    spark(path('M35 39L61 39Q66 39 68 44L68 56Q66 61 61 61L35 61Q34 61 34 60L34 40Q34 39 35 39Z', 'hi')) +
    rect(36, 42, 14, 16, 'dark', 3) +
    circle(60, 50, 4.2, 'acc') +
    spark(circle(60, 50, 1.8, 'light')) +
    line('M33 44L33 56M31.5 46L31.5 54', 'stroke-width="1.4"'),
};
