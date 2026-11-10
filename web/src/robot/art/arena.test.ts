import { describe, expect, it } from 'vitest';
import type { Frame } from '../battle.ts';
import { effectsOf, hpBadge } from './arena.ts';

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

describe('hp badge', () => {
  it('is the number of hit points, so 1 HP and 3 HP read differently at any size', () => {
    expect(hpBadge(1, 1).text).toBe('1');
    expect(hpBadge(3, 3).text).toBe('3');
    expect(hpBadge(8, 8).text).toBe('8');
  });
  it('counts down when hit and turns "low" at 40 % or less (never for a fresh 1 HP enemy)', () => {
    expect(hpBadge(2, 5)).toEqual({ text: '2', low: true });
    expect(hpBadge(3, 5)).toEqual({ text: '3', low: false });
    expect(hpBadge(1, 1)).toEqual({ text: '1', low: false });
    expect(hpBadge(0, 3)).toEqual({ text: '0', low: true });
  });
});
