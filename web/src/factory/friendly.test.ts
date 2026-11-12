import { describe, expect, it } from 'vitest';
import { orderHint } from './friendly.ts';
import { World } from './world.ts';

const snap = (belt: string[], ore = 0, coal = 0, plates = 0) => {
  const w = new World({ belt: belt as never, ore, coal });
  const s = w.snapshot();
  return { ...s, plates };
};

describe('order hint', () => {
  it('names the items still on the belt first', () => {
    expect(orderHint({ ore: 2 }, snap(['ore', 'coal'], 0), 0, 'en')).toBe('Still on the belt: 1 ore, 1 coal. The grabber did not take it.');
  });
  it('else the heap that is short, or the plates', () => {
    expect(orderHint({ ore: 2 }, snap([], 1), 0, 'en')).toBe('The smelter holds 1 ore, the order needs 2.');
    expect(orderHint({ plates: 2 }, snap([], 2, 1, 0), 0, 'de')).toBe('Der Ofen hat 0 Platten gemacht, der Auftrag braucht 2 Platten.');
    expect(orderHint({ plates: 'n' }, snap([], 0, 0, 1), 3, 'en')).toBe('The smelter has made 1 plate, the order needs 3 plates.');
  });
  it('is undefined when the block meets the order', () => {
    expect(orderHint({ ore: 1 }, snap([], 1), 0, 'en')).toBeUndefined();
  });
});
