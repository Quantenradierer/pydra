import { describe, expect, it } from 'vitest';
import { LANGS } from '../i18n.ts';
import { parseHuntMap, simulateHunt, type HuntOutcome } from './hunt.ts';
import { arrange, ORDER_LEVELS } from './order-levels.ts';

/**
 * How the shown order of every level ends. Checked against real Python too,
 * together with the right order: the same world written in Python ends both
 * programs the same way.
 */
const START: Record<string, HuntOutcome['kind']> = {
  'order-steps': 'air',
  'order-head': 'eaten',
  'order-corner': 'eaten',
  'order-for': 'error',
  'order-loop-body': 'missed',
  'order-function': 'error',
  'order-while': 'eaten',
  'order-if': 'missed',
};

describe('code puzzle levels', () => {
  it('has unique ids', () => {
    expect(new Set(ORDER_LEVELS.map((l) => l.id)).size).toBe(ORDER_LEVELS.length);
    expect(Object.keys(START)).toEqual(ORDER_LEVELS.map((l) => l.id));
  });

  for (const level of ORDER_LEVELS) {
    describe(level.id, () => {
      const world = parseHuntMap(level.map);
      const right = level.lines.map((_, i) => i);

      it('is well formed: texts in every language, a start order of every line, indents of 4 spaces', () => {
        for (const lang of LANGS) {
          for (const text of [level.title, level.intro, level.hint, level.explain]) expect(text[lang].trim(), `${level.id} ${lang}`).not.toBe('');
        }
        expect([...level.start].sort()).toEqual(right);
        expect(level.lines.length).toBeGreaterThanOrEqual(3);
        expect(level.lines.length).toBeLessThanOrEqual(7);
        for (const line of level.lines) expect(/^ */.exec(line)![0].length % 4, line).toBe(0);
      });

      it('is solved by its lines in order, and not by the order shown at first', () => {
        expect(simulateHunt(world, arrange(level, right)).outcome.kind).toBe('success');
        expect(simulateHunt(world, arrange(level, level.start)).outcome.kind).toBe(START[level.id]);
      });

      it('fits a phone: at most 7 cells wide and 7 high, and short runs', () => {
        expect(world.width).toBeLessThanOrEqual(7);
        expect(world.height).toBeLessThanOrEqual(7);
        expect(simulateHunt(world, arrange(level, right)).steps.length).toBeLessThanOrEqual(80);
      });
    });
  }
});
