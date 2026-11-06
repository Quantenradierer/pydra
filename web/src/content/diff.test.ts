import { describe, expect, it } from 'vitest';
import { LANGS } from '../i18n.ts';
import { changedLines, DIFF_QUESTIONS } from './diff.ts';
import { CONTENT } from './lessons.ts';
import { QUESTIONS_BY_ID } from './questions.ts';
import { TOPICS } from './types.ts';

describe('spot-the-difference content', () => {
  it('has at least 60 questions, at least 5 per topic', () => {
    expect(DIFF_QUESTIONS.length).toBeGreaterThanOrEqual(60);
    for (const topic of TOPICS) {
      expect(DIFF_QUESTIONS.filter((q) => q.topic === topic).length, topic).toBeGreaterThanOrEqual(5);
    }
  });

  it('has unique ids prefixed diff-<topic>- that collide with no other question', () => {
    expect(new Set(DIFF_QUESTIONS.map((q) => q.id)).size).toBe(DIFF_QUESTIONS.length);
    for (const q of DIFF_QUESTIONS) {
      expect(q.id, q.id).toMatch(new RegExp(`^diff-${q.topic}-\\d{2}$`));
      expect(QUESTIONS_BY_ID.has(q.id), q.id).toBe(false);
    }
    const walkIds = [...CONTENT.byId.keys()].filter((id) => id.startsWith('walk-'));
    expect(CONTENT.byId.size).toBe(QUESTIONS_BY_ID.size + DIFF_QUESTIONS.length + walkIds.length);
  });

  describe.each(DIFF_QUESTIONS.map((q) => [q.id, q] as const))('%s', (_id, q) => {
    it('has exactly 4 distinct choices and a valid answer index', () => {
      expect(q.choices).toHaveLength(4);
      expect([0, 1, 2, 3]).toContain(q.answerIndex);
      for (const lang of LANGS) expect(new Set(q.choices.map((c) => c[lang])).size, lang).toBe(4);
    });

    it('has non-empty texts in every language', () => {
      for (const lang of LANGS) {
        expect(q.prompt[lang].trim(), `prompt ${lang}`).not.toBe('');
        expect(q.explanation[lang].trim(), `explanation ${lang}`).not.toBe('');
        for (const choice of q.choices) expect(choice[lang].trim(), `choice ${lang}`).not.toBe('');
      }
    });

    it('has two short, different snippets', () => {
      expect(q.code?.trim()).toBeTruthy();
      expect(q.codeB?.trim()).toBeTruthy();
      expect(q.code).not.toBe(q.codeB);
      for (const code of [q.code!, q.codeB!]) {
        const lines = code.split('\n');
        expect(lines.length).toBeLessThanOrEqual(6);
        for (const line of lines) {
          expect(line.trim(), 'blank line').not.toBe('');
          expect(line.length, line).toBeLessThanOrEqual(48);
        }
      }
      expect(changedLines(q.code!, q.codeB!).length, 'a changed line in A').toBeGreaterThan(0);
      expect(changedLines(q.codeB!, q.code!).length, 'a changed line in B').toBeGreaterThan(0);
    });

    it('has no other fields', () => {
      expect(Object.keys(q).sort()).toEqual(['answerIndex', 'choices', 'code', 'codeB', 'explanation', 'id', 'prompt', 'topic']);
    });
  });
});

describe('changedLines', () => {
  it('compares line by line when both have as many lines', () => {
    expect(changedLines('a = 1\nprint(a)', 'a = 2\nprint(a)')).toEqual([1]);
    expect(changedLines('for i in x:\n    f()\ng()', 'for i in x:\n    f()\n    g()')).toEqual([3]);
  });

  it('falls back to lines without an identical counterpart', () => {
    expect(changedLines('a\nb', 'a')).toEqual([2]);
    expect(changedLines('a', 'a\nb')).toEqual([]);
  });
});
