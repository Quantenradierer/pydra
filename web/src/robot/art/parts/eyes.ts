import { circle, g, line, rect, spark } from '../kit.ts';
import type { PartArt, Tier } from '../types.ts';

/** Two camera lenses on a visor bar. Wide-angle: wider set, bigger lenses and side prongs. Scanner: radar arcs in front. */
export const eyes: PartArt = {
  id: 'eyes',
  kind: 'gear',
  fits: ['top', 'front'],
  draw(tier: Tier) {
    const wide = tier.wide;
    const dy = wide ? 12 : 9;
    const r = wide ? 5.4 : 4.4;
    const lens = (y: number) => circle(11, y, r + 1.6, 'dark') + circle(12, y, r, 'glow') + spark(circle(10.6, y - 1.4, 1.5, 'light'));
    return (
      rect(0, -dy - 2.5, 7, dy * 2 + 5, 'lo', 2.5) +
      rect(5, -dy - 1, 6, 2, 'metal') +
      rect(5, dy - 1, 6, 2, 'metal') +
      lens(-dy) +
      lens(dy) +
      (wide ? g('rb-wide', line('M18 -dy2L24 -dy3M18 dy2L24 dy3'.replace(/dy2/g, String(dy + 2)).replace(/dy3/g, String(dy + 8)), 'stroke-width="2.2"')) : '') +
      (tier.scanner ? g('rb-scan', line('M22 -8Q28 0 22 8M27 -13Q35 0 27 13M32 -18Q42 0 32 18', 'stroke-width="2.2"')) : '')
    );
  },
};
