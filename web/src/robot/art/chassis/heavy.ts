import { circle, line, path, poly, rect, spark } from '../kit.ts';
import type { ChassisArt } from '../types.ts';

/** Heavy chassis (art ready for Chapter 5+): a wide armoured hull with four slots. */
export const heavy: ChassisArt = {
  id: 'heavy',
  slots: ['front', 'top', 'back', 'left'],
  sockets: {
    underside: { x: 50, y: 50, rot: 0, scale: 1.1, layer: 0 },
    back: { x: 22, y: 50, rot: 180, scale: 1, layer: 25 },
    left: { x: 50, y: 27, rot: -90, scale: 1, layer: 25 },
    right: { x: 50, y: 73, rot: 90, scale: 1, layer: 25 },
    top: { x: 46, y: 50, rot: 0, scale: 1.05, layer: 30 },
    front: { x: 80, y: 50, rot: 0, scale: 1.05, layer: 40 },
  },
  body:
    path('M22 33Q22 27 28 27L68 27Q77 27 81 35L81 65Q77 73 68 73L28 73Q22 73 22 67Z', 'body') +
    spark(path('M27 32L66 32Q72 32 75 38L75 62Q72 68 66 68L27 68Q27 68 27 67L27 33Q27 32 27 32Z', 'hi')) +
    poly([[29, 36], [58, 36], [64, 43], [64, 57], [58, 64], [29, 64]], 'dark') +
    rect(19, 38, 8, 24, 'metal', 2) +
    poly([[40, 24], [52, 24], [55, 30], [37, 30]], 'lo') +
    poly([[40, 76], [52, 76], [55, 70], [37, 70]], 'lo') +
    circle(70, 50, 5.4, 'acc') +
    spark(circle(70, 50, 2.4, 'light')) +
    line('M33 42L56 42M33 50L56 50M33 58L56 58', 'stroke-width="1.6"') +
    line('M27 36L22 36M27 64L22 64', 'stroke-width="1.6"'),
};
