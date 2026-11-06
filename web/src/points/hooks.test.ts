import { describe, expect, it } from 'vitest';
import { CONTENT } from '../content/lessons.ts';
import { present } from '../session.ts';
import { Game } from '../game/game.ts';
import { HUNT_LEVELS } from '../game/hunt-levels.ts';
import { OrderGame } from '../game/order.ts';
import { ORDER_LEVELS } from '../game/order-levels.ts';
import { PredictGame } from '../game/predict.ts';
import { AppStorage, MemoryKeyValue } from '../storage.ts';
import { Trainer } from '../trainer.ts';
import type { PointsEvent } from './state.ts';

function setup() {
  const storage = new AppStorage(new MemoryKeyValue(), CONTENT);
  const events: PointsEvent[] = [];
  const on = (e: PointsEvent) => events.push(e);
  return { storage, events, on };
}

describe('what reports to the points', () => {
  it('the quiz reports each answer once and a perfect session', () => {
    const { storage, events, on } = setup();
    const trainer = new Trainer(storage, CONTENT, Math.random, () => new Date(), on);
    trainer.start('mixed');
    for (let i = 0; i < 10; i++) {
      const s = trainer.session()!;
      const item = s.items[s.index]!;
      const right = present(CONTENT.byId.get(item.id)!, item.order).answerIndex;
      trainer.answer(right);
      trainer.answer(right === 0 ? 1 : 0); // a second pick on the same question changes nothing
      trainer.next();
    }
    expect(events.filter((e) => e.type === 'quiz')).toHaveLength(10);
    expect(events.filter((e) => e.type === 'quiz').every((e) => e.type === 'quiz' && e.correct)).toBe(true);
    expect(events.at(-1)).toEqual({ type: 'session', perfect: true });
  });

  it('a hunt level reports its first solve, clean or not, and no practice', () => {
    const { storage, events, on } = setup();
    const hunt = new Game(storage, HUNT_LEVELS, Math.random, 'hunt', on);
    const { level, state } = hunt.open();
    hunt.pick(state.order.findIndex((c) => c !== level.answerIndex));
    expect(events).toEqual([]);
    hunt.pick(state.order.indexOf(level.answerIndex));
    expect(events).toEqual([{ type: 'level', game: 'hunt', id: level.id, clean: false }]);
    hunt.open(level.id);
    hunt.pick(state.order.indexOf(level.answerIndex));
    expect(events).toHaveLength(1);
  });

  it('a first-try fishing level is clean', () => {
    const { storage, events, on } = setup();
    const game = Game.fishing(storage, Math.random, on);
    const { level, state } = game.open();
    game.pick(state.order.indexOf(level.answerIndex));
    expect(events).toEqual([{ type: 'level', game: 'game', id: level.id, clean: true }]);
  });

  it('the code puzzle reports a winning run once', () => {
    const { storage, events, on } = setup();
    const game = new OrderGame(storage, undefined, on);
    game.open();
    game.ran(false);
    game.ran(true);
    game.ran(true);
    expect(events).toEqual([{ type: 'level', game: 'order', id: ORDER_LEVELS[0]!.id, clean: false }]);
  });

  it('predict reports the first right check, clean when nothing was missed', () => {
    const { storage, events, on } = setup();
    const game = new PredictGame(storage, undefined, on);
    const { level } = game.open();
    game.type(level.output.map(() => 'wrong'));
    game.check();
    expect(events).toEqual([]);
    game.type([...level.output]);
    game.check();
    game.check();
    expect(events).toEqual([{ type: 'level', game: 'predict', id: level.id, clean: false }]);
  });
});
