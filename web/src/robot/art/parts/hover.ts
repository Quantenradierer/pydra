import { circle, g, line, spark } from '../kit.ts';
import type { PartArt } from '../types.ts';

/** Four glowing jet rings and a light cushion (art ready for Chapter 5+). */
export const hover: PartArt = {
  id: 'hover',
  kind: 'locomotion',
  fits: ['underside'],
  draw() {
    const jet = (x: number, y: number) =>
      circle(x, y, 11, 'dark') + g('rb-pulse', circle(x, y, 7.5, 'glow')) + spark(circle(x, y, 4, 'light')) + line(`M${x - 6} ${y}L${x + 6} ${y}M${x} ${y - 6}L${x} ${y + 6}`, 'stroke-width="1.4"');
    return spark(`<ellipse cx="0" cy="0" rx="40" ry="34" class="f-glow" opacity=".22"/>`) + jet(-20, -26) + jet(20, -26) + jet(-20, 26) + jet(20, 26);
  },
};
