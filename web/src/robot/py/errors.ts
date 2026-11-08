/**
 * Errors of the Robot Battler interpreter. They carry a stable `code` and
 * `params` so the UI can translate them (friendly.ts), the line they happened
 * on, and the CPython-style English message as `detail` ("the original error,
 * one click away").
 */
export type ErrorType =
  | 'SyntaxError'
  | 'IndentationError'
  | 'NameError'
  | 'UnboundLocalError'
  | 'TypeError'
  | 'ValueError'
  | 'IndexError'
  | 'KeyError'
  | 'ZeroDivisionError'
  | 'AttributeError'
  | 'RecursionError';

export type ErrorParams = Record<string, string | number>;

export class RbError extends Error {
  constructor(
    readonly type: ErrorType,
    readonly code: string,
    readonly params: ErrorParams,
    readonly line: number,
    /** The CPython-style English message without the type. */
    readonly detail: string,
    readonly col = 0,
  ) {
    super(`${type}: ${detail}`);
  }

  /** The same error on another line (builtins do not know where they were called from). */
  at(line: number): RbError {
    return new RbError(this.type, this.code, this.params, line, this.detail, this.col);
  }
}

/** The program used up its step budget in one tick without acting. */
export class BudgetExceeded extends Error {
  constructor() {
    super('step budget exceeded');
  }
}

/** The closest of `candidates` to `name` (edit distance), or undefined if nothing is close. */
export function suggest(name: string, candidates: Iterable<string>): string | undefined {
  let best: string | undefined;
  let bestDistance = Infinity;
  const list = [...candidates].filter((c) => c !== name && !c.startsWith('_'));
  // "fire_laser" is far from "fire" but starts with it: the longest such name is a good guess.
  const prefixed = list.filter((c) => c.length >= 3 && name.toLowerCase().startsWith(c.toLowerCase())).sort((a, b) => b.length - a.length)[0];
  if (prefixed) return prefixed;
  for (const c of list) {
    const d = distance(name.toLowerCase(), c.toLowerCase());
    if (d < bestDistance) {
      best = c;
      bestDistance = d;
    }
  }
  if (best === undefined) return undefined;
  const limit = Math.max(1, Math.floor(Math.max(name.length, best.length) / 3));
  return bestDistance <= limit ? best : undefined;
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length]!;
}
