import type { Localized, Question, Walkthrough } from './types.ts';
import absolute from './walkthroughs/absolute.json';
import average from './walkthroughs/average.json';
import biggerOf from './walkthroughs/bigger-of.json';
import bmi from './walkthroughs/bmi.json';
import circleArea from './walkthroughs/circle-area.json';
import clamp from './walkthroughs/clamp.json';
import commonItems from './walkthroughs/common-items.json';
import countAboveAverage from './walkthroughs/count-above-average.json';
import countDown from './walkthroughs/count-down.json';
import countLetter from './walkthroughs/count-letter.json';
import countLetters from './walkthroughs/count-letters.json';
import countLongWords from './walkthroughs/count-long-words.json';
import countUntilZero from './walkthroughs/count-until-zero.json';
import countVowels from './walkthroughs/count-vowels.json';
import countWords from './walkthroughs/count-words.json';
import describeList from './walkthroughs/describe-list.json';
import digitSum from './walkthroughs/digit-sum.json';
import discount from './walkthroughs/discount.json';
import divisibility from './walkthroughs/divisibility.json';
import evensUpTo from './walkthroughs/evens-up-to.json';
import expensiveItems from './walkthroughs/expensive-items.json';
import factorial from './walkthroughs/factorial.json';
import fib from './walkthroughs/fib.json';
import findIndex from './walkthroughs/find-index.json';
import findMax from './walkthroughs/find-max.json';
import firstAndLast from './walkthroughs/first-and-last.json';
import firstWord from './walkthroughs/first-word.json';
import fullName from './walkthroughs/full-name.json';
import greet from './walkthroughs/greet.json';
import gridCells from './walkthroughs/grid-cells.json';
import inRange from './walkthroughs/in-range.json';
import initialLetters from './walkthroughs/initial-letters.json';
import initials from './walkthroughs/initials.json';
import isEven from './walkthroughs/is-even.json';
import isPalindrome from './walkthroughs/is-palindrome.json';
import isSorted from './walkthroughs/is-sorted.json';
import isWeekend from './walkthroughs/is-weekend.json';
import keepPositive from './walkthroughs/keep-positive.json';
import leapYear from './walkthroughs/leap-year.json';
import makeEmail from './walkthroughs/make-email.json';
import makeTitle from './walkthroughs/make-title.json';
import medal from './walkthroughs/medal.json';
import middleValue from './walkthroughs/middle-value.json';
import minMax from './walkthroughs/min-max.json';
import needsUmbrella from './walkthroughs/needs-umbrella.json';
import numbered from './walkthroughs/numbered.json';
import pairUp from './walkthroughs/pair-up.json';
import parseAndAdd from './walkthroughs/parse-and-add.json';
import passOrFail from './walkthroughs/pass-or-fail.json';
import power from './walkthroughs/power.json';
import powerOfTwoAbove from './walkthroughs/power-of-two-above.json';
import priceTag from './walkthroughs/price-tag.json';
import rectanglePerimeter from './walkthroughs/rectangle-perimeter.json';
import removeDuplicates from './walkthroughs/remove-duplicates.json';
import repeatWord from './walkthroughs/repeat-word.json';
import rotate from './walkthroughs/rotate.json';
import safeDivide from './walkthroughs/safe-divide.json';
import shorten from './walkthroughs/shorten.json';
import shout from './walkthroughs/shout.json';
import sign from './walkthroughs/sign.json';
import splitSeconds from './walkthroughs/split-seconds.json';
import squares from './walkthroughs/squares.json';
import startsWithCapital from './walkthroughs/starts-with-capital.json';
import sumList from './walkthroughs/sum-list.json';
import sumOdd from './walkthroughs/sum-odd.json';
import sumTo from './walkthroughs/sum-to.json';
import swapPair from './walkthroughs/swap-pair.json';
import ticketPrice from './walkthroughs/ticket-price.json';
import timesTable from './walkthroughs/times-table.json';
import toFahrenheit from './walkthroughs/to-fahrenheit.json';
import topThree from './walkthroughs/top-three.json';
import totalPrice from './walkthroughs/total-price.json';
import twoDigits from './walkthroughs/two-digits.json';
import uniqueCount from './walkthroughs/unique-count.json';
import withNewItem from './walkthroughs/with-new-item.json';
import wordLengths from './walkthroughs/word-lengths.json';

/** The functions of the "read a function" lesson, easiest first. Checked by walkthroughs.test.ts. */
export const WALKTHROUGHS = [
  greet,
  shout,
  rectanglePerimeter,
  circleArea,
  totalPrice,
  discount,
  toFahrenheit,
  bmi,
  parseAndAdd,
  fullName,
  firstWord,
  initials,
  makeEmail,
  repeatWord,
  countWords,
  priceTag,
  startsWithCapital,
  twoDigits,
  swapPair,
  splitSeconds,
  minMax,
  isEven,
  biggerOf,
  absolute,
  sign,
  passOrFail,
  inRange,
  isWeekend,
  needsUmbrella,
  makeTitle,
  safeDivide,
  shorten,
  clamp,
  ticketPrice,
  describeList,
  leapYear,
  divisibility,
  isPalindrome,
  countLetter,
  sumTo,
  sumList,
  factorial,
  average,
  evensUpTo,
  countDown,
  squares,
  timesTable,
  initialLetters,
  countVowels,
  countLongWords,
  firstAndLast,
  rotate,
  topThree,
  middleValue,
  isSorted,
  withNewItem,
  keepPositive,
  sumOdd,
  countUntilZero,
  digitSum,
  powerOfTwoAbove,
  findIndex,
  removeDuplicates,
  findMax,
  uniqueCount,
  commonItems,
  wordLengths,
  countLetters,
  medal,
  pairUp,
  numbered,
  gridCells,
  expensiveItems,
  countAboveAverage,
  power,
  fib,
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
