import { describe, expect, it } from 'vitest';
import { CONTENT } from '../content/lessons.ts';
import { AppStorage, MemoryKeyValue, NAMESPACE } from '../storage.ts';
import { Game } from './game.ts';
import { HUNT_LEVELS } from './hunt-levels.ts';
import { LEVELS } from './levels.ts';

function setup(kv = new MemoryKeyValue()) {
  const storage = new AppStorage(kv, CONTENT);
  return { kv, storage, game: new Game(storage, LEVELS, () => 0.42) };
}

describe('Game', () => {
  it('saves every pick and resumes the level where it was left', () => {
    const { kv, game } = setup();
    const { level, state } = game.open();
    expect(level).toBe(LEVELS[0]);
    const wrong = state.order.findIndex((c) => c !== level.answerIndex);
    game.pick(wrong);

    const resumed = setup(kv).game.open();
    expect(resumed.state).toEqual({ ...state, tried: [state.order[wrong]] });
    expect(setup(kv).game.stats()).toEqual({ done: 0, total: LEVELS.length, picks: 1, percent: 0 });
  });

  it('solves a level, then opens the next one', () => {
    const { game } = setup();
    const { level, state } = game.open();
    expect(game.pick(state.order.indexOf(level.answerIndex))?.solved).toBe(true);
    expect(game.stats()).toMatchObject({ done: 1, picks: 1, percent: 100 });
    expect(game.open(LEVELS[1]!.id).level).toBe(LEVELS[1]);
    expect(game.open().level).toBe(LEVELS[1]);
  });

  it('keeps the hunt game apart: its own levels and saved progress', () => {
    const { kv, storage, game } = setup();
    const hunt = new Game(storage, HUNT_LEVELS, () => 0.42, 'hunt');
    const { level, state } = hunt.open();
    expect(level).toBe(HUNT_LEVELS[0]);
    hunt.pick(state.order.indexOf(level.answerIndex));
    expect(hunt.stats()).toMatchObject({ done: 1, total: HUNT_LEVELS.length, picks: 1 });
    expect(game.stats().picks).toBe(0);
    expect(JSON.parse(kv.getItem(NAMESPACE + 'hunt')!)).toMatchObject({ solved: [HUNT_LEVELS[0]!.id] });
    storage.resetProgress();
    expect(kv.getItem(NAMESPACE + 'hunt')).toBeNull();
    expect(hunt.stats().picks).toBe(0);
  });

  it('is wiped by Reset progress', () => {
    const { kv, storage, game } = setup();
    game.pick(game.open().state.order[0]!);
    storage.resetProgress();
    expect(kv.getItem(NAMESPACE + 'game')).toBeNull();
    expect(game.stats().picks).toBe(0);
  });
});
