import { circle, line, rect, spark } from '../kit.ts';
import type { PartArt } from '../types.ts';

/** Two long caterpillar tracks along the sides: the longest, flattest silhouette. */
export const treads: PartArt = {
  id: 'treads',
  kind: 'locomotion',
  fits: ['underside'],
  draw() {
    const track = (y: number) => {
      const ribs: string[] = [];
      for (let x = -28; x <= 28; x += 5.6) ribs.push(`M${x} ${y - 7}L${x} ${y + 7}`);
      return rect(-35, y - 8.5, 70, 17, 'dark', 8.5) + spark(rect(-32, y - 5.5, 64, 11, 'lo', 5.5)) + line(ribs.join(''), 'stroke-width="1.6"') + circle(-27, y, 4, 'metal') + circle(0, y, 3, 'metal') + circle(27, y, 4, 'metal');
    };
    return track(-26) + track(26);
  },
};
