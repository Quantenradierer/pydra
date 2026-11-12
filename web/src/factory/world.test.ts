import { describe, expect, it } from 'vitest';
import { World } from './world.ts';
import { runBelt, type RunSetup } from './run.ts';
import { problemText } from './friendly.ts';

const grabber = (belt: RunSetup['belt'] = ['ore']): RunSetup => ({ mode: 'once', belt, names: ['grab', 'turn', 'drop', 'is_coal'], order: {} });
const smelter = (ore: number, coal: number): RunSetup => ({ mode: 'once', belt: [], ore, coal, names: ['smelt', 'ore', 'coal'], order: {} });

/** Runs `code` and returns the last frame's event and the problem's text in both languages. */
function run(code: string, setup: RunSetup) {
  const r = runBelt({ own: code }, setup);
  return { r, last: r.frames.at(-1)!, en: r.problem && problemText(r.problem, 'en'), de: r.problem && problemText(r.problem, 'de') };
}

describe('the world', () => {
  it('starts facing the belt, empty; turn() goes clockwise west, north, east, south', () => {
    const w = new World({ belt: ['ore'] });
    expect([w.facing, w.holding]).toEqual(['W', null]);
    const seen = [1, 2, 3, 4].map(() => (w.act('turn'), w.facing));
    expect(seen).toEqual(['N', 'E', 'S', 'W']);
  });

  it('grabs the front item, drops ore into the hatch and coal into the bunker', () => {
    const w = new World({ belt: ['coal', 'ore'] });
    expect(w.act('grab')).toEqual({ ok: true, item: 'coal', place: 'belt' });
    expect(w.isCoal()).toBe(true);
    w.act('turn');
    expect(w.act('drop')).toEqual({ ok: true, item: 'coal', place: 'bunker' });
    expect(w.isCoal()).toBe(false);
    w.act('turn');
    w.act('turn');
    w.act('turn');
    w.act('grab');
    w.act('turn');
    w.act('turn');
    expect(w.act('drop')).toEqual({ ok: true, item: 'ore', place: 'ore-hatch' });
    expect(w.snapshot()).toMatchObject({ belt: [], ore: 1, coal: 1, holding: null });
  });

  it('smelts 2 ore and 1 coal into a plate', () => {
    const w = new World({ ore: 2, coal: 3 });
    expect(w.act('smelt')).toEqual({ ok: true });
    expect(w.snapshot()).toMatchObject({ ore: 0, coal: 2, plates: 1 });
  });

  it('the grey factory grabber lands items on their heaps', () => {
    const w = new World({ belt: ['ore', 'coal'] });
    expect(w.land()?.kind).toBe('ore');
    expect(w.land()?.kind).toBe('coal');
    expect(w.land()).toBeUndefined();
    expect([w.ore, w.coal]).toEqual([1, 1]);
  });
});

describe('wasted motion is harmless', () => {
  it('grab() not facing the belt: shown, nothing else happens, the program goes on', () => {
    const { r } = run('turn()\ngrab()\nturn()', grabber());
    expect(r.problem).toBeUndefined();
    expect(r.frames[2]!.event).toEqual({ kind: 'act', command: 'grab', idle: 'not-facing-belt' });
    expect(r.frames[2]!.line).toBe(2);
    expect(r.final).toMatchObject({ holding: null, belt: [{ kind: 'ore' }], facing: 'E' });
  });

  it('grab() at an empty belt', () => {
    const { r } = run('grab()', grabber([]));
    expect(r.frames[1]!.event).toEqual({ kind: 'act', command: 'grab', idle: 'belt-empty' });
    expect(r.problem).toBeUndefined();
  });

  it('grab() while already holding something keeps the first item, the belt keeps the second', () => {
    const { r } = run('grab()\ngrab()', grabber(['ore', 'coal']));
    expect(r.frames[2]!.event).toEqual({ kind: 'act', command: 'grab', idle: 'hand-full' });
    expect(r.final).toMatchObject({ holding: { kind: 'ore' }, belt: [{ kind: 'coal' }] });
  });

  it('drop() with an empty hand, wherever it faces', () => {
    const { r } = run('drop()\nturn()\ndrop()\nturn()\ndrop()\nturn()\ndrop()', grabber());
    expect(r.problem).toBeUndefined();
    expect(r.frames.filter((f) => f.event.kind === 'act' && f.event.command === 'drop').map((f) => f.event)).toEqual(Array(4).fill({ kind: 'act', command: 'drop', idle: 'hand-empty' }));
  });
});

describe('wrong or missing material is an error', () => {
  it('coal dropped into the ore hatch', () => {
    const { r, last, en, de } = run('grab()\nturn()\nturn()\ndrop()', grabber(['coal']));
    expect(r.problem).toMatchObject({ kind: 'world', code: 'coal-in-ore-hatch', line: 4 });
    expect(last.event).toMatchObject({ kind: 'error', command: 'drop' });
    expect(last.state).toMatchObject({ holding: { kind: 'coal' }, ore: 0 });
    expect(en).toBe('Coal does not belong in the ore hatch (line 4).');
    expect(de).toBe('Kohle gehört nicht in die Erzklappe (Zeile 4).');
  });

  it('ore dropped into the coal bunker', () => {
    const { r, en, de } = run('grab()\nturn()\n\ndrop()', grabber(['ore']));
    expect(r.problem).toMatchObject({ code: 'ore-in-bunker', line: 4 });
    expect(en).toBe('Ore does not belong in the coal bunker (line 4).');
    expect(de).toBe('Erz gehört nicht in den Kohlebunker (Zeile 4).');
  });

  it('smelt() with fewer than 2 ore', () => {
    const { r, en, de } = run('smelt()', smelter(1, 1));
    expect(r.problem).toMatchObject({ code: 'need-ore', line: 1 });
    expect(r.final).toMatchObject({ ore: 1, coal: 1, plates: 0 });
    expect(en).toBe('The smelter needs 2 ore, it has 1 (line 1).');
    expect(de).toBe('Der Ofen braucht 2 Erz, er hat 1 (Zeile 1).');
  });

  it('smelt() with no coal', () => {
    const { r, en, de } = run('x = 1\nsmelt()', smelter(2, 0));
    expect(r.problem).toMatchObject({ code: 'need-coal', line: 2 });
    expect(en).toBe('The smelter needs 1 coal, it has 0 (line 2).');
    expect(de).toBe('Der Ofen braucht 1 Kohle, er hat 0 (Zeile 2).');
  });

  it('drop() towards the belt or the floor side', () => {
    const belt = run('grab()\nx = 1\ndrop()', grabber());
    expect(belt.r.problem).toMatchObject({ code: 'nothing-there', params: { place: 'belt' }, line: 3 });
    // The message says where the grabber faces.
    expect(belt.en).toBe('Towards the belt there is no place for it to fall (line 3).');
    expect(belt.de).toBe('Zum Band hin gibt es keinen Platz, in den es fallen könnte (Zeile 3).');
    const floor = run('grab()\nturn()\nturn()\nturn()\ndrop()', grabber());
    expect(floor.r.problem).toMatchObject({ code: 'nothing-there', params: { place: 'floor' }, line: 5 });
    expect(floor.en).toBe('On the floor in the south there is no place for it to fall (line 5).');
    expect(floor.de).toBe('Am Boden im Süden gibt es keinen Platz, in den es fallen könnte (Zeile 5).');
  });

  it('stops the run at the error: later lines do not run', () => {
    const { r } = run('grab()\ndrop()\nturn()', grabber());
    expect(r.frames.at(-1)!.event.kind).toBe('error');
    expect(r.final.facing).toBe('W');
  });
});
