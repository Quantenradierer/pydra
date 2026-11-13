import { describe, expect, it } from 'vitest';
import { CONTENT } from '../content/lessons.ts';
import { AppStorage } from '../storage.ts';
import { CHALLENGES } from './challenges.ts';
import { ElevatorGame, parseProgress, type ElevatorPointsEvent } from './game.ts';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  };
}

const setup = () => {
  const events: ElevatorPointsEvent[] = [];
  const game = new ElevatorGame(new AppStorage(memoryStorage(), CONTENT), (e) => events.push(e));
  return { game, events };
};
const ref = (i: number) => CHALLENGES[i]!.reference;
/** The id of the challenge shown as number `n`. */
const id = (n: number) => CHALLENGES[n - 1]!.id;

describe('Hydra Lift progress', () => {
  it('opens only the first challenge at the start, with its starter', () => {
    const { game } = setup();
    expect(CHALLENGES.map((c) => game.status(c.id))).toEqual(['open', ...CHALLENGES.slice(1).map(() => 'locked')]);
    expect(game.startText(id(1))).toBe(CHALLENGES[0]!.starter);
    expect(game.submit(id(2), ref(1))).toBeUndefined();
  });

  it('solving one opens the next, which starts with the passing code', () => {
    const { game, events } = setup();
    const report = game.submit(id(1), ref(0))!;
    expect(report).toMatchObject({ passed: true, firstPass: true });
    expect(events).toEqual([{ type: 'level', game: 'elevator', id: id(1), clean: true }]);
    expect(game.status(id(1))).toBe('solved');
    expect(game.status(id(2))).toBe('open');
    expect(game.best(id(1))?.elapsed).toBe(report.result.stats.elapsed);
    // 3 has no starter: it opens with the passing code of 2.
    game.submit(id(2), ref(1));
    expect(game.startText(id(3))).toBe(ref(1));
  });

  it('a challenge with its own starter does not start with the code before', () => {
    const { game } = setup();
    game.submit(id(1), ref(0));
    expect(game.startText(id(2))).toBe(CHALLENGES[1]!.starter);
  });

  it('counts misses: the first pass after a miss is not clean, a second pass gives nothing', () => {
    const { game, events } = setup();
    expect(game.submit(id(1), 'elevator.go_to_floor(0)\n')!.passed).toBe(false);
    expect(game.progress().misses[id(1)]).toBe(1);
    game.submit(id(1), ref(0));
    game.submit(id(1), ref(0));
    expect(events).toEqual([{ type: 'level', game: 'elevator', id: id(1), clean: false }]);
    expect(game.stats()).toEqual({ done: 1, total: CHALLENGES.length, runs: 2, percent: 50 });
  });

  it('defers the points until the verdict is shown', () => {
    const { game, events } = setup();
    const report = game.submit(id(1), ref(0), true)!;
    expect(events).toEqual([]);
    report.award!();
    expect(events).toHaveLength(1);
  });

  it('keeps the learner’s text, but not an unchanged start text', () => {
    const { game } = setup();
    game.setText(id(1), CHALLENGES[0]!.starter!);
    expect(game.progress().challenges[id(1)]).toBeUndefined();
    game.setText(id(1), 'def on_idle():\n    pass\n');
    expect(game.startText(id(1))).toBe('def on_idle():\n    pass\n');
  });

  it('reads stored progress defensively', () => {
    const [a, b, c] = [id(1), id(2), id(3)];
    const p = parseProgress({ challenges: { [a]: { last: 'x', passing: 'y', best: { elapsed: 20, moves: 4, maxWait: 6 } }, '1': {}, '99': {} }, solved: [a, b, 'x'], runs: 3, wins: 9, current: b, misses: { [b]: 1, [c]: -1 } });
    expect(p).toEqual({ challenges: { [a]: { last: 'x', passing: 'y', best: { elapsed: 20, moves: 4, maxWait: 6 } } }, solved: [a], misses: { [b]: 1 }, runs: 3, wins: 0, current: b });
    expect(parseProgress('nonsense')).toEqual({ challenges: {}, solved: [], misses: {}, runs: 0, wins: 0 });
  });

  it('knows challenges by their UUID: one added in between is new, the others keep their progress', () => {
    const storage = new AppStorage(memoryStorage(), CONTENT);
    const before = new ElevatorGame(storage);
    before.submit(id(1), ref(0));
    before.submit(id(2), ref(1));
    // A new challenge between 1 and 2: it opens (1 is solved); 2 stays solved and 3 stays open.
    const added = { ...CHALLENGES[2]!, id: 'a1b2c3d4-0000-4000-8000-000000000000' };
    const after = new ElevatorGame(storage, () => {}, [CHALLENGES[0]!, added, ...CHALLENGES.slice(1)]);
    expect([id(1), added.id, id(2), id(3)].map((x) => after.status(x))).toEqual(['solved', 'open', 'solved', 'open']);
    // Without a starter of its own, its code starts with the passing code of the one before it.
    expect(after.startText(added.id)).toBe(ref(0));
  });
});
