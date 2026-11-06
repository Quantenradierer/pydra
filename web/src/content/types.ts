import type { Lang } from '../i18n.ts';

export const TOPICS = [
  'types',
  'operators',
  'strings',
  'control-flow',
  'loops',
  'collections',
  'dicts-sets',
  'functions',
] as const;

export type Topic = (typeof TOPICS)[number];

/** A text in every supported language. */
export type Localized = Record<Lang, string>;

export interface Question {
  /** Stable and unique, e.g. "strings-03". Saved sessions and stats refer to it. */
  id: string;
  topic: Topic;
  prompt: Localized;
  /** Python snippet shown below the prompt; the same in every language. */
  code?: string;
  /** "Spot the difference" only: the changed version of `code` (shown as version B, `code` is A). */
  codeB?: string;
  /** Exactly four choices. */
  choices: Localized[];
  answerIndex: 0 | 1 | 2 | 3;
  explanation: Localized;
  /** Walkthrough steps only: the 1-based line of `code` the question is about, highlighted. */
  line?: number;
}

/** One multiple-choice step of a walkthrough; the prompt is generated. */
export interface WalkthroughStep {
  /** Exactly four choices. */
  choices: Localized[];
  answerIndex: 0 | 1 | 2 | 3;
  explanation: Localized;
}

/**
 * A function read line by line: one step per line, in order, then one step
 * about the whole function. Stored in content/walkthroughs/<id>.json.
 */
export interface Walkthrough {
  /** Stable, e.g. "count-vowels"; the step question ids are derived from it. */
  id: string;
  /** The function's source, the same in every language, without blank lines. */
  code: string;
  lines: (WalkthroughStep & { line: number })[];
  whole: WalkthroughStep;
}
