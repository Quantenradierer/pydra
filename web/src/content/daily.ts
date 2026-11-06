import { changedLines } from './diff.ts';
import type { Localized, Question, Topic } from './types.ts';
import collections from './daily/collections.json';
import controlFlow from './daily/control-flow.json';
import dictsSets from './daily/dicts-sets.json';
import functions from './daily/functions.json';
import intro from './daily/intro.json';
import loops from './daily/loops.json';
import operators from './daily/operators.json';
import strings from './daily/strings.json';
import types from './daily/types.json';

/**
 * The daily challenge: one snippet a day, five questions that follow the code
 * as it grows and changes, from easy to hard. Checked by daily.test.ts.
 */
export const DAILY_STEPS = ['trace', 'extend', 'whatif', 'diff', 'requirement'] as const;
export type DailyStepKind = (typeof DAILY_STEPS)[number];

/** One multiple-choice step; the prompt is written out in the data. */
export interface DailyStepData {
  prompt: Localized;
  /** Exactly four choices. */
  choices: Localized[];
  answerIndex: 0 | 1 | 2 | 3;
  explanation: Localized;
}

export interface DailySnippet {
  /** Stable and unique, e.g. "loops-02". Saved runs refer to it. */
  id: string;
  topic: Topic;
  /**
   * Difficulty: 1 easy, 2 medium, 3 hard. 0 = one of the intro week (the first
   * 7 days, played once in order, never in the regular cycle).
   */
  level: 0 | 1 | 2 | 3;
  /** The whole program (step 2, 4 and 5); its first 3 lines are step 1. */
  code: string;
  /** Step 3: the program with one changed line. */
  variant: string;
  /** Step 4: version B (`code` is version A). */
  altered: string;
  /** Step 5: the 1-based first and last line the player replaces. */
  requirement: [number, number];
  /** One per kind in DAILY_STEPS. */
  steps: DailyStepData[];
}

/** Lines of the program shown in step 1. */
export const TRACE_LINES = 3;

export const DAILY_SNIPPETS: readonly DailySnippet[] = [
  ...intro,
  ...types,
  ...operators,
  ...strings,
  ...controlFlow,
  ...loops,
  ...collections,
  ...dictsSets,
  ...functions,
] as DailySnippet[];

/** A step as a question of the quiz screen, plus what the daily screen marks in the code. */
export interface DailyQuestion extends Question {
  kind: DailyStepKind;
  /** 1-based lines of `code` that were just added (step 2). */
  added?: number[];
  /** 1-based lines of `code` that changed or are to be replaced (steps 3 and 5). */
  changed?: number[];
}

export const dailyQuestionId = (snippet: string, step: number) => `daily-${snippet}-${step + 1}`;

/** The five questions of a snippet, in order. */
export function dailyQuestions(snippet: DailySnippet): DailyQuestion[] {
  const lines = snippet.code.split('\n');
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const shown: Partial<DailyQuestion>[] = [
    { code: lines.slice(0, TRACE_LINES).join('\n') },
    { code: snippet.code, added: range(TRACE_LINES + 1, lines.length) },
    { code: snippet.variant, changed: changedLines(snippet.variant, snippet.code) },
    { code: snippet.code, codeB: snippet.altered },
    { code: snippet.code, changed: range(snippet.requirement[0], snippet.requirement[1]) },
  ];
  return DAILY_STEPS.map((kind, i): DailyQuestion => {
    const step = snippet.steps[i]!;
    return {
      id: dailyQuestionId(snippet.id, i),
      topic: snippet.topic,
      kind,
      prompt: step.prompt,
      choices: step.choices,
      answerIndex: step.answerIndex,
      explanation: step.explanation,
      ...shown[i]!,
    } as DailyQuestion;
  });
}

/** Every daily question by id. */
export const DAILY_BY_ID: ReadonlyMap<string, DailyQuestion> = new Map(
  DAILY_SNIPPETS.flatMap(dailyQuestions).map((q) => [q.id, q]),
);
