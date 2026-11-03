import { describe, expect, it } from 'vitest';
import { LANGS } from '../i18n.ts';
import { QUESTIONS, QUESTIONS_BY_ID } from './questions.ts';
import { TOPICS } from './types.ts';

describe('question content', () => {
  it('has 80 questions, 10 per topic', () => {
    expect(QUESTIONS).toHaveLength(80);
    for (const topic of TOPICS) {
      expect(QUESTIONS.filter((q) => q.topic === topic), topic).toHaveLength(10);
    }
  });

  it('has unique ids prefixed with the topic', () => {
    expect(QUESTIONS_BY_ID.size).toBe(QUESTIONS.length);
    for (const q of QUESTIONS) {
      expect(q.id, q.id).toMatch(new RegExp(`^${q.topic}-\\d{2}$`));
      expect(TOPICS, q.id).toContain(q.topic);
    }
  });

  describe.each(QUESTIONS.map((q) => [q.id, q] as const))('%s', (_id, q) => {
    it('has exactly 4 choices and a valid answer index', () => {
      expect(q.choices).toHaveLength(4);
      expect([0, 1, 2, 3]).toContain(q.answerIndex);
    });

    it('has non-empty texts in every language', () => {
      for (const lang of LANGS) {
        expect(q.prompt[lang].trim(), `prompt ${lang}`).not.toBe('');
        expect(q.explanation[lang].trim(), `explanation ${lang}`).not.toBe('');
        for (const choice of q.choices) expect(choice[lang].trim(), `choice ${lang}`).not.toBe('');
      }
    });

    it('has distinct choices in every language', () => {
      for (const lang of LANGS) {
        expect(new Set(q.choices.map((c) => c[lang])).size, lang).toBe(4);
      }
    });

    it('has one language-neutral code snippet, if any', () => {
      // The snippet is a single string, so it cannot differ between languages.
      if (q.code !== undefined) {
        expect(typeof q.code).toBe('string');
        expect(q.code.trim()).not.toBe('');
      }
      expect(Object.keys(q).sort()).toEqual(
        ['answerIndex', 'choices', 'explanation', 'id', 'prompt', 'topic', ...(q.code === undefined ? [] : ['code'])].sort(),
      );
    });
  });
});
