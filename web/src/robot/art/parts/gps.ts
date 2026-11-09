import { circle, g, line, spark } from '../kit.ts';
import type { PartArt } from '../types.ts';

/** A tilted satellite dish on a mast with a blinking beacon. */
export const gps: PartArt = {
  id: 'gps',
  kind: 'gear',
  fits: ['top', 'back'],
  draw() {
    return (
      circle(0, 0, 6.5, 'dark') +
      line('M0 0L-9 -9', 'stroke-width="3.2"') +
      circle(0, 0, 13, 'metal') +
      circle(0, 0, 9.4, 'lo') +
      circle(0, 0, 5.2, 'metal') +
      line('M0 0L7 -7', 'stroke-width="2.2"') +
      circle(8, -8, 2.6, 'dark') +
      g('rb-pulse', spark(circle(-9, -9, 3, 'glow')))
    );
  },
};
