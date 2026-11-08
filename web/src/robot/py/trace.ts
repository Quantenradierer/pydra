/**
 * The trace of a run: one small event per executed statement, call, branch,
 * loop pass and variable change, in the order they happen. Plain data (JSON
 * safe), deterministic, and what the line-by-line viewer replays.
 */
export type CallKind = 'action' | 'sensor' | 'say';

export type TraceEvent =
  /** A statement starts (for `if` / `while` / `for`: the line of the condition). */
  | { k: 'line'; line: number }
  /** A part is called. `result` is missing for actions (they take a tick; the effect is in the tick's events). */
  | { k: 'call'; line: number; fn: string; args: string[]; kind: CallKind; result?: string }
  /** A function written by the player is entered; `depth` is the depth inside it (1 = called from the top level). */
  | { k: 'enter'; line: number; fn: string; args: string[]; depth: number }
  /** ...and left again; `line` is the line of the call, to which the script returns. */
  | { k: 'leave'; line: number; fn: string; value: string; depth: number }
  /** A variable gets a value; `depth` 0 = a global. */
  | { k: 'set'; line: number; name: string; value: string; depth: number }
  /** `if` / `while` test (taken = true: the body runs) or a `for` pass (n, value) / its end (taken = false). */
  | { k: 'branch'; line: number; kind: 'if' | 'while' | 'for'; taken: boolean; hasElse?: boolean; n?: number; value?: string }
  /** The trace of this tick was cut off: the script ran very long without acting. */
  | { k: 'cut' };
