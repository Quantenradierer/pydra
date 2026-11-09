import { circle, line, rect, spark } from '../kit.ts';
import type { PartArt } from '../types.ts';

/** Four fat tyres at the corners; the origin is the chassis centre. */
export const wheels: PartArt = {
  id: 'wheels',
  kind: 'locomotion',
  fits: ['underside'],
  draw() {
    const tyre = (x: number, y: number) =>
      rect(x - 10, y - 5.5, 20, 11, 'dark', 5) + spark(rect(x - 7, y - 3, 14, 6, 'lo', 3)) + circle(x, y, 3.2, 'metal') + line(`M${x - 8} ${y - 5.5}L${x - 8} ${y + 5.5}M${x + 8} ${y - 5.5}L${x + 8} ${y + 5.5}`, 'stroke-width="1.2"');
    return line('M-19 -22L-19 22M19 -22L19 22', 'stroke-width="4"') + tyre(-19, -27) + tyre(19, -27) + tyre(-19, 27) + tyre(19, 27);
  },
};
