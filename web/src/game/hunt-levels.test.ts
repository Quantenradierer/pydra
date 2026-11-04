import { describe, expect, it } from 'vitest';
import { LANGS } from '../i18n.ts';
import { HUNT_LEVELS as LEVELS } from './hunt-levels.ts';
import { fill, GAP } from './puzzle.ts';
import { parse } from './python.ts';
import { parseHuntMap as parseMap, simulateHunt as simulate, type HuntOutcome as Outcome, type HuntTrace as Trace } from './hunt.ts';

/**
 * How every answer of every level ends, in choice order (the right one first
 * in the data). Checked against real Python too: the same world written in
 * Python ends every program the same way.
 */
const EXPECTED: Record<string, Outcome['kind'][]> = {
  'hunt-steps': ['success', 'air', 'air', 'crash'],
  'hunt-head': ['success', 'eaten', 'eaten', 'error'],
  'hunt-west': ['success', 'crash', 'missed', 'error'],
  'hunt-for': ['success', 'air', 'eaten', 'error'],
  'hunt-loop-body': ['success', 'crash', 'crash', 'missed'],
  'hunt-function': ['success', 'missed', 'air', 'error'],
  'hunt-parameter': ['success', 'missed', 'crash', 'error'],
  'hunt-while': ['success', 'air', 'eaten', 'error'],
  'hunt-if': ['success', 'air', 'missed', 'air'],
  'hunt-nested': ['success', 'crash', 'crash', 'missed'],
  'hunt-list': ['success', 'air', 'missed', 'crash'],
  'hunt-variable': ['success', 'air', 'air', 'crash'],
  'hunt-else': ['success', 'missed', 'crash', 'air'],
  'hunt-break': ['success', 'crash', 'crash', 'error'],
  'hunt-countdown': ['success', 'air', 'air', 'eaten'],
  'hunt-index': ['success', 'air', 'eaten', 'air'],
  'hunt-guard': ['success', 'loop', 'air', 'crash'],
  'hunt-call': ['success', 'missed', 'missed', 'error'],
  'hunt-range-two': ['success', 'air', 'eaten', 'air'],
  'hunt-stairs': ['success', 'crash', 'missed', 'air'],
  'hunt-turn': ['success', 'crash', 'missed', 'air'],
  'hunt-break-count': ['success', 'missed', 'missed', 'crash'],
  'hunt-corner': ['success', 'crash', 'missed', 'air'],
  'hunt-hit-twice': ['success', 'missed', 'crash', 'missed'],
  'hunt-hydra-then-gold': ['success', 'missed', 'crash', 'missed'],
  'hunt-rock': ['success', 'crash', 'missed', 'air'],
  'hunt-last-round': ['success', 'air', 'crash', 'air'],
  'hunt-not': ['success', 'air', 'eaten', 'air'],
  'hunt-elif': ['success', 'crash', 'air', 'air'],
  'hunt-two-functions': ['success', 'crash', 'error', 'missed'],
  'hunt-hop': ['success', 'missed', 'air', 'crash'],
  'hunt-count-up': ['success', 'air', 'eaten', 'air'],
  'hunt-plus-equals': ['success', 'missed', 'crash', 'missed'],
  'hunt-arithmetic': ['success', 'air', 'eaten', 'air'],
  'hunt-down-to-hydra': ['success', 'crash', 'crash', 'loop'],
  'hunt-and-back': ['success', 'missed', 'crash', 'missed'],
  'hunt-break-for': ['success', 'crash', 'error', 'air'],
  'hunt-two-ifs': ['success', 'air', 'missed', 'air'],
  'hunt-or': ['success', 'missed', 'air', 'air'],
  'hunt-and': ['success', 'eaten', 'air', 'air'],
  'hunt-flag': ['success', 'crash', 'error', 'air'],
  'hunt-return': ['success', 'air', 'eaten', 'air'],
  'hunt-range-step': ['success', 'eaten', 'air', 'air'],
  'hunt-check-in-function': ['success', 'air', 'missed', 'air'],
};

/** What the player sees of a run: the warrior's path, the hydras slain, the gold taken and how it ended. */
const behaviour = (trace: Trace) =>
  JSON.stringify([trace.steps.map((s) => [s.x, s.y, s.slain, s.taken]), trace.outcome]);

describe('hunt levels', () => {
  it('has 5 to 44 levels with unique ids', () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(5);
    expect(LEVELS.length).toBeLessThanOrEqual(44);
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length);
    expect(Object.keys(EXPECTED)).toEqual(LEVELS.map((l) => l.id));
  });

  for (const level of LEVELS) {
    describe(level.id, () => {
      const world = parseMap(level.map);
      const traces = level.choices.map((_, i) => simulate(world, fill(level, i)));

      it('is well formed', () => {
        expect(level.code.split(GAP)).toHaveLength(2);
        expect(level.choices).toHaveLength(4);
        expect(new Set(level.choices.map((c) => c.code)).size).toBe(4);
        expect(world.hydras.length + world.gold.length).toBeGreaterThan(0);
        for (const lang of LANGS) {
          for (const text of [level.title, level.intro, ...level.choices.map((c) => c.note)]) {
            expect(text[lang].trim(), `${level.id} ${lang}`).not.toBe('');
          }
        }
      });

      it('parses with every choice (typos only fail when they run)', () => {
        for (const [i, choice] of level.choices.entries()) expect(() => parse(fill(level, i)), choice.code).not.toThrow();
      });

      it('is solved by the right answer only', () => {
        expect(traces.map((t) => t.outcome.kind)).toEqual(EXPECTED[level.id]);
        expect(traces[level.answerIndex]!.outcome.kind).toBe('success');
        for (const [i, trace] of traces.entries()) if (i !== level.answerIndex) expect(trace.outcome.kind).not.toBe('success');
      });

      it('gives every answer its own visible behaviour', () => {
        expect(new Set(traces.map(behaviour)).size).toBe(4);
      });

      it('never names the right answer in the note of a wrong one', () => {
        const right = level.choices[level.answerIndex]!.code;
        for (const [i, choice] of level.choices.entries()) {
          if (i === level.answerIndex) continue;
          for (const lang of LANGS) expect(choice.note[lang], `${choice.code} ${lang}`).not.toContain(`\`${right}\``);
        }
      });

      it('fits a phone: at most 7 cells wide and 7 high, and short runs', () => {
        expect(world.width).toBeLessThanOrEqual(7);
        expect(world.height).toBeLessThanOrEqual(7);
        for (const trace of traces) expect(trace.steps.length).toBeLessThanOrEqual(80);
      });
    });
  }
});
