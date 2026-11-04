import { describe, expect, it } from 'vitest';
import { CONTENT } from '../content/lessons.ts';
import { AppStorage, MemoryKeyValue, NAMESPACE } from '../storage.ts';
import { OrderGame, parseOrderProgress, unlockedOrder } from './order.ts';
import { ORDER_LEVELS } from './order-levels.ts';

function setup(kv = new MemoryKeyValue()) {
  const storage = new AppStorage(kv, CONTENT);
  return { kv, storage, game: new OrderGame(storage) };
}

describe('OrderGame', () => {
  it('opens the first level in its shuffled order and keeps every rearrangement, also after a reload', () => {
    const { kv, game } = setup();
    const { level, order } = game.open();
    expect(level).toBe(ORDER_LEVELS[0]);
    expect(order).toEqual(level.start);
    game.arrange([0, 1, 2]);
    expect(setup(kv).game.open()).toEqual({ level, order: [0, 1, 2] });
  });

  it('ignores an arrangement that is not one of every line', () => {
    const { game } = setup();
    game.open();
    for (const bad of [[0, 0, 1], [0, 1], [0, 1, 3]]) game.arrange(bad);
    expect(game.open().order).toEqual(ORDER_LEVELS[0]!.start);
  });

  it('counts runs, solves a level with a winning run and unlocks the next', () => {
    const { game } = setup();
    game.open();
    game.ran(false);
    game.ran(true);
    expect(game.stats()).toEqual({ done: 1, total: ORDER_LEVELS.length, runs: 2 });
    expect(unlockedOrder(game.progress(), ORDER_LEVELS).slice(0, 3)).toEqual([true, true, false]);
    // Solving it again counts the run but not the level twice.
    game.ran(true);
    expect(game.stats()).toMatchObject({ done: 1, runs: 3 });
    expect(game.open(ORDER_LEVELS[1]!.id).order).toEqual(ORDER_LEVELS[1]!.start);
  });

  it('is wiped by Reset progress', () => {
    const { kv, storage, game } = setup();
    game.open();
    game.ran(true);
    storage.resetProgress();
    expect(kv.getItem(NAMESPACE + 'order')).toBeNull();
    expect(game.stats().runs).toBe(0);
  });
});

describe('parseOrderProgress', () => {
  it('drops what does not fit', () => {
    expect(parseOrderProgress(null, ORDER_LEVELS)).toEqual({ solved: [], runs: 0, wins: 0 });
    expect(parseOrderProgress({ solved: [], runs: 1, wins: 2 }, ORDER_LEVELS)).toEqual({ solved: [], runs: 0, wins: 0 });
    expect(
      parseOrderProgress({ solved: ['order-steps', 'nope', 'order-steps'], runs: 3, wins: 1, current: { level: 'order-steps', order: [1, 1, 0] } }, ORDER_LEVELS),
    ).toEqual({ solved: ['order-steps'], runs: 3, wins: 1 });
  });
});
