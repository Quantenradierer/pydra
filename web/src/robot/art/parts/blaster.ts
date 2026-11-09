import { circle, g, line, poly, rect, spark } from '../kit.ts';
import type { PartArt, Tier } from '../types.ts';

/** A slim energy barrel with a glowing emitter. Mk II: twin barrels, cooling fins and a hotter core. */
export const blaster: PartArt = {
  id: 'blaster',
  kind: 'gear',
  fits: ['front', 'top'],
  muzzle: { x: 24, y: 0 },
  draw(tier: Tier) {
    const flash = g('rb-flash', spark(poly([[22, 0], [34, -5], [30, 0], [34, 5]], 'hot') + circle(24, 0, 4, 'light')));
    if (tier.mark === 2) {
      const barrel = (y: number) => rect(3, y - 2.6, 20, 5.2, 'metal', 1.5) + rect(21, y - 3.4, 4, 6.8, 'dark', 1.2) + circle(25, y, 2.4, 'glow');
      return rect(-8, -9, 14, 18, 'lo', 3) + barrel(-5.4) + barrel(5.4) + line('M8 -9L8 9M12 -9L12 9M16 -9L16 9', 'stroke-width="1.3"') + circle(-1, 0, 3.6, 'hot') + spark(circle(-1, 0, 1.6, 'light')) + flash;
    }
    return rect(-6, -6.5, 12, 13, 'lo', 3) + rect(4, -2.7, 18, 5.4, 'metal', 1.5) + rect(10, -4.6, 3, 9.2, 'dark', 1) + rect(20, -3.6, 4, 7.2, 'dark', 1.2) + circle(24, 0, 2.6, 'acc') + flash;
  },
};
