import { describe, expect, it } from 'vitest';
import { LANGS } from '../i18n.ts';
import { CONTENT } from './lessons.ts';
import { QUESTIONS_BY_ID } from './questions.ts';
import { WALKTHROUGHS, stepId, walkthroughQuestions } from './walkthroughs.ts';

describe('walkthrough content', () => {
  it('has 3 to 6 functions with unique ids', () => {
    expect(WALKTHROUGHS.length).toBeGreaterThanOrEqual(3);
    expect(WALKTHROUGHS.length).toBeLessThanOrEqual(6);
    expect(new Set(WALKTHROUGHS.map((w) => w.id)).size).toBe(WALKTHROUGHS.length);
  });

  it('has step ids that collide with no other question', () => {
    const ids = WALKTHROUGHS.flatMap((w) => walkthroughQuestions(w).map((q) => q.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(QUESTIONS_BY_ID.has(id), id).toBe(false);
    expect(CONTENT.byId.size).toBe(QUESTIONS_BY_ID.size + ids.length);
  });

  describe.each(WALKTHROUGHS.map((w) => [w.id, w] as const))('%s', (_id, w) => {
    const lines = w.code.split('\n');

    it('is one function of 4 to 8 lines without blank lines', () => {
      expect(lines[0]).toMatch(/^def \w+\(.*\):$/);
      expect(lines.length).toBeGreaterThanOrEqual(4);
      expect(lines.length).toBeLessThanOrEqual(8);
      for (const line of lines) expect(line.trim()).not.toBe('');
    });

    it('asks about every line once, in order, then about the whole function', () => {
      expect(w.lines.map((s) => s.line)).toEqual(lines.map((_, i) => i + 1));
      const questions = walkthroughQuestions(w);
      expect(questions.map((q) => q.id)).toEqual([...w.lines.map((s) => stepId(w.id, s.line)), stepId(w.id)]);
      expect(questions.at(-1)!.line).toBeUndefined();
      expect(questions.at(-1)!.prompt.en).toBe('What does the whole function do?');
      expect(questions[1]!.prompt.de).toBe('Was macht die markierte Zeile 2?');
    });

    describe.each([...w.lines, w.whole].map((s, i) => [i + 1, s] as const))('step %i', (_n, step) => {
      it('has 4 distinct non-empty choices per language, a valid answer and an explanation', () => {
        expect(step.choices).toHaveLength(4);
        expect([0, 1, 2, 3]).toContain(step.answerIndex);
        for (const lang of LANGS) {
          expect(new Set(step.choices.map((c) => c[lang].trim())).size, lang).toBe(4);
          for (const choice of step.choices) expect(choice[lang].trim()).not.toBe('');
          expect(step.explanation[lang].trim()).not.toBe('');
          expect(step.explanation[lang].split('\n\n').length, lang).toBeLessThanOrEqual(2);
        }
      });
    });
  });
});
