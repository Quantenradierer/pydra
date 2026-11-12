import { describe, expect, it } from 'vitest';
import { CONTENT } from '../content/lessons.ts';
import { AppStorage, GAME_DATA_KEYS, MemoryKeyValue } from '../storage.ts';
import { emptyProgress, FactoryGame, judge, parseProgress, type FactoryPointsEvent } from './game.ts';
import { LESSONS, lessonById, machinesText, type LessonId } from './lessons.ts';

function setup() {
  const kv = new MemoryKeyValue();
  const storage = new AppStorage(kv, CONTENT);
  const events: FactoryPointsEvent[] = [];
  const game = new FactoryGame(storage, (e) => events.push(e));
  return { kv, storage, game, events };
}

const ref = (id: LessonId) => lessonById(id)!.reference;
const solve = (game: FactoryGame, ...ids: LessonId[]) => {
  for (const id of ids) expect(game.submit(id, ref(id))?.passed, id).toBe(true);
};

describe('progress', () => {
  it('is kept under the storage key "factory", which a progress reset clears', () => {
    expect(GAME_DATA_KEYS).toContain('factory');
    const { game, storage } = setup();
    solve(game, 'G1');
    expect(storage.gameData('factory')).toMatchObject({ solved: ['G1'] });
    storage.resetProgress();
    expect(game.progress()).toEqual(emptyProgress());
  });

  it('round-trips, and drops what does not belong', () => {
    const { game } = setup();
    solve(game, 'G1', 'S1');
    game.setText('G2', 'grab()');
    game.setCurrent('G2');
    const p = game.progress();
    expect(parseProgress(JSON.parse(JSON.stringify(p)))).toEqual(p);
    expect(p).toMatchObject({ solved: ['G1', 'S1'], current: 'G2', runs: 2, wins: 2, lessons: { G1: { last: ref('G1'), passing: ref('G1') }, G2: { last: 'grab()' } } });
    expect(parseProgress({ lessons: { X9: { last: 'a' }, G1: { last: 3, passing: 'p' } }, solved: ['G1', 'G2', 'X9'], misses: { G1: -1, S1: 2 }, runs: 1, wins: 5, current: 'nope' })).toEqual({
      lessons: { G1: { passing: 'p' } },
      solved: ['G1'],
      misses: { S1: 2 },
      runs: 1,
      wins: 0,
    });
    for (const raw of [undefined, null, 3, 'x', []]) expect(parseProgress(raw)).toEqual(emptyProgress());
  });
});

describe('unlocking', () => {
  it('opens G1 and S1 at the start, the rest when everything below is solved; B1 needs G4 and S4', () => {
    const { game } = setup();
    expect(LESSONS.filter((l) => game.unlocked(l.id)).map((l) => l.id)).toEqual(['G1', 'S1']);
    expect(game.submit('G2', ref('G2'))).toBeUndefined();
    solve(game, 'G1', 'G2', 'G3', 'G4');
    expect(game.status('B1')).toBe('locked');
    solve(game, 'S1', 'S2', 'S3');
    expect(game.status('B1')).toBe('locked');
    solve(game, 'S4');
    expect(game.status('B1')).toBe('open');
    expect(game.status('G4')).toBe('solved');
    solve(game, 'B1', 'B2', 'B3');
    expect(game.stats()).toEqual({ done: 11, total: 11, runs: 11, percent: 100 });
  });
});

describe('starting text', () => {
  it('is empty at the bottom, carried up from the lesson below, and the own text once typed', () => {
    const { game } = setup();
    expect(game.startText('G1')).toBe('');
    solve(game, 'G1');
    expect(game.startText('G2')).toBe(ref('G1'));
    // Opening and saving the unchanged start text does not freeze it.
    game.setText('G2', ref('G1'));
    expect(game.progress().lessons.G2).toBeUndefined();
    // Solving G1 again in another way changes what G2 starts with...
    const other = 'grab()\nturn()\nturn()\ndrop()\n';
    solve(game, 'G1');
    expect(game.submit('G1', other)?.passed).toBe(true);
    expect(game.startText('G2')).toBe(other);
    // ...until the learner types in G2.
    game.setText('G2', 'grab()');
    solve(game, 'G1');
    expect(game.startText('G2')).toBe('grab()');
  });

  it('keeps the last text of a failed run, and the passing text from before', () => {
    const { game } = setup();
    solve(game, 'G1');
    expect(game.submit('G1', 'grab()')?.passed).toBe(false);
    expect(game.startText('G1')).toBe('grab()');
    expect(game.passing('G1')).toBe(ref('G1'));
    expect(game.status('G1')).toBe('solved');
  });

  it('starts B1 empty under "Your machines" made of the current passing G4 and S4', () => {
    const { game } = setup();
    expect(game.machines('B1')).toBe('');
    solve(game, 'G1', 'G2', 'G3', 'G4', 'S1', 'S2', 'S3', 'S4');
    expect(game.startText('B1')).toBe('');
    expect(game.machines('B1')).toMatch(/^def feed\(\):[\s\S]*def make_plate\(ore, coal\):/);
    expect(game.machines('G4')).toBe('');
    // A new passing G4 changes the block's feed.
    const shared = 'def feed():\n    grab()\n    turn()\n    if is_coal():\n        drop()\n        turn()\n    else:\n        turn()\n        drop()\n    turn()\n    turn()\n\nfeed()';
    expect(game.submit('G4', shared)?.passed).toBe(true);
    expect(game.machines('B1')).toContain('    if is_coal():\n        drop()\n        turn()');
    expect(game.submit('B1', ref('B1'))?.passed).toBe(true);
  });
});

describe('submitting', () => {
  it('gives points once, on the first pass; clean only without a miss before', () => {
    const { game, events } = setup();
    expect(game.submit('G1', ref('G1'))?.firstPass).toBe(true);
    expect(game.submit('G1', ref('G1'))?.firstPass).toBe(false);
    expect(game.submit('S1', 'smelt(')?.passed).toBe(false);
    expect(game.submit('S1', 'smelt()')?.firstPass).toBe(true);
    expect(events).toEqual([
      { type: 'level', game: 'factory', id: 'G1', clean: true },
      { type: 'level', game: 'factory', id: 'S1', clean: false },
    ]);
    expect(game.stats()).toEqual({ done: 2, total: 11, runs: 3, percent: 67 });
  });

  it('can hold the points back until the screen shows the verdict', () => {
    const { game, events } = setup();
    const r = game.submit('G1', ref('G1'), true)!;
    expect(events).toEqual([]);
    r.award!();
    expect(events).toEqual([{ type: 'level', game: 'factory', id: 'G1', clean: true }]);
  });

  it('hands the viewer the frames to play', () => {
    const { game } = setup();
    const r = game.submit('G1', 'grab()\nturn()\ndrop()')!.result;
    expect(r).toMatchObject({ passed: false, failure: 'error', play: 0, otherBelt: false });
    const frames = r.belts[r.play]!.frames;
    expect(frames.at(-1)).toMatchObject({ line: 3, event: { kind: 'error', command: 'drop', problem: { code: 'ore-in-bunker' } }, state: { facing: 'N', holding: { kind: 'ore' } } });
  });
});

describe('judge', () => {
  const b2 = lessonById('B2')!;
  const machines = machinesText(b2, ref);

  it('plays the first belt when all pass', () => {
    const r = judge(b2, ref('B2'), machines);
    expect(r).toMatchObject({ passed: true, play: 0, otherBelt: false, machines });
    expect(r.belts.map((b) => b.met)).toEqual([true, true]);
    expect(r.belts[0]!.frames.at(-1)).toMatchObject({ orderMet: true, state: { plates: 2 } });
  });

  it('plays a later failing belt with "it fails on this belt"', () => {
    const r = judge(b2, 'for i in range(2):\n    feed()\n    feed()\n    feed()\n    make_plate(ore, coal)', machines);
    expect(r).toMatchObject({ passed: false, failure: 'order', play: 1, otherBelt: true });
    expect(r.belts.map((b) => b.met)).toEqual([true, false]);
    expect(r.belts[1]!.final.plates).toBe(2);
  });

  it('a precheck failure still gives a playable belt: the start and the error', () => {
    const r = judge(lessonById('S1')!, 'ore = 5');
    expect(r.failure).toBe('precheck');
    expect(r.belts[0]!.frames.map((f) => f.event.kind)).toEqual(['begin', 'error']);
    expect(r.belts[0]!.frames[1]!.line).toBe(1);
    expect(r.belts[0]!.final).toMatchObject({ ore: 2, coal: 3, plates: 0 });
  });
});
