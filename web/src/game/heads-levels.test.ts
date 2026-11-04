import { describe, expect, it } from 'vitest';
import { LANGS } from '../i18n.ts';
import { HEADS_LEVELS } from './heads-levels.ts';
import { simulateHeads, type HeadsOutcome, type HeadsTrace } from './heads.ts';
import { fill, GAP } from './puzzle.ts';
import { parse } from './python.ts';

/**
 * How every answer of every level ends, in choice order (the right one first
 * in the data). Checked against real Python too: the same programs, run by
 * python3, print and store the same values and raise the same errors.
 */
const EXPECTED: Record<string, HeadsOutcome['kind'][]> = {
  call: ['success', 'output', 'output', 'error'],
  parameter: ['success', 'wrong', 'error', 'error'],
  return: ['success', 'wrong', 'wrong', 'wrong'],
  'use-result': ['success', 'error', 'wrong', 'wrong'],
  locals: ['success', 'error', 'wrong', 'wrong'],
  'nested-calls': ['success', 'wrong', 'error', 'error'],
  'two-parameters': ['success', 'wrong', 'error', 'wrong'],
  countdown: ['success', 'output', 'error', 'error'],
};

/** What the player sees of a run: the heads, the variables, the output, and how it ended. */
const behaviour = (trace: HeadsTrace) =>
  JSON.stringify([trace.steps.map((s) => [s.line, s.heads, s.globals, s.output, s.returned]), trace.outcome]);

describe('heads levels', () => {
  it('has 5 to 12 levels with unique ids', () => {
    expect(HEADS_LEVELS.length).toBeGreaterThanOrEqual(5);
    expect(HEADS_LEVELS.length).toBeLessThanOrEqual(12);
    expect(new Set(HEADS_LEVELS.map((l) => l.id)).size).toBe(HEADS_LEVELS.length);
    expect(Object.keys(EXPECTED)).toEqual(HEADS_LEVELS.map((l) => l.id));
  });

  for (const level of HEADS_LEVELS) {
    describe(level.id, () => {
      const traces = level.choices.map((_, i) => simulateHeads(level, fill(level, i)));

      it('is well formed', () => {
        expect(level.code.split(GAP)).toHaveLength(2);
        expect(level.choices).toHaveLength(4);
        expect(new Set(level.choices.map((c) => c.code)).size).toBe(4);
        expect(Object.keys(level.goal.vars ?? {}).length + (level.goal.output?.length ?? 0)).toBeGreaterThan(0);
        for (const lang of LANGS) {
          for (const text of [level.title, level.intro, ...level.choices.map((c) => c.note)]) {
            expect(text[lang].trim(), `${level.id} ${lang}`).not.toBe('');
          }
        }
      });

      it('parses with every choice (mistakes only fail when they run)', () => {
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

      it('grows at least one head with the right answer', () => {
        expect(Math.max(...traces[level.answerIndex]!.steps.map((s) => s.heads.length))).toBeGreaterThan(0);
      });

      it('never names the right answer in the note of a wrong one', () => {
        const right = level.choices[level.answerIndex]!.code;
        for (const [i, choice] of level.choices.entries()) {
          if (i === level.answerIndex) continue;
          for (const lang of LANGS) expect(choice.note[lang], `${choice.code} ${lang}`).not.toContain(`\`${right}\``);
        }
      });

      it('keeps the right run short', () => {
        expect(traces[level.answerIndex]!.steps.length).toBeLessThanOrEqual(30);
      });
    });
  }
});
