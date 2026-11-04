import type { Localized, Question, Walkthrough } from './types.ts';
import average from './walkthroughs/average.json';
import biggerOf from './walkthroughs/bigger-of.json';
import countLongWords from './walkthroughs/count-long-words.json';
import countVowels from './walkthroughs/count-vowels.json';
import countWords from './walkthroughs/count-words.json';
import factorial from './walkthroughs/factorial.json';
import findIndex from './walkthroughs/find-index.json';
import findMax from './walkthroughs/find-max.json';
import firstAndLast from './walkthroughs/first-and-last.json';
import fullName from './walkthroughs/full-name.json';
import greet from './walkthroughs/greet.json';
import inRange from './walkthroughs/in-range.json';
import initials from './walkthroughs/initials.json';
import isEven from './walkthroughs/is-even.json';
import isWeekend from './walkthroughs/is-weekend.json';
import keepPositive from './walkthroughs/keep-positive.json';
import priceTag from './walkthroughs/price-tag.json';
import rectanglePerimeter from './walkthroughs/rectangle-perimeter.json';
import repeatWord from './walkthroughs/repeat-word.json';
import shout from './walkthroughs/shout.json';
import sign from './walkthroughs/sign.json';
import squares from './walkthroughs/squares.json';
import sumTo from './walkthroughs/sum-to.json';
import ticketPrice from './walkthroughs/ticket-price.json';
import toFahrenheit from './walkthroughs/to-fahrenheit.json';
import totalPrice from './walkthroughs/total-price.json';

/** The functions of the "read a function" lesson, easiest first. Checked by walkthroughs.test.ts. */
export const WALKTHROUGHS = [
  greet,
  shout,
  rectanglePerimeter,
  totalPrice,
  toFahrenheit,
  fullName,
  initials,
  repeatWord,
  countWords,
  priceTag,
  isEven,
  biggerOf,
  sign,
  inRange,
  isWeekend,
  ticketPrice,
  sumTo,
  factorial,
  average,
  squares,
  countVowels,
  countLongWords,
  firstAndLast,
  keepPositive,
  findIndex,
  findMax,
] as Walkthrough[];

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
