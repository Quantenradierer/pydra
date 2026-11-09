import { describe, expect, it } from 'vitest';
import type { Frame } from '../battle.ts';
import { effectsOf } from './arena.ts';

const frame = (robots: Frame['robots'], events: Frame['events']): Frame => ({ tick: 1, robots, events, lines: {}, bubbles: [], sensors: {} });
const rob = (id: string, x: number): Frame['robots'][number] => ({ id, pos: { x, y: 0 }, facing: 'E', hp: 5, maxHp: 5, shieldUp: false });

describe('arena effects', () => {
  it('maps engine events to one-tick effects of the right robot', () => {
    const prev = frame([rob('player', 0), rob('enemy1', 5)], []);
    const now = frame([rob('player', 1), rob('enemy1', 5)], [
      { type: 'shot', by: 'player', from: { x: 1, y: 0 }, to: { x: 5, y: 0 }, hit: 'enemy1' },
      { type: 'damage', robot: 'enemy1', amount: 1 },
      { type: 'smash', by: 'enemy1', at: { x: 4, y: 0 } },
    ]);
    const fx = effectsOf(now, prev);
    expect([...fx.get('player')!].sort()).toEqual(['fx-fire', 'fx-move']);
    expect([...fx.get('enemy1')!].sort()).toEqual(['fx-hit', 'fx-smash']);
  });
  it('has no effects without events or movement', () => {
    const f = frame([rob('player', 0)], []);
    expect(effectsOf(f, f).size).toBe(0);
  });
});
