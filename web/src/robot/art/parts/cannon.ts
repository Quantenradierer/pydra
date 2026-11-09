import { circle, g, line, poly, rect, spark } from '../kit.ts';
import type { PartArt } from '../types.ts';

/** A short, fat barrel with a muzzle brake and a big breech: heavy hits, slow reload. */
export const cannon: PartArt = {
  id: 'cannon',
  kind: 'gear',
  fits: ['top', 'front'],
  muzzle: { x: 39, y: 0 },
  draw() {
    return (
      circle(-2, 0, 10.5, 'lo') +
      circle(-2, 0, 5.5, 'metal') +
      rect(6, -6.2, 28, 12.4, 'metal', 2.5) +
      rect(12, -7.4, 3.4, 14.8, 'dark', 1) +
      rect(22, -7.4, 3.4, 14.8, 'dark', 1) +
      rect(32, -8.6, 7, 17.2, 'dark', 2) +
      line('M34 -4L37 -4M34 4L37 4', 'stroke-width="1.5"') +
      g('rb-flash', spark(poly([[38, 0], [50, -9], [46, 0], [50, 9]], 'hot') + poly([[38, 0], [46, -4], [44, 0], [46, 4]], 'light')))
    );
  },
};
