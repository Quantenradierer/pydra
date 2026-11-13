/**
 * What the Hydra Lift editor offers (pure): the challenge's toolbox as chips,
 * the Python shapes it is about, and completions for the car's commands, the
 * handlers, the keywords and the learner's own names. Like the other games'
 * suggestions they name words and shapes, never the solution.
 */
import { localNames, type Completion, type Snippet, type SnippetGroup, type Suggestion } from '../robot/suggest.ts';
import type { Challenge, Shape } from './challenges.ts';
import { FUNCTIONS, HANDLERS, METHODS } from './run.ts';

const KEYWORDS = ['if', 'else', 'elif', 'and', 'or', 'not', 'def', 'for', 'in', 'True', 'False', 'pass'] as const;

/** A toolbox entry as a template: `elevator.go_to_floor()` with the caret between the brackets, a `def` with an indented body. */
export function toolSnippet(label: string): Snippet {
  if (label.startsWith('def ')) return { label, text: `${label}\n    $0` };
  if (label.endsWith('_floor()') && label.includes('go_to')) return { label, text: `${label.slice(0, -1)}$0)` };
  // `waiting()` asks about a floor: it goes in at the caret, the caret between the brackets.
  if ((FUNCTIONS as readonly string[]).includes(label.slice(0, -2))) return { label, text: `${label.slice(0, -1)}$0)`, inline: true };
  // Questions (`elevator.current_floor()`) are values: they go in at the caret.
  return { label, text: `${label}$0`, inline: true };
}

/** The Python shapes of a challenge. */
export function shapesOf(c: Challenge): Snippet[] {
  const all: Record<Shape, Snippet> = {
    for: { label: 'for', text: `for floor in range(${c.floors}):\n    $0` },
    if: { label: 'if', text: 'if $0:\n    ' },
    '>': { label: '>', text: ' > $0', inline: true },
  };
  return (c.shapes ?? []).map((s) => all[s]);
}

const rank = (name: string, word: string): number => (name === word ? 3 : name.startsWith(word) ? 0 : name.includes(word) ? 1 : -1);

/** The completions at the caret, or null when nothing is being typed. */
export function liftCompletion(text: string, caret: number, opts: { manual?: boolean } = {}): Completion | null {
  const before = text.slice(0, caret);
  const word = /([A-Za-z_]\w*)?$/.exec(before)![1] ?? '';
  const from = caret - word.length;
  const line = before.slice(before.lastIndexOf('\n') + 1);
  if (/#/.test(line) || (line.match(/"/g) ?? []).length % 2 === 1 || (line.match(/'/g) ?? []).length % 2 === 1) return null;
  if (from > 0 && /\d/.test(text[from - 1]!)) return null;
  if (word === '' && !opts.manual) return null;
  const afterDot = from > 0 && text[from - 1] === '.';
  const methods: Suggestion[] = METHODS.map((m) => ({ label: `${m}()`, name: m, insert: `${m}()`, back: m === 'go_to_floor' ? 1 : 0, kind: 'command', desc: null, equipped: true }));
  const items0: Suggestion[] = afterDot
    ? methods
    : [
        ...['elevator', 'elevators'].map((n): Suggestion => ({ label: n, name: n, insert: n, back: 0, kind: 'variable', desc: null, equipped: true })),
        ...FUNCTIONS.map((n): Suggestion => ({ label: `${n}()`, name: n, insert: `${n}()`, back: 1, kind: 'command', desc: null, equipped: true })),
        ...HANDLERS.map((n): Suggestion => ({ label: n, name: n, insert: n, back: 0, kind: 'command', desc: null, equipped: true })),
        ...[...KEYWORDS, 'range'].map((k): Suggestion => (k === 'range' ? { label: 'range()', name: k, insert: 'range()', back: 1, kind: 'command', desc: null, equipped: true } : { label: k, name: k, insert: k, back: 0, kind: 'keyword', desc: null, equipped: true })),
        ...localNames(text)
          .filter((n) => n !== word)
          .map((n): Suggestion => ({ label: n, name: n, insert: n, back: 0, kind: 'variable', desc: null, equipped: true })),
      ];
  const seen = new Set<string>();
  const items = items0
    .map((s, i) => ({ s, i, r: rank(s.name, word) }))
    .filter(({ r }) => word === '' || r >= 0)
    .filter(({ s }) => (seen.has(s.name) ? false : (seen.add(s.name), true)))
    .sort((a, b) => (b.r === 0 ? 1 : 0) - (a.r === 0 ? 1 : 0) || b.r - a.r || a.i - b.i)
    .map(({ s }) => s);
  if (items.length === 0) return null;
  if (!opts.manual && items.length === 1 && items[0]!.name === word && items[0]!.insert === word) return null;
  return { from, to: caret, items };
}

/** The editor's suggestion source for a challenge. `toolLabel` / `shapesLabel` name the sheet's tabs. */
export function liftSuggestions(c: Challenge, toolLabel: string, shapesLabel: string) {
  const tools = c.toolbox.map(toolSnippet);
  const shapes = shapesOf(c);
  return {
    next: (): Snippet[] => [...tools, ...shapes],
    groups: (): SnippetGroup[] => [{ id: 'lift', label: toolLabel, snippets: tools }, ...(shapes.length > 0 ? [{ id: 'flow', label: shapesLabel, snippets: shapes }] : [])],
    complete: (text: string, caret: number, opts: { manual?: boolean }) => liftCompletion(text, caret, opts),
  };
}
