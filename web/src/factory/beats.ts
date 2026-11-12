/**
 * Hydra Works' recorded frames cut into the steps of the line-by-line viewer
 * (pure, no DOM). One beat is one executed line, or the moment a frame's event
 * plays out on the block (a command, a (re)start of the program, its end, an
 * error). The beats have Robot Battler's shape, so its `stateAt` (value hints
 * next to the code) works on them.
 */
import { stateAt, type Beat, type ViewState } from '../robot/stepper.ts';
import type { TraceEvent } from '../robot/py/trace.ts';
import type { Frame } from './run.ts';

const startsGroup = (e: TraceEvent) => e.k === 'line' || e.k === 'leave';
const lineOf = (e: TraceEvent): number | null => (e.k === 'cut' ? null : e.line);

/**
 * Beat 0 shows the block before the run (frame 0). Then per frame: one `line` beat per line the program ran
 * since the previous frame (the block still shows the previous frame), and one `resolve` beat that plays the
 * frame's event out. The line of a command and the command itself are one beat (the resolve beat).
 */
export function buildFactoryBeats(frames: readonly Frame[]): Beat[] {
  const beats: Beat[] = [{ tick: 0, kind: 'start', line: null, events: [] }];
  for (const [tick, frame] of frames.entries()) {
    if (tick === 0) continue;
    const groups: TraceEvent[][] = [];
    for (const e of frame.trace ?? []) {
      if (startsGroup(e) || groups.length === 0) groups.push([]);
      groups.at(-1)!.push(e);
    }
    // The command's own line is shown with the command.
    const last = groups.at(-1);
    const merge = last !== undefined && frame.line !== null && lineOf(last[0]!) === frame.line && (frame.event.kind === 'act' || frame.event.kind === 'error');
    for (const g of merge ? groups.slice(0, -1) : groups) beats.push({ tick, kind: 'line', line: lineOf(g[0]!), events: g });
    beats.push({ tick, kind: 'resolve', line: frame.line, events: merge ? last : [] });
  }
  return beats;
}

/** The index of the beat that (re)started the program at or before `index` (0 if none). */
export function startBeatOf(beats: readonly Beat[], frames: readonly Frame[], index: number): number {
  for (let i = Math.min(index, beats.length - 1); i > 0; i--) {
    const b = beats[i]!;
    if (b.kind === 'resolve' && frames[b.tick]?.event.kind === 'start') return i;
  }
  return 0;
}

/** The value hints after beat `index`, counted from the current start of the program (every start begins fresh). */
export function factoryStateAt(beats: readonly Beat[], frames: readonly Frame[], index: number): ViewState {
  const from = startBeatOf(beats, frames, index);
  return stateAt(beats.slice(from), index - from);
}

/** The block a beat shows: a line beat the frame before its event, any other beat its own frame. */
export const frameIndexOf = (beat: Beat): number => (beat.kind === 'line' ? beat.tick - 1 : beat.tick);

/**
 * The steps the viewer shows, from the beats of `buildFactoryBeats`: a `def` line runs without moving anything
 * (it only defines a function), and a line that repeats the line just before it (in the same run of beats) shows
 * the same thing twice. Both are dropped; the resolve beats (commands, starts, ends, errors) stay as they are.
 * `textOf` gives the text of a line in the combined numbering (see `lineRef`).
 */
export function tidyBeats(beats: readonly Beat[], textOf: (line: number) => string): Beat[] {
  const out: Beat[] = [];
  for (const b of beats) {
    if (b.kind === 'line') {
      const prev = out.at(-1);
      if (b.line !== null && /^\s*def\s/.test(textOf(b.line))) continue;
      if (prev?.kind === 'line' && prev.line === b.line) continue;
    }
    out.push(b);
  }
  return out;
}
