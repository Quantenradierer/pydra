import { circle } from '../kit.ts';
import type { PartArt } from '../types.ts';

/** Six jointed spider legs, three per side, reaching past the hull. */
export const legs: PartArt = {
  id: 'legs',
  kind: 'locomotion',
  fits: ['underside'],
  draw() {
    const leg = (x: number, side: 1 | -1, reach: number) => {
      const knee = `${x + reach * 0.5} ${side * 25}`;
      const foot = `${x + reach} ${side * 40}`;
      const d = `M${x} ${side * 12}L${knee}L${foot}`;
      return `<path d="${d}" class="leg-out"/><path d="${d}" class="leg-in"/>` + circle(x + reach * 0.5, side * 25, 3.2, 'metal') + circle(x + reach, side * 40, 2.4, 'dark');
    };
    const side = (s: 1 | -1) => leg(-16, s, -10) + leg(0, s, 2) + leg(16, s, 12);
    return side(1) + side(-1);
  },
};
