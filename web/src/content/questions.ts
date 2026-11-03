import type { Question } from './types.ts';
import collections from './questions/collections.json';
import controlFlow from './questions/control-flow.json';
import dictsSets from './questions/dicts-sets.json';
import functions from './questions/functions.json';
import loops from './questions/loops.json';
import operators from './questions/operators.json';
import strings from './questions/strings.json';
import types from './questions/types.json';

/** All questions, bundled into the app. Checked by questions.test.ts. */
export const QUESTIONS = [
  ...types,
  ...operators,
  ...strings,
  ...controlFlow,
  ...loops,
  ...collections,
  ...dictsSets,
  ...functions,
] as Question[];

export const QUESTIONS_BY_ID: ReadonlyMap<string, Question> = new Map(QUESTIONS.map((q) => [q.id, q]));
