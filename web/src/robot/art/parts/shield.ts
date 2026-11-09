import { g, path, rect, spark } from '../kit.ts';
import type { PartArt } from '../types.ts';

/** A curved energy plate on two struts; the rim glows. The big bubble around the robot comes from the renderer. */
export const shield: PartArt = {
  id: 'shield',
  kind: 'gear',
  fits: ['front', 'top', 'back'],
  draw() {
    return (
      rect(-4, -12, 6, 4, 'dark', 1.5) +
      rect(-4, 8, 6, 4, 'dark', 1.5) +
      path('M6 -22Q36 -14 36 0Q36 14 6 22Q22 8 22 0Q22 -8 6 -22Z', 'metal') +
      path('M9 -18Q27 -11 27 0Q27 11 9 18Q17 7 17 0Q17 -7 9 -18Z', 'acc') +
      g('rb-glint', spark(path('M24 -7Q27 0 24 7L22 7Q25 0 22 -7Z', 'light')))
    );
  },
};
