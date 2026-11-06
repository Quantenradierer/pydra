import { describe, expect, it } from 'vitest';
import { LANGS } from '../i18n.ts';
import { changedLines } from './diff.ts';
import { DAILY_BY_ID, DAILY_SNIPPETS, DAILY_STEPS, dailyQuestions, TRACE_LINES } from './daily.ts';
import { CONTENT } from './lessons.ts';
import { TOPICS } from './types.ts';

describe('daily challenge content', () => {
  const regular = DAILY_SNIPPETS.filter((s) => s.level > 0);
  const intro = DAILY_SNIPPETS.filter((s) => s.level === 0);

  it('has at least 45 regular snippets with unique ids, at least 4 per topic', () => {
    expect(regular.length).toBeGreaterThanOrEqual(45);
    expect(new Set(DAILY_SNIPPETS.map((s) => s.id)).size).toBe(DAILY_SNIPPETS.length);
    for (const topic of TOPICS) expect(regular.filter((s) => s.topic === topic).length, topic).toBeGreaterThanOrEqual(4);
    for (const s of regular) expect(s.id, s.id).toMatch(new RegExp(`^${s.topic}-\\d{2}$`));
  });

  it('has levels 1 to 3 for the regular snippets, with enough of each to start gently', () => {
    for (const s of regular) expect([1, 2, 3], s.id).toContain(s.level);
    for (const level of [1, 2, 3]) expect(regular.filter((s) => s.level === level).length, `level ${level}`).toBeGreaterThanOrEqual(6);
    // Level 1 covers many topics, so the first weeks after the intro are not one subject.
    expect(new Set(regular.filter((s) => s.level === 1).map((s) => s.topic)).size).toBeGreaterThanOrEqual(6);
    expect(regular.filter((s) => s.level === 1).length).toBeGreaterThanOrEqual(21);
    for (const topic of TOPICS) expect(regular.filter((s) => s.level === 1 && s.topic === topic).length, `${topic} level 1`).toBeGreaterThanOrEqual(2);
    expect(regular.find((s) => s.id === 'strings-05')!.level).toBe(3);
    expect(regular.find((s) => s.id === 'loops-05')!.level).toBe(3);
  });

  describe('the intro week', () => {
    it('has 7 snippets intro-01 to intro-07 with level 0, in order', () => {
      expect(intro.map((s) => s.id)).toEqual(Array.from({ length: 7 }, (_, i) => `intro-0${i + 1}`));
      expect(DAILY_SNIPPETS.slice(0, 7)).toEqual(intro);
      for (const s of intro) expect(TOPICS, s.id).toContain(s.topic);
    });

    it.each(intro.map((s) => [s.id, s] as const))('%s is really easy', (_id, s) => {
      for (const code of [s.code, s.variant, s.altered]) {
        const ls = code.split('\n');
        expect(ls.length).toBeGreaterThanOrEqual(4);
        expect(ls.length).toBeLessThanOrEqual(7);
        expect(code, 'no f-strings').not.toMatch(/\bf["']/);
        expect(code, 'no slicing').not.toMatch(/\[[^\]]*:[^\]]*\]/);
        expect(code, 'no import / while / lambda / class / try / comprehension').not.toMatch(/\b(import|while|lambda|class|try|with|elif|break|continue)\b/);
        expect(code.replace(/"[^"]*"/g, '""'), 'no tricky operators').not.toMatch(/\/\/|%|\*\*|\+=|-=|\band\b|\bor\b|\bnot\b|\bin\b(?! range)/);
        expect(code.match(/^ +/gm)?.every((i) => i.length === 4), 'one indentation level').not.toBe(false);
        for (const n of code.match(/\d+/g) ?? []) expect(Number(n), 'tiny numbers').toBeLessThanOrEqual(15);
      }
      for (const step of s.steps) {
        for (const lang of LANGS) expect(step.explanation[lang].length, 'short explanation').toBeLessThanOrEqual(520);
      }
      expect(s.requirement[0]).toBe(s.requirement[1]); // a one-line change
    });
  });

  it('has question ids that collide with no other question', () => {
    expect(DAILY_BY_ID.size).toBe(DAILY_SNIPPETS.length * DAILY_STEPS.length);
    for (const id of DAILY_BY_ID.keys()) expect(CONTENT.byId.has(id), id).toBe(false);
  });

  it('does not make the right choice the longest too often', () => {
    let longest = 0;
    let total = 0;
    for (const s of DAILY_SNIPPETS) {
      for (const step of s.steps.slice(3)) {
        const lens = step.choices.map((c) => c.de.length);
        total++;
        if (lens[step.answerIndex]! === Math.max(...lens) && lens.filter((l) => l === Math.max(...lens)).length === 1) longest++;
      }
    }
    expect(longest / total).toBeLessThan(0.3);
  });

  describe.each(DAILY_SNIPPETS.map((s) => [s.id, s] as const))('%s', (_id, s) => {
    const lines = s.code.split('\n');

    it('has short programs without blank lines, of equal length', () => {
      expect(lines.length).toBeGreaterThanOrEqual(s.level === 0 ? 4 : 5);
      expect(lines.length).toBeLessThanOrEqual(s.level === 0 ? 7 : 9);
      for (const code of [s.code, s.variant, s.altered]) {
        const ls = code.split('\n');
        expect(ls.length).toBe(lines.length);
        for (const line of ls) {
          expect(line.trim(), 'blank line').not.toBe('');
          expect(line.length).toBeLessThanOrEqual(40);
        }
      }
    });

    it('has five steps in the right order, each with 4 distinct choices and texts in both languages', () => {
      expect(s.steps).toHaveLength(DAILY_STEPS.length);
      for (const step of s.steps) {
        expect(step.choices).toHaveLength(4);
        expect([0, 1, 2, 3]).toContain(step.answerIndex);
        for (const lang of LANGS) {
          expect(new Set(step.choices.map((c) => c[lang])).size, lang).toBe(4);
          expect(step.prompt[lang].trim()).not.toBe('');
          expect(step.explanation[lang].trim()).not.toBe('');
          for (const c of step.choices) expect(c[lang].trim()).not.toBe('');
        }
      }
    });

    it('builds the five questions from one program', () => {
      const qs = dailyQuestions(s);
      expect(qs.map((q) => q.kind)).toEqual([...DAILY_STEPS]);
      const [trace, extend, whatif, diff, requirement] = qs as [(typeof qs)[0], (typeof qs)[0], (typeof qs)[0], (typeof qs)[0], (typeof qs)[0]];
      // Step 1 is exactly the first 3 lines of step 2, which extends it.
      expect(trace.code).toBe(lines.slice(0, TRACE_LINES).join('\n'));
      expect(extend.code!.startsWith(`${trace.code}\n`)).toBe(true);
      expect(extend.added).toEqual(lines.slice(TRACE_LINES).map((_, i) => TRACE_LINES + 1 + i));
      // Step 3 changes something; step 4 is a real A/B pair; step 5 marks lines of the program.
      expect(changedLines(whatif.code!, extend.code!).length).toBeGreaterThan(0);
      expect(whatif.changed).toEqual(changedLines(whatif.code!, extend.code!));
      expect(diff.code).toBe(s.code);
      expect(diff.codeB).not.toBe(diff.code);
      expect(changedLines(diff.code!, diff.codeB!).length).toBeGreaterThan(0);
      expect(requirement.code).toBe(s.code);
      const [a, b] = s.requirement;
      expect(a).toBeGreaterThanOrEqual(1);
      expect(b).toBeLessThanOrEqual(lines.length);
      expect(a).toBeLessThanOrEqual(b);
    });
  });
});
