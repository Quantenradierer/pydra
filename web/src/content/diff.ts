import type { Question } from './types.ts';
import collections from './diff/collections.json';
import controlFlow from './diff/control-flow.json';
import dictsSets from './diff/dicts-sets.json';
import functions from './diff/functions.json';
import loops from './diff/loops.json';
import operators from './diff/operators.json';
import strings from './diff/strings.json';
import types from './diff/types.json';

/**
 * The questions of the "Spot the difference" lesson: `code` is version A,
 * `codeB` the same code with one small change. Ids are `diff-<topic>-NN`.
 * Checked by diff.test.ts.
 */
export const DIFF_QUESTIONS = [
  ...types,
  ...operators,
  ...strings,
  ...controlFlow,
  ...loops,
  ...collections,
  ...dictsSets,
  ...functions,
] as Question[];

/**
 * The 1-based lines of `code` that differ from `other`. Snippets with the
 * same number of lines are compared line by line; otherwise a line counts as
 * changed when `other` has no identical line.
 */
export function changedLines(code: string, other: string): number[] {
  const mine = code.split('\n');
  const theirs = other.split('\n');
  const same = mine.length === theirs.length;
  return mine.flatMap((line, i) => ((same ? line !== theirs[i] : !theirs.includes(line)) ? [i + 1] : []));
}
