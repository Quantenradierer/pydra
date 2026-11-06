import { describe, expect, it } from 'vitest';
import { LANGS } from '../i18n.ts';
import { tracePrint } from './predict.ts';
import { PREDICT_LEVELS } from './predict-levels.ts';

/**
 * Every level's output is what the interpreter prints. The same programs
 * were run with real `python3`, which printed exactly these lines too.
 */
describe('predict levels', () => {
  it('has 10 to 40 levels with unique ids', () => {
    expect(PREDICT_LEVELS.length).toBeGreaterThanOrEqual(10);
    expect(PREDICT_LEVELS.length).toBeLessThanOrEqual(40);
    expect(new Set(PREDICT_LEVELS.map((l) => l.id)).size).toBe(PREDICT_LEVELS.length);
  });

  for (const level of PREDICT_LEVELS) {
    describe(level.id, () => {
      it('is well formed: texts in every language, indents of 4 spaces', () => {
        for (const lang of LANGS) {
          for (const text of [level.title, level.intro, level.hint, level.explain]) expect(text[lang].trim(), `${level.id} ${lang}`).not.toBe('');
        }
        for (const line of level.code.split('\n')) expect(/^ */.exec(line)![0].length % 4, line).toBe(0);
      });

      it('prints exactly its output, without an error', () => {
        const trace = tracePrint(level.code);
        expect(trace.error).toBeUndefined();
        expect(trace.output).toEqual(level.output);
        expect(trace.steps.at(-1)).toMatchObject({ line: null, printed: level.output.length });
      });

      it('is beginner sized and fits a phone: 1 to 4 short lines out of at most 6 lines of code, a short run', () => {
        expect(level.output.length).toBeGreaterThanOrEqual(1);
        expect(level.output.length).toBeLessThanOrEqual(4);
        expect(level.code.split('\n').length).toBeLessThanOrEqual(6);
        for (const line of level.code.split('\n')) expect(line.length, line).toBeLessThanOrEqual(30);
        for (const line of level.output) {
          // A line the player can type: no spaces around it, short.
          expect(line).toBe(line.trim());
          expect(line.length).toBeGreaterThan(0);
          expect(line.length).toBeLessThanOrEqual(16);
        }
        expect(tracePrint(level.code).steps.length).toBeLessThanOrEqual(40);
      });
    });
  }
});
