import { circle, g, rect, spark } from '../kit.ts';
import type { PartArt } from '../types.ts';

/** A pivoting arm with a block-shaped head; it swings when the robot smashes. */
export const hammer: PartArt = {
  id: 'hammer',
  kind: 'gear',
  fits: ['front', 'top'],
  muzzle: { x: 30, y: 0 },
  draw() {
    return g('rb-swing', rect(0, -3.4, 22, 6.8, 'lo', 2) + rect(16, -14, 16, 28, 'metal', 3) + spark(rect(19, -11, 3, 22, 'light') + rect(27, -12, 3, 24, 'hot'))) + circle(0, 0, 6.8, 'dark') + circle(0, 0, 3.2, 'metal');
  },
};
