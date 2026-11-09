import { describe, expect, it } from 'vitest';
import { START_BUILD } from './build.ts';
import { ENEMIES } from './content/index.ts';
import { DEFAULT_BUILD } from './fight.ts';
import { RobotGame } from './game.ts';
import { CHALLENGES } from './content/challenges.ts';
import { AppStorage, MemoryKeyValue } from '../storage.ts';
import { CONTENT } from '../content/lessons.ts';
import { buildQueue, evaluateQueue, lossReason, outcomeOf, playItem } from './variations.ts';
import { stateAt, buildBeats } from './stepper.ts';

const enemy = (id: string) => ENEMIES.find((e) => e.id === id)!;
const earlierOf = (id: string) => {
  const e = enemy(id);
  return ENEMIES.filter((x) => x.chapter === e.chapter && x.regression !== false && ENEMIES.indexOf(x) < ENEMIES.indexOf(e));
};

describe('buildQueue', () => {
  it('lists all layouts of the enemy first, then every layout of each earlier enemy', () => {
    const e = enemy('armored-dummy');
    const q = buildQueue(e, earlierOf('armored-dummy'), ENEMIES);
    expect(q[0]).toMatchObject({ key: 'armored-dummy#1', n: 1, of: e.maps.length, regression: false });
    expect(q.filter((i) => !i.regression)).toHaveLength(e.maps.length);
    const earlierIds = [...new Set(q.filter((i) => i.regression).map((i) => i.enemy.id))];
    expect(earlierIds).toEqual(earlierOf('armored-dummy').map((x) => x.id));
    expect(new Set(q.map((i) => i.key)).size).toBe(q.length);
    // Main fights come before every regression fight.
    expect(q.findIndex((i) => i.regression)).toBe(e.maps.length);
  });

  it('is the same list the game uses for a step, and empty of regressions for a side mission or training fight', () => {
    const game = new RobotGame(new AppStorage(new MemoryKeyValue(), CONTENT), ENEMIES, CHALLENGES, () => {}, () => 1000);
    const step = game.step('armored-dummy')!;
    expect(game.variationQueue(step).map((i) => i.key)).toEqual(buildQueue(step.enemy!, earlierOf('armored-dummy'), ENEMIES).map((i) => i.key));
    const side = game.steps.find((s) => s.enemy?.regression === false)!;
    expect(game.variationQueue(side).every((i) => !i.regression)).toBe(true);
  });
});

describe('evaluateQueue', () => {
  const e = enemy('armored-dummy');
  const sol = DEFAULT_BUILD;

  it('every fight is won by the enemy\'s solution, with ticks and damage', () => {
    const out = evaluateQueue(buildQueue(e, earlierOf('armored-dummy'), ENEMIES), sol, e.solution);
    expect(out.every((o) => o.won && o.reason === undefined)).toBe(true);
    expect(out.every((o) => o.ticks > 0)).toBe(true);
  });

  it('explains each loss: script ended, an error, or a broken extra rule', () => {
    const items = buildQueue(e, [], ENEMIES);
    const idle = outcomeOf(items[0]!, playItem(items[0]!, START_BUILD, 'turn_left()'));
    expect(idle.won).toBe(false);
    expect(idle.reason).toEqual({ code: 'timeout' });
    const bad = outcomeOf(items[0]!, playItem(items[0]!, START_BUILD, 'forward()\nfoward()'));
    expect(bad.reason).toMatchObject({ code: 'error', line: 2 });
    const loop = outcomeOf(items[0]!, playItem(items[0]!, START_BUILD, 'while True:\n    pass'));
    expect(loop.reason).toMatchObject({ code: 'budget' });
  });

  it('a traced play gives the same outcome as an untraced one, and carries the trace', () => {
    const items = buildQueue(e, [], ENEMIES);
    const traced = playItem(items[0]!, sol, e.solution, true);
    const plain = playItem(items[0]!, sol, e.solution);
    expect(outcomeOf(items[0]!, traced)).toEqual(outcomeOf(items[0]!, plain));
    expect(traced.battle.frames[1]!.trace).toBeDefined();
    expect(plain.battle.frames[1]!.trace).toBeUndefined();
    expect(stateAt(buildBeats(traced.battle.frames), 1).hints.size).toBeGreaterThan(0);
  });

  it('a regression fight a new script loses is reported against the old enemy', () => {
    // Chapter 1: an unrelated one-liner beats nothing earlier.
    const q = buildQueue(e, earlierOf('armored-dummy'), ENEMIES);
    const out = evaluateQueue(q, DEFAULT_BUILD, 'fire()');
    const lostOld = out.filter((o) => o.item.regression && !o.won);
    expect(lostOld.length).toBeGreaterThan(0);
    expect(lostOld.every((o) => lossReason(playItem(o.item, DEFAULT_BUILD, 'fire()')) !== undefined)).toBe(true);
  });
});
