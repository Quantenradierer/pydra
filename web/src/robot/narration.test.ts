import { describe, expect, it } from 'vitest';
import { translate } from '../i18n.ts';
import type { Frame, RobotFrame } from './battle.ts';
import type { GameEvent } from './engine.ts';
import { describeAction } from './narration.ts';

const de = (key: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate('de', key, p);
const robot = (x: number, y: number, facing: RobotFrame['facing']): RobotFrame => ({ id: 'player', pos: { x, y }, facing, hp: 5, maxHp: 5, shieldUp: false });
const frame = (r: RobotFrame, events: GameEvent[] = []): Frame => ({ tick: 1, robots: [r], events, lines: {}, bubbles: [], sensors: {} });
const narrate = (prev: Frame, next: Frame) => describeAction(prev, next, de);

describe('describeAction: one short sentence about what the action just did', () => {
  it('moves are described relative to the facing, without coordinates', () => {
    const start = frame(robot(3, 7, 'N'));
    expect(narrate(start, frame(robot(3, 6, 'N')))).toBe('Du fährst einen Schritt vor.');
    expect(narrate(start, frame(robot(3, 8, 'N')))).toBe('Du fährst einen Schritt zurück.');
    expect(narrate(start, frame(robot(3, 7, 'E')))).toBe('Du drehst dich.');
  });
  it('shots, bumps and nothing', () => {
    const start = frame(robot(3, 7, 'N'));
    const ev = (e: GameEvent) => narrate(start, frame(robot(3, 7, 'N'), [e]));
    expect(ev({ type: 'shot', by: 'player', from: { x: 3, y: 7 }, to: { x: 3, y: 2 }, hit: 'enemy' })).toBe('Du schießt: Treffer!');
    expect(ev({ type: 'shot', by: 'player', from: { x: 3, y: 7 }, to: { x: 3, y: 2 } })).toBe('Du schießt: daneben.');
    expect(ev({ type: 'bump', robot: 'player', reason: 'wall' })).toBe('Du stößt an die Wand.');
    expect(ev({ type: 'shot', by: 'enemy', from: { x: 3, y: 2 }, to: { x: 3, y: 7 } })).toBeNull();
    expect(narrate(start, frame(robot(3, 7, 'N')))).toBeNull();
  });
});
