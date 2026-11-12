import { describe, expect, it } from 'vitest';
import { buildFactoryBeats, factoryStateAt, frameIndexOf, startBeatOf, tidyBeats } from './beats.ts';
import { judge } from './game.ts';
import { lessonById } from './lessons.ts';
import { runBelt } from './run.ts';
import { factoryCompletion, factorySuggestions, shapesOf } from './suggest.ts';

describe('factory beats', () => {
  it('one beat per command, with its line, and the block before the run first', () => {
    const r = runBelt({ own: 'grab()\nturn()\nturn()\ndrop()' }, { mode: 'once', belt: ['ore'], names: ['grab', 'turn', 'drop'], order: { ore: 1 }, trace: true });
    const beats = buildFactoryBeats(r.frames);
    expect(beats[0]).toMatchObject({ kind: 'start', tick: 0, line: null });
    const resolves = beats.filter((b) => b.kind === 'resolve');
    expect(resolves.map((b) => b.line)).toEqual([1, 2, 3, 4, null]);
    // The command's line is not a beat of its own.
    expect(beats.filter((b) => b.kind === 'line')).toEqual([]);
    expect(frameIndexOf(beats[1]!)).toBe(1);
  });

  it('lines without a command (an if) are beats of their own and show the block before the next event', () => {
    const r = judge(lessonById('G3')!, lessonById('G3')!.reference);
    const frames = r.belts[0]!.frames;
    const beats = buildFactoryBeats(frames);
    const ifBeat = beats.find((b) => b.kind === 'line' && b.line === 2)!;
    expect(ifBeat).toBeDefined();
    expect(frameIndexOf(ifBeat)).toBe(ifBeat.tick - 1);
    const i = beats.indexOf(ifBeat);
    expect(factoryStateAt(beats, frames, i).hints.get(2)?.branch).toMatchObject({ kind: 'if' });
  });

  it('hints start fresh with every start of the program', () => {
    const r = judge(lessonById('G3')!, lessonById('G3')!.reference);
    const frames = r.belts[0]!.frames;
    const beats = buildFactoryBeats(frames);
    const starts = beats.map((b, i) => [b, i] as const).filter(([b]) => b.kind === 'resolve' && frames[b.tick]!.event.kind === 'start');
    expect(starts).toHaveLength(3);
    const second = starts[1]![1];
    expect(startBeatOf(beats, frames, second + 1)).toBe(second);
    expect(factoryStateAt(beats, frames, second).hints.size).toBe(0);
  });

  it('a precheck error is one beat with the line', () => {
    const r = judge(lessonById('G1')!, 'grab()\nfoo()');
    const beats = buildFactoryBeats(r.belts[0]!.frames);
    expect(beats.at(-1)).toMatchObject({ kind: 'resolve', line: 2 });
  });
});

describe('factory suggestions', () => {
  it('the strip offers the toolbox and the lesson shapes', () => {
    const s = factorySuggestions(lessonById('G3')!, 'tools', 'python');
    expect(s.next().map((x) => x.label)).toEqual(['grab()', 'turn()', 'drop()', 'is_coal()', 'if', 'else']);
    expect(s.groups().map((g) => g.label)).toEqual(['tools', 'python']);
    expect(shapesOf('G1')).toEqual([]);
  });

  it('completes the factory words', () => {
    const c = factoryCompletion(lessonById('B1')!, 'make', 4)!;
    expect(c.items[0]).toMatchObject({ label: 'make_plate(ore, coal)', insert: 'make_plate(ore, coal)' });
    expect(factoryCompletion(lessonById('G1')!, 'gr', 2)!.items[0]!.label).toBe('grab()');
    expect(factoryCompletion(lessonById('G1')!, '', 0)).toBeNull();
  });
});

describe('tidy beats', () => {
  it('drops def lines (they move nothing) and a line repeated right after itself', () => {
    const r = runBelt({ own: 'def noop():\n    pass\nnoop()\ngrab()' }, { mode: 'once', belt: ['ore'], names: ['grab', 'turn', 'drop'], order: {}, trace: true });
    const text = ['def noop():', '    pass', 'noop()', 'grab()'];
    const beats = tidyBeats(buildFactoryBeats(r.frames), (line) => text[line - 1] ?? '');
    const lines = beats.filter((b) => b.kind === 'line').map((b) => b.line);
    expect(lines).not.toContain(1);
    lines.forEach((l, i) => expect(l === lines[i - 1] && i > 0).toBe(false));
    // The commands themselves stay.
    expect(beats.filter((b) => b.kind === 'resolve').length).toBe(buildFactoryBeats(r.frames).filter((b) => b.kind === 'resolve').length);
  });
});
