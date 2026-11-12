import { describe, expect, it } from 'vitest';
import { lineRef, MACHINES_LINE_BASE, MAX_ACTIONS, MAX_OWN_LINES, precheck, runBelt, type RunSetup } from './run.ts';
import { problemText } from './friendly.ts';
import { problemLine } from './run.ts';
import { MACHINE_WORDS } from './world.ts';

const SORT = ['grab', 'turn', 'drop', 'is_coal'] as const;
const SMELT = ['smelt', 'ore', 'coal'] as const;
const BLOCK = [...MACHINE_WORDS, 'ore', 'coal', 'n'] as const;

describe('run modes', () => {
  it('once: runs the program one time and records one frame per command, with its line', () => {
    const r = runBelt({ own: 'grab()\nturn()\nturn()\ndrop()' }, { mode: 'once', belt: ['ore'], names: SORT, order: { ore: 1 }, trace: true });
    expect(r.met).toBe(true);
    expect(r.starts).toBe(1);
    expect(r.frames.map((f) => f.event.kind)).toEqual(['begin', 'act', 'act', 'act', 'act', 'end']);
    expect(r.frames.map((f) => f.line)).toEqual([null, 1, 2, 3, 4, null]);
    expect(r.frames.map((f) => f.orderMet)).toEqual([false, false, false, false, true, true]);
    expect(r.frames[1]!.state).toMatchObject({ holding: { kind: 'ore' }, belt: [] });
    expect(r.frames[4]!.event).toEqual({ kind: 'act', command: 'drop', item: 'ore', place: 'ore-hatch' });
    expect(r.frames[1]!.trace).toContainEqual({ k: 'line', line: 1 });
  });

  it('per-item: starts again for every item reaching the front; variables do not survive', () => {
    const code = 'grab()\nturn()\nturn()\ndrop()\nturn()\nturn()\nprint(x)\nx = 1';
    const r = runBelt({ own: code }, { mode: 'per-item', belt: ['ore', 'ore'], names: SORT, order: { ore: 2 } });
    // print(x) fails on every start if x survived it would not: it fails on the first one already.
    expect(r.problem).toMatchObject({ kind: 'python' });
    const ok = runBelt({ own: 'grab()\nturn()\nturn()\ndrop()\nturn()\nturn()' }, { mode: 'per-item', belt: ['ore', 'ore'], names: SORT, order: { ore: 2 } });
    expect(ok.met).toBe(true);
    expect(ok.starts).toBe(2);
    const starts = ok.frames.filter((f) => f.event.kind === 'start');
    expect(starts.map((f) => f.event)).toEqual([
      { kind: 'start', item: { id: 1, kind: 'ore' }, by: 'belt' },
      { kind: 'start', item: { id: 2, kind: 'ore' }, by: 'belt' },
    ]);
    expect(starts.map((f) => f.start)).toEqual([1, 2]);
  });

  it('per-item: an item that was not taken does not start the program again', () => {
    const r = runBelt({ own: 'grab()\nturn()\nturn()\ndrop()' }, { mode: 'per-item', belt: ['ore', 'ore'], names: SORT, order: { ore: 2 } });
    expect(r.starts).toBe(2);
    expect(r.met).toBe(false);
    expect(r.problem).toBeUndefined();
    expect(r.final).toMatchObject({ ore: 1, belt: [{ id: 2, kind: 'ore' }] });
  });

  it('per-landing: the grey grabber lands each item, then the program runs; ore and coal are kept up to date', () => {
    const r = runBelt({ own: 'print(ore)\nif ore >= 2:\n    smelt()\n    print(ore)' }, { mode: 'per-landing', belt: ['ore', 'ore', 'ore', 'ore'], coal: 3, names: SMELT, order: { plates: 2 }, trace: true });
    expect(r.met).toBe(true);
    expect(r.starts).toBe(4);
    const first = r.frames.find((f) => f.event.kind === 'start')!;
    expect(first.event).toEqual({ kind: 'start', item: { id: 1, kind: 'ore' }, by: 'factory' });
    expect(first.state).toMatchObject({ ore: 1, belt: [{ kind: 'ore' }, { kind: 'ore' }, { kind: 'ore' }] });
    const printed = r.frames.flatMap((f) => f.trace ?? []).filter((e) => e.k === 'call' && e.fn === 'print').map((e) => (e.k === 'call' ? e.args[0] : ''));
    expect(printed).toEqual(['1', '2', '0', '1', '2', '0']);
    expect(r.final).toMatchObject({ ore: 0, coal: 1, plates: 2 });
  });

  it('writes n into the program', () => {
    const r = runBelt({ own: 'for i in range(n):\n    turn()' }, { mode: 'once', belt: [], n: 3, names: BLOCK, order: {} });
    expect(r.frames.filter((f) => f.event.kind === 'act')).toHaveLength(3);
  });

  it('does not write n again after an action (only ore and coal follow the heaps)', () => {
    // A program that changed n anyway (precheck stops this before a real run) keeps its own value.
    const r = runBelt({ own: 'def f():\n    global n\n    n = 0\nf()\nturn()\nprint(n)' }, { mode: 'once', belt: [], n: 3, names: BLOCK, order: {}, trace: true });
    const printed = r.frames.flatMap((f) => f.trace ?? []).filter((e) => e.k === 'call' && e.fn === 'print').map((e) => (e.k === 'call' ? e.args[0] : ''));
    expect(printed).toEqual(['0']);
  });

  it('runtime "did you mean" suggests only names the lesson has', () => {
    // smelt is a factory word, but not in this lesson: no hint towards it.
    const r = runBelt({ own: 'smel()' }, { mode: 'once', belt: [], names: SORT, order: {} });
    expect(r.problem).toMatchObject({ kind: 'python', error: { code: 'unknown-name' } });
    expect(r.problem?.kind === 'python' && r.problem.error.params.suggestion).not.toBe('smelt()');
    const ok = runBelt({ own: 'trn()' }, { mode: 'once', belt: [], names: SORT, order: {} });
    expect(ok.problem?.kind === 'python' && ok.problem.error.params.suggestion).toBe('turn()');
  });

  it('records the Python functions each command ran inside', () => {
    const r = runBelt({ own: 'def back():\n    turn()\ndef go():\n    back()\n    turn()\ngo()\nturn()' }, { mode: 'once', belt: [], names: SORT, order: {} });
    expect(r.frames.filter((f) => f.event.kind === 'act').map((f) => f.inside)).toEqual([['go', 'back'], ['go'], []]);
  });

  it('is deterministic', () => {
    const setup: RunSetup = { mode: 'per-item', belt: ['ore', 'coal'], names: SORT, order: {}, trace: true };
    expect(runBelt({ own: 'grab()\nturn()\ndrop()' }, setup)).toEqual(runBelt({ own: 'grab()\nturn()\ndrop()' }, setup));
  });
});

describe('stops', () => {
  it('a loop that never acts (step budget)', () => {
    const r = runBelt({ own: 'x = 0\nwhile True:\n    x += 1' }, { mode: 'once', belt: [], names: SORT, order: {} });
    expect(r.problem?.kind).toBe('budget');
    expect(problemText(r.problem!, 'en')).toMatch(/never ends \(line [23]\)\.$/);
  });

  it('a loop that acts forever (command cap)', () => {
    const r = runBelt({ own: 'while True:\n    turn()' }, { mode: 'once', belt: [], names: SORT, order: {} });
    expect(r.problem).toEqual({ kind: 'too-long', line: 2 });
    expect(r.frames.filter((f) => f.event.kind === 'act')).toHaveLength(MAX_ACTIONS);
    expect(problemText(r.problem!, 'de')).toBe('Die Maschinen arbeiten und arbeiten und werden nicht fertig: Läuft eine Schleife endlos (Zeile 2)?');
  });

  it('a Python error at run time, with the friendly text and the line', () => {
    const r = runBelt({ own: 'turn()\nturn(2)' }, { mode: 'once', belt: [], names: SORT, order: {} });
    expect(r.problem).toMatchObject({ kind: 'python' });
    expect(r.frames.at(-1)!.line).toBe(2);
    expect(problemText(r.problem!, 'en')).toBe('"turn" needs 0 value(s), you gave 1 (line 2).');
  });
});

describe('precheck', () => {
  const names = SORT;
  it('rejects assigning ore or coal before the run, anywhere in the code', () => {
    for (const [code, line] of [
      ['ore = 3', 1],
      ['smelt()\ncoal += 1', 2],
      ['def f():\n    ore = 1', 2],
      ['for coal in range(2):\n    smelt()', 1],
    ] as const) {
      expect(precheck({ own: code }, { names: SMELT }), code).toMatchObject({ kind: 'read-only', line });
    }
    expect(problemText(precheck({ own: 'ore = 3' }, { names: SMELT })!, 'en')).toBe('"ore" is counted by the factory itself, you cannot change it (line 1).');
    expect(problemText(precheck({ own: 'x = 1\ncoal = 0' }, { names: SMELT })!, 'de')).toBe('„coal“ zählt die Fabrik selbst, das kannst du nicht ändern (Zeile 2).');
  });

  it('rejects assigning n where the lesson has it, like ore and coal', () => {
    for (const [code, line] of [
      ['n = 0\nfor i in range(n):\n    feed()', 1],
      ['n += 1', 1],
      ['def f():\n    n = 2', 2],
      ['for n in range(2):\n    feed()', 1],
    ] as const) {
      expect(precheck({ own: code, machines: 'def feed():\n    turn()' }, { names: BLOCK }), code).toMatchObject({ kind: 'read-only', name: 'n', line });
    }
    expect(problemText(precheck({ own: 'n = 0' }, { names: BLOCK })!, 'de')).toBe('„n“ legt der Auftrag fest, das kannst du nicht ändern (Zeile 1).');
    expect(problemText(precheck({ own: 'n = 0' }, { names: BLOCK })!, 'en')).toBe('"n" is set by the order, you cannot change it (line 1).');
    // A parameter called n is the function's own (B3: def make_plates(n)); n is a plain name where the lesson has no n.
    expect(precheck({ own: 'def f(n):\n    print(n)\nf(n)' }, { names: BLOCK })).toBeUndefined();
    expect(precheck({ own: 'n = 2\nprint(n)' }, { names: SORT })).toBeUndefined();
  });

  it('rejects a def or parameter named like a given command or a machine', () => {
    const machines = 'def feed():\n    turn()\n\ndef back():\n    turn()';
    const opts = { names: BLOCK, forbiddenInOwn: MACHINE_WORDS };
    expect(precheck({ own: 'def turn():\n    pass\nfeed()', machines }, opts)).toEqual({ kind: 'reserved', name: 'turn', line: 1, from: 'factory' });
    expect(precheck({ own: 'def feed():\n    pass\nfeed()', machines }, opts)).toEqual({ kind: 'reserved', name: 'feed', line: 1, from: 'machines' });
    expect(precheck({ own: 'def back():\n    pass\nfeed()', machines }, opts)).toMatchObject({ kind: 'reserved', name: 'back', from: 'machines' });
    expect(precheck({ own: 'def f(grab):\n    feed()\nf(1)', machines }, opts)).toMatchObject({ kind: 'reserved', name: 'grab', line: 1 });
    expect(precheck({ own: 'def make_plate(ore, coal):\n    pass', machines: '' }, { names: SORT, reserved: { make_plate: 'S4' } })).toMatchObject({ kind: 'reserved', name: 'make_plate', from: 'S4' });
    const p = precheck({ own: 'def turn():\n    pass', machines }, opts)!;
    expect(problemText(p, 'en')).toBe('"turn" is already a factory command: pick another name for your function or parameter (line 1).');
    expect(problemText(precheck({ own: 'x = 1\ndef feed():\n    pass', machines }, opts)!, 'de')).toBe('„feed“ ist schon eine Funktion aus „Deine Maschinen“: Nimm einen anderen Namen (Zeile 2).');
    expect(problemText(precheck({ own: 'def feed():\n    pass' }, { names: SMELT, reserved: { feed: 'G4' } })!, 'en')).toBe('"feed" is the name of the function from G4: pick another name here (line 1).');
  });

  it('caps the own text so its line numbers never reach "Your machines"', () => {
    const long = 'x = 1\n'.repeat(MAX_OWN_LINES) + 'x = 2';
    const p = precheck({ own: long }, { names: SORT })!;
    expect(p).toMatchObject({ kind: 'python', error: { code: 'too-many-lines' } });
    expect(problemText(p, 'en')).toBe(`Your program has too many lines: at most ${MAX_OWN_LINES} are allowed.`);
    expect(precheck({ own: 'x = 1\n'.repeat(MAX_OWN_LINES - 1) + 'x = 2' }, { names: SORT })).toBeUndefined();
    expect(runBelt({ own: long }, { mode: 'once', belt: [], names: SORT, order: {} }).problem).toMatchObject({ kind: 'python', error: { code: 'too-many-lines' } });
  });

  it('allows parameters named ore and coal', () => {
    expect(precheck({ own: 'def make_plate(ore, coal):\n    if ore >= 2 and coal >= 1:\n        smelt()\nmake_plate(ore, coal)' }, { names: SMELT })).toBeUndefined();
  });

  it('reports syntax errors and unknown names with factory wording', () => {
    const syntax = precheck({ own: 'if is_coal()\n    drop()' }, { names })!;
    expect(problemText(syntax, 'en')).toBe('After "if" the colon (:) at the end of the line is missing (line 1).');
    const unknown = precheck({ own: 'grab()\ntrn()' }, { names })!;
    expect(problemText(unknown, 'en')).toBe('The factory does not know "trn" (line 2). Did you mean turn()?');
    expect(problemText(unknown, 'de')).toBe('Die Fabrik kennt „trn“ nicht (Zeile 2). Meintest du turn()?');
    expect(problemText(precheck({ own: 'x()' }, { names })!, 'en')).toBe('The factory does not know "x" (line 1).');
  });

  it('names what this lesson does not have yet', () => {
    const p = precheck({ own: 'grab()\nif is_coal():\n    drop()' }, { names: ['grab', 'turn', 'drop'] })!;
    expect(problemText(p, 'en')).toBe('"is_coal" is not available in this lesson yet (line 2).');
    expect(problemText(precheck({ own: 'print(ore)' }, { names })!, 'de')).toBe('„ore“ gibt es in dieser Lektion noch nicht (Zeile 1).');
  });

  it('forbids given commands in the own text of a block lesson, but not in "Your machines"', () => {
    const machines = 'def feed():\n    grab()\n    turn()\n    turn()\n    drop()\n    turn()\n    turn()';
    expect(precheck({ own: 'feed()', machines }, { names: BLOCK, forbiddenInOwn: MACHINE_WORDS })).toBeUndefined();
    const p = precheck({ own: 'feed()\nsmelt()', machines }, { names: BLOCK, forbiddenInOwn: MACHINE_WORDS })!;
    expect(p).toEqual({ kind: 'machines-only', name: 'smelt', line: 2 });
    expect(problemText(p, 'en')).toBe('In the block lessons you call feed() and make_plate(ore, coal), not smelt() (line 2).');
  });
});

describe('"Your machines"', () => {
  it('numbers its lines apart from the own text, and says so in messages', () => {
    const machines = 'def feed():\n    grab()\n    turn()\n    drop()';
    const r = runBelt({ own: 'x = 1\nfeed()', machines }, { mode: 'once', belt: ['ore'], names: BLOCK, order: {}, trace: true });
    expect(lineRef(r.frames[1]!.line!)).toEqual({ part: 'machines', line: 2 });
    expect(r.frames[1]!.trace).toContainEqual({ k: 'line', line: 2 });
    expect(r.frames[1]!.trace).toContainEqual({ k: 'line', line: MACHINES_LINE_BASE + 2 });
    expect(r.problem).toMatchObject({ kind: 'world', code: 'ore-in-bunker', line: MACHINES_LINE_BASE + 4 });
    expect(problemText(r.problem!, 'en')).toBe('Ore does not belong in the coal bunker (line 4 in "Your machines").');
  });

  it('a loop that never ends points at the own line that was running, not into "Your machines"', () => {
    const machines = 'def feed():\n    grab()\n    turn()\n    turn()\n    drop()\n    turn()\n    turn()';
    const setup: RunSetup = { mode: 'once', belt: ['ore'], names: BLOCK, order: {}, trace: true };
    const forever = runBelt({ own: 'x = 1\nwhile True:\n    feed()', machines }, setup);
    expect(forever.problem?.kind).toBe('too-long');
    expect(lineRef(problemLine(forever.problem!)!)).toMatchObject({ part: 'own' });
    expect(problemText(forever.problem!, 'en')).toMatch(/\(line [23]\)\?$/);
    expect(forever.frames.at(-1)!.line).toBe(problemLine(forever.problem!));
    const hundred = runBelt({ own: 'for i in range(100):\n    feed()\n    feed()\n    feed()', machines }, setup);
    expect(hundred.problem?.kind).toBe('too-long');
    expect(problemText(hundred.problem!, 'de')).toMatch(/\(Zeile [1-4]\)\?$/);
    // A loop without a command inside a machine function called from line 2.
    const spin = runBelt({ own: 'x = 1\nspin()', machines: 'def spin():\n    while True:\n        pass' }, setup);
    expect(spin.problem).toEqual({ kind: 'budget', line: 2 });
  });
});
