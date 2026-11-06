import { describe, expect, it } from 'vitest';
import { CONTENT } from '../content/lessons.ts';
import { AppStorage, MemoryKeyValue, NAMESPACE } from '../storage.ts';
import { lineRight, mistake, parsePredictProgress, PredictGame, printed, tracePrint, unlockedPredict } from './predict.ts';
import { PREDICT_LEVELS } from './predict-levels.ts';

function setup(kv = new MemoryKeyValue()) {
  const storage = new AppStorage(kv, CONTENT);
  return { kv, storage, game: new PredictGame(storage) };
}

describe('tracePrint', () => {
  it('prints like Python: text without quotes, several values with spaces, True, None and lists', () => {
    const trace = tracePrint('x = 2\nprint("a", x, x > 1)\nprint()\nprint([1, "b"])\nprint(len("abc") == 3)');
    expect(trace.output).toEqual(['a 2 True', '', "[1, 'b']", 'True']);
    expect(printed(null)).toBe('None');
  });

  it('records a step per line with the variables and the lines printed so far', () => {
    const trace = tracePrint('n = 1\nprint(n)\nn = 5');
    expect(trace.steps.map((s) => [s.line, s.printed])).toEqual([
      [1, 0],
      [2, 1],
      [3, 1],
      [null, 1],
    ]);
    expect(trace.steps[2]!.vars).toEqual([['n', '5']]);
  });

  it('stops at a Python error and at an endless loop', () => {
    expect(tracePrint('print(1)\nprint(y)')).toMatchObject({ output: ['1'], error: { line: 2 } });
    expect(tracePrint('while True:\n    pass', 50).error).toMatchObject({ message: 'program too long' });
  });
});

describe('checking a line', () => {
  it('accepts exactly the printed text, ignoring spaces around it', () => {
    expect(lineRight(' Hydra ', 'Hydra')).toBe(true);
    expect(lineRight('hydra', 'Hydra')).toBe(false);
    expect(lineRight('"Hydra"', 'Hydra')).toBe(false);
  });

  it('names near misses: quotes, case, spaces', () => {
    expect(mistake('"Hydra"', 'Hydra')).toBe('quotes');
    expect(mistake("'Hi Hydra'", 'Hi Hydra')).toBe('quotes');
    expect(mistake('true', 'True')).toBe('case');
    expect(mistake('HiHydra', 'Hi Hydra')).toBe('spaces');
    expect(mistake('7', '12')).toBeUndefined();
    expect(mistake('Hydra', 'Hydra')).toBeUndefined();
    expect(mistake('', 'Hydra')).toBeUndefined();
  });
});

describe('PredictGame', () => {
  const first = PREDICT_LEVELS[0]!;

  it('opens the first level with empty lines and keeps what is typed, also after a reload', () => {
    const { kv, game } = setup();
    const { level, state } = game.open();
    expect(level).toBe(first);
    expect(state.guesses).toEqual(first.output.map(() => ''));
    game.type(['Python', 'x']);
    expect(setup(kv).game.open().state).toMatchObject({ guesses: ['Python', 'x'], solved: false });
    // A wrong number of lines is ignored.
    game.type(['only one']);
    expect(game.open().state.guesses).toEqual(['Python', 'x']);
  });

  it('counts checks, solves a level with a right one and unlocks the next', () => {
    const { game } = setup();
    game.open();
    game.type(['Python', 'hydra']);
    expect(game.check()).toEqual({ right: [true, false], solved: false });
    expect(game.progress().current?.misses).toBe(1);
    game.type(['Python', 'Hydra']);
    expect(game.check()).toEqual({ right: [true, true], solved: true });
    expect(game.stats()).toEqual({ done: 1, total: PREDICT_LEVELS.length, checks: 2, percent: 50 });
    expect(game.open().state.solved).toBe(true);
    expect(unlockedPredict(game.progress(), PREDICT_LEVELS).slice(0, 3)).toEqual([true, true, false]);
    // Practice on a solved level counts nothing.
    game.check();
    expect(game.stats().checks).toBe(2);
    // Changing a line takes the "solved" off the state, not off the level.
    game.type(['Python', 'Hydra!']);
    expect(game.open().state.solved).toBe(false);
    expect(game.stats().done).toBe(1);
  });

  it('opens a level anew with empty lines, also a solved one', () => {
    const { game } = setup();
    game.open();
    game.type([...first.output]);
    game.check();
    game.open(PREDICT_LEVELS[1]!.id);
    expect(game.open(first.id).state).toEqual({ level: first.id, guesses: ['', ''], solved: false, misses: 0 });
  });

  it('is wiped by Reset progress', () => {
    const { kv, storage, game } = setup();
    game.open();
    game.check();
    storage.resetProgress();
    expect(kv.getItem(NAMESPACE + 'predict')).toBeNull();
    expect(game.stats().checks).toBe(0);
  });
});

describe('parsePredictProgress', () => {
  it('drops what does not fit', () => {
    const empty = { solved: [], checks: 0, rightChecks: 0 };
    expect(parsePredictProgress(null, PREDICT_LEVELS)).toEqual(empty);
    expect(parsePredictProgress({ solved: [], checks: 1, rightChecks: 2 }, PREDICT_LEVELS)).toEqual(empty);
    expect(
      parsePredictProgress(
        { solved: ['predict-text', 'nope', 'predict-text'], checks: 3, rightChecks: 1, current: { level: 'predict-text', guesses: ['a'], solved: false, misses: 0 } },
        PREDICT_LEVELS,
      ),
    ).toEqual({ solved: ['predict-text'], checks: 3, rightChecks: 1 });
  });

  it('does not trust a "solved" whose lines are not right', () => {
    const raw = { solved: [], checks: 1, rightChecks: 1, current: { level: 'predict-text', guesses: ['Python', 'nope'], solved: true, misses: 0 } };
    expect(parsePredictProgress(raw, PREDICT_LEVELS).current?.solved).toBe(false);
  });
});
