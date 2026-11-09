import { circle, line, poly, spark } from '../kit.ts';
import type { PartArt } from '../types.ts';

/** Stacked armour slabs with rivets and a hazard stripe; a passive part that makes the robot look thicker. */
export const plates: PartArt = {
  id: 'plates',
  kind: 'gear',
  fits: ['top', 'back', 'left', 'right', 'front'],
  draw() {
    return (
      poly([[-11, -15], [11, -15], [17, -8], [17, 8], [11, 15], [-11, 15], [-17, 8], [-17, -8]], 'lo') +
      poly([[-9, -12], [9, -12], [13, -6], [13, 6], [9, 12], [-9, 12], [-13, 6], [-13, -6]], 'metal') +
      spark(poly([[-7, -9], [7, -9], [10, -4], [-10, -4]], 'light')) +
      line('M-9 2L9 2M-9 7L9 7', 'stroke-width="1.6"') +
      spark(poly([[-9, -1], [-5, -1], [-9, 1.5]], 'hot') + poly([[-1, -1], [3, -1], [-1, 1.5]], 'hot') + poly([[6, -1], [9, -1], [6, 1.5]], 'hot')) +
      circle(-13, -11, 1.8, 'dark') +
      circle(13, -11, 1.8, 'dark') +
      circle(-13, 11, 1.8, 'dark') +
      circle(13, 11, 1.8, 'dark')
    );
  },
};
