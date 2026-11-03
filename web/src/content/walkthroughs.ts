import type { Localized, Question, Walkthrough } from './types.ts';
import average from './walkthroughs/average.json';
import countVowels from './walkthroughs/count-vowels.json';
import findMax from './walkthroughs/find-max.json';
import greet from './walkthroughs/greet.json';

/** The functions of the "read a function" lesson, easiest first. Checked by walkthroughs.test.ts. */
export const WALKTHROUGHS = [greet, average, countVowels, findMax] as Walkthrough[];

export function linePrompt(line: number): Localized {
  return { de: `Was macht die markierte Zeile ${line}?`, en: `What does the highlighted line ${line} do?` };
}

export const WHOLE_PROMPT: Localized = { de: 'Was macht die ganze Funktion?', en: 'What does the whole function do?' };

/** Question id of a walkthrough step: `walk-<id>-NN` per line, `walk-<id>-whole` at the end. */
export function stepId(walkthroughId: string, line?: number): string {
  return `walk-${walkthroughId}-${line === undefined ? 'whole' : String(line).padStart(2, '0')}`;
}

/** The walkthrough as quiz questions in play order: every line, then the whole function. */
export function walkthroughQuestions(w: Walkthrough): Question[] {
  const base = { topic: 'functions', code: w.code } as const;
  return [
    ...w.lines.map(({ line, choices, answerIndex, explanation }) => ({
      ...base,
      id: stepId(w.id, line),
      prompt: linePrompt(line),
      line,
      choices,
      answerIndex,
      explanation,
    })),
    { ...base, id: stepId(w.id), prompt: WHOLE_PROMPT, ...w.whole },
  ];
}
