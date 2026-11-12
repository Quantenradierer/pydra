/**
 * What the Hydra Works editor offers (pure): the lesson's toolbox as chips, the
 * few Python shapes the lesson is about, and completions for the factory's
 * words, the keywords and the names the learner defined. Like Robot Battler's
 * suggestions they name words and shapes, never the solution.
 */
import { localNames, type Completion, type Snippet, type SnippetGroup, type Suggestion } from '../robot/suggest.ts';
import type { Lesson, LessonId } from './lessons.ts';

const KEYWORDS = ['if', 'else', 'elif', 'and', 'or', 'not', 'def', 'for', 'in', 'True', 'False'] as const;
const VARIABLES = new Set(['ore', 'coal', 'n']);

/** A toolbox entry as a template: commands go on a line of their own, the variables `ore`, `coal`, `n` at the caret. */
export function toolSnippet(label: string): Snippet {
  return VARIABLES.has(label) ? { label, text: `${label}$0`, inline: true } : { label, text: `${label}$0` };
}

/** The Python shapes of a lesson (its branch so far), for the strip and the sheet. */
export function shapesOf(id: LessonId): Snippet[] {
  const ifCoal: Snippet = { label: 'if', text: 'if is_coal():\n    $0' };
  const ifAny: Snippet = { label: 'if', text: 'if $0:\n    ' };
  const elseS: Snippet = { label: 'else', text: 'else:\n    $0' };
  const ge: Snippet = { label: '>=', text: ' >= $0', inline: true };
  const and: Snippet = { label: 'and', text: ' and $0', inline: true };
  const forN: Snippet = { label: 'for', text: 'for i in range(n):\n    $0' };
  switch (id) {
    case 'G3':
      return [ifCoal, elseS];
    case 'G4':
      return [{ label: 'def', text: 'def feed():\n    $0' }, ifCoal, elseS];
    case 'S2':
      return [ifAny, ge];
    case 'S3':
      return [ifAny, ge, and];
    case 'S4':
      return [{ label: 'def', text: 'def make_plate(ore, coal):\n    $0' }, ifAny, ge, and];
    case 'B2':
      return [forN];
    case 'B3':
      return [{ label: 'def', text: 'def make_plates(n):\n    $0' }, forN];
    default:
      return [];
  }
}

const rank = (name: string, word: string): number => (name === word ? 3 : name.startsWith(word) ? 0 : name.includes(word) ? 1 : -1);

/** The words of the toolbox (`make_plate(ore, coal)` is the word `make_plate`). */
const wordOf = (label: string) => /^\w+/.exec(label)?.[0] ?? label;

/** The completions at the caret, or null when nothing is being typed. */
export function factoryCompletion(lesson: Lesson, text: string, caret: number, opts: { manual?: boolean } = {}): Completion | null {
  const before = text.slice(0, caret);
  const word = /([A-Za-z_]\w*)?$/.exec(before)![1] ?? '';
  const from = caret - word.length;
  const line = before.slice(before.lastIndexOf('\n') + 1);
  if (/#/.test(line) || (line.match(/"/g) ?? []).length % 2 === 1 || (line.match(/'/g) ?? []).length % 2 === 1) return null;
  if (from > 0 && /\d/.test(text[from - 1]!)) return null;
  if (word === '' && !opts.manual) return null;
  const tools: Suggestion[] = lesson.toolbox.map((label) => {
    const name = wordOf(label);
    const call = label.includes('(');
    // `make_plate(ore, coal)` goes in whole; `grab()` like a call.
    return { label, name, insert: label, back: 0, kind: call ? 'command' : 'variable', desc: null, equipped: true };
  });
  const keywords: Suggestion[] = [...KEYWORDS, 'range'].map((k) => (k === 'range' ? { label: 'range()', name: k, insert: 'range()', back: 1, kind: 'command', desc: null, equipped: true } : { label: k, name: k, insert: k, back: 0, kind: 'keyword', desc: null, equipped: true }));
  const locals: Suggestion[] = localNames(text)
    .filter((n) => n !== word)
    .map((n) => ({ label: n, name: n, insert: n, back: 0, kind: 'variable', desc: null, equipped: true }));
  const seen = new Set<string>();
  const items = [...tools, ...keywords, ...locals]
    .map((s, i) => ({ s, i, r: rank(s.name, word) }))
    .filter(({ r }) => word === '' || r >= 0)
    .filter(({ s }) => (seen.has(s.name) ? false : (seen.add(s.name), true)))
    .sort((a, b) => (b.r === 0 ? 1 : 0) - (a.r === 0 ? 1 : 0) || b.r - a.r || a.i - b.i)
    .map(({ s }) => s);
  if (items.length === 0) return null;
  if (!opts.manual && items.length === 1 && items[0]!.name === word && items[0]!.insert === word) return null;
  return { from, to: caret, items };
}

/** The editor's suggestion source for a lesson. `toolLabel` / `shapesLabel` name the sheet's tabs. */
export function factorySuggestions(lesson: Lesson, toolLabel: string, shapesLabel: string) {
  const tools = lesson.toolbox.map(toolSnippet);
  const shapes = shapesOf(lesson.id);
  return {
    next: (): Snippet[] => [...tools, ...shapes],
    groups: (): SnippetGroup[] => [{ id: 'factory', label: toolLabel, snippets: tools }, ...(shapes.length > 0 ? [{ id: 'flow', label: shapesLabel, snippets: shapes }] : [])],
    complete: (text: string, caret: number, opts: { manual?: boolean }) => factoryCompletion(lesson, text, caret, opts),
  };
}
