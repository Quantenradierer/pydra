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
  /** Exactly four choices. */
  choices: Localized[];
  answerIndex: 0 | 1 | 2 | 3;
  explanation: Localized;
}
