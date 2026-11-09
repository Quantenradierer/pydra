import { circle, line, path, poly, rect, spark } from '../kit.ts';
import type { ChassisArt } from '../types.ts';

/** Medium chassis: a broader hull with side pods and three gear slots (front, top, back). */
export const medium: ChassisArt = {
  id: 'medium',
  slots: ['front', 'top', 'back'],
  sockets: {
    underside: { x: 50, y: 50, rot: 0, scale: 1, layer: 0 },
    back: { x: 26, y: 50, rot: 180, scale: 0.95, layer: 25 },
    left: { x: 50, y: 31, rot: -90, scale: 0.95, layer: 25 },
    right: { x: 50, y: 69, rot: 90, scale: 0.95, layer: 25 },
    top: { x: 46, y: 50, rot: 0, scale: 1, layer: 30 },
    front: { x: 75, y: 50, rot: 0, scale: 1, layer: 40 },
  },
  body:
    path('M26 35Q26 31 30 31L66 31Q74 31 77 38L77 62Q74 69 66 69L30 69Q26 69 26 65Z', 'body') +
    spark(path('M30 35L65 35Q70 35 72 40L72 60Q70 65 65 65L30 65Q30 65 30 64L30 36Q30 35 30 35Z', 'hi')) +
    poly([[32, 38], [56, 38], [60, 44], [60, 56], [56, 62], [32, 62]], 'dark') +
    rect(24, 40, 7, 20, 'metal', 2) +
    rect(40, 28, 10, 5, 'lo', 1.5) +
    rect(40, 67, 10, 5, 'lo', 1.5) +
    circle(66, 50, 4.8, 'acc') +
    spark(circle(66, 50, 2, 'light')) +
    line('M36 44L52 44M36 50L52 50M36 56L52 56', 'stroke-width="1.5"'),
};
