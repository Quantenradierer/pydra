import { describe, expect, it } from 'vitest';
import { CONTENT } from './content/lessons.ts';
import { present } from './session.ts';
import { EMPTY_COUNTERS, parseCounters, parseQuestionStats, percentCorrect } from './stats.ts';
import { AppStorage, MemoryKeyValue, NAMESPACE } from './storage.ts';
import { Trainer } from './trainer.ts';

const NOW = new Date('2026-11-03T10:00:00Z');

function setup(kv = new MemoryKeyValue()) {
  const storage = new AppStorage(kv, CONTENT);
  let r = 0.37;
  const rng = () => (r = (r * 9301 + 0.49297) % 1);
  const trainer = new Trainer(storage, CONTENT, rng, () => NOW);
  const correctSlot = () => {
    const s = trainer.session()!;
    const item = s.items[s.index]!;
    return present(CONTENT.byId.get(item.id)!, item.order).answerIndex;
  };
  return { kv, storage, trainer, correctSlot };
}

describe('storage', () => {
  it('defaults to German and remembers the language', () => {
    const { storage, kv } = setup();
    expect(storage.language()).toBe('de');
    storage.setLanguage('en');
    expect(new AppStorage(kv, CONTENT).language()).toBe('en');
  });

  it('ignores corrupt and foreign values without throwing', () => {
    const kv = new MemoryKeyValue();
    kv.setItem(NAMESPACE + 'language', '"fr"');
    kv.setItem(NAMESPACE + 'session', '{not json');
    kv.setItem(NAMESPACE + 'counters', '{"sessionsPlayed":"many"}');
    kv.setItem(NAMESPACE + 'questionStats', '[1,2]');
    kv.setItem(NAMESPACE + 'lastResult', '{"score":11,"total":10}');
    kv.setItem(NAMESPACE + 'feedbackQueue', '"text"');
    const storage = new AppStorage(kv, CONTENT);
    expect(storage.language()).toBe('de');
    expect(storage.session()).toBeUndefined();
    expect(storage.counters()).toEqual(EMPTY_COUNTERS);
    expect(storage.questionStats()).toEqual({});
    expect(storage.lastResult()).toBeUndefined();
    expect(storage.feedbackQueue()).toEqual([]);
  });

  it('survives a storage that throws', () => {
    const throwing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    const storage = new AppStorage(throwing, CONTENT);
    expect(storage.language()).toBe('de');
    expect(() => storage.setLanguage('en')).not.toThrow();
    expect(() => storage.resetProgress()).not.toThrow();
  });

  it('keeps valid per-question stats and drops broken entries', () => {
    expect(
      parseQuestionStats({
        'types-01': { seen: 2, correct: 1, lastSeen: 'x' },
        'types-02': { seen: 1, correct: 2, lastSeen: 'x' },
        'types-03': 'nope',
      }),
    ).toEqual({ 'types-01': { seen: 2, correct: 1, lastSeen: 'x' } });
    expect(parseCounters({ sessionsPlayed: 1, bestScore: 5, totalAnswers: 3, totalCorrect: 4 })).toEqual(EMPTY_COUNTERS);
  });
});

describe('auto-resume', () => {
  it('resumes the saved session, including the showing feedback', () => {
    const { trainer, kv, correctSlot } = setup();
    trainer.start();
    trainer.answer(correctSlot());
    trainer.next();
    trainer.answer(0);
    const reopened = setup(kv).trainer;
    const session = reopened.session()!;
    expect(session.index).toBe(1);
    expect(session.items[1]!.picked).toBe(0);
    expect(session).toEqual(trainer.session());
  });

  it('discards a session that references a question that no longer exists', () => {
    const { trainer, kv } = setup();
    const session = trainer.start();
    kv.setItem(
      NAMESPACE + 'session',
      JSON.stringify({ ...session, items: session.items.map((it, i) => (i === 0 ? { ...it, id: 'types-99' } : it)) }),
    );
    expect(trainer.session()).toBeUndefined();
    expect(trainer.isRunning()).toBe(false);
    expect(kv.getItem(NAMESPACE + 'session')).toBeNull();
  });

  it('ignores a corrupt saved session', () => {
    const { trainer, kv } = setup();
    kv.setItem(NAMESPACE + 'session', '{"items":');
    expect(trainer.session()).toBeUndefined();
  });
});

describe('stats', () => {
  it('counts every answer immediately and the session when it is finished', () => {
    const { trainer, storage, correctSlot } = setup();
    trainer.start();
    const first = trainer.session()!.items[0]!.id;
    trainer.answer(correctSlot());
    expect(storage.counters()).toEqual({ sessionsPlayed: 0, bestScore: 0, totalAnswers: 1, totalCorrect: 1 });
    expect(storage.questionStats()[first]).toEqual({ seen: 1, correct: 1, lastSeen: NOW.toISOString() });

    // A second pick on the same question does not count.
    trainer.answer((correctSlot() + 1) % 4);
    expect(storage.counters().totalAnswers).toBe(1);

    for (let i = 1; i < 10; i++) {
      trainer.next();
      trainer.answer(i < 7 ? correctSlot() : (correctSlot() + 1) % 4);
    }
    expect(trainer.next()).toEqual({ lesson: 'mixed', score: 7, total: 10 });
    expect(trainer.isRunning()).toBe(false);
    expect(storage.lastResult()).toEqual({ lesson: 'mixed', score: 7, total: 10 });
    expect(storage.counters()).toEqual({ sessionsPlayed: 1, bestScore: 7, totalAnswers: 10, totalCorrect: 7 });
    expect(percentCorrect(storage.counters())).toBe(70);
    expect(Object.keys(storage.questionStats())).toHaveLength(10);
  });

  it('does not advance before the current question is answered', () => {
    const { trainer } = setup();
    trainer.start();
    expect(trainer.next()).toEqual(trainer.session());
    expect(trainer.session()!.index).toBe(0);
  });

  it('keeps the best score', () => {
    const { storage, kv } = setup();
    storage.setCounters({ sessionsPlayed: 3, bestScore: 9, totalAnswers: 30, totalCorrect: 20 });
    const { trainer } = setup(kv);
    trainer.start();
    for (let i = 0; i < 10; i++) {
      trainer.answer(0);
      trainer.next();
    }
    expect(storage.counters().bestScore).toBe(9);
    expect(storage.counters().sessionsPlayed).toBe(4);
  });

  it('quitting discards the session but keeps the stats', () => {
    const { trainer, storage, correctSlot } = setup();
    trainer.start();
    trainer.answer(correctSlot());
    trainer.quit();
    expect(trainer.isRunning()).toBe(false);
    expect(storage.counters()).toEqual({ sessionsPlayed: 0, bestScore: 0, totalAnswers: 1, totalCorrect: 1 });
  });

  it('reset wipes stats, counters and the session but keeps the language', () => {
    const { trainer, storage, correctSlot } = setup();
    storage.setLanguage('en');
    trainer.start();
    trainer.answer(correctSlot());
    storage.resetProgress();
    expect(trainer.session()).toBeUndefined();
    expect(storage.counters()).toEqual(EMPTY_COUNTERS);
    expect(storage.questionStats()).toEqual({});
    expect(storage.language()).toBe('en');
  });
});

describe('functions lesson', () => {
  /** Plays a whole walkthrough, answering right for the first `right` steps. */
  function playWalkthrough(trainer: Trainer, correctSlot: () => number, right = Infinity) {
    const session = trainer.start('functions');
    for (let i = 0; i < session.items.length; i++) {
      if (i > 0) trainer.next();
      trainer.answer(i < right ? correctSlot() : (correctSlot() + 1) % 4);
    }
    return { session, result: trainer.next() };
  }

  it('walks through one function line by line, then asks about the whole function', () => {
    const { trainer } = setup();
    const session = trainer.start('functions');
    const walk = CONTENT.walkthroughs.find((w) => w.questions[0]!.id === session.items[0]!.id)!;
    expect(session.items.map((i) => i.id)).toEqual(walk.questions.map((q) => q.id));
    const lines = session.items.map((i) => trainer.question(i.id).line);
    expect(lines).toEqual([...lines.slice(0, -1).map((_, i) => i + 1), undefined]);
  });

  it('keeps its own counters and result, apart from the mixed quiz', () => {
    const { trainer, storage, correctSlot } = setup();
    const { session, result } = playWalkthrough(trainer, correctSlot, 2);
    const total = session.items.length;
    expect(result).toEqual({ lesson: 'functions', score: 2, total });
    expect(storage.lastResult()).toEqual({ lesson: 'functions', score: 2, total });
    expect(storage.counters('functions')).toEqual({ sessionsPlayed: 1, bestScore: 2, totalAnswers: total, totalCorrect: 2 });
    expect(storage.counters()).toEqual(EMPTY_COUNTERS);
    expect(trainer.walkthroughProgress()).toEqual({ done: 1, total: CONTENT.walkthroughs.length });
  });

  it('plays every function once before repeating one', () => {
    const { trainer, correctSlot } = setup();
    const firsts = CONTENT.walkthroughs.map(() => playWalkthrough(trainer, correctSlot).session.items[0]!.id);
    expect(new Set(firsts).size).toBe(CONTENT.walkthroughs.length);
    expect(trainer.walkthroughProgress().done).toBe(CONTENT.walkthroughs.length);
  });

  it('resumes a walkthrough and resets its counters with the rest', () => {
    const { trainer, storage, kv, correctSlot } = setup();
    trainer.start('functions');
    trainer.answer(correctSlot());
    expect(setup(kv).trainer.session()).toEqual(trainer.session());
    storage.resetProgress();
    expect(storage.counters('functions')).toEqual(EMPTY_COUNTERS);
    expect(trainer.walkthroughProgress().done).toBe(0);
  });

  it('reads a last result saved before lessons existed as the mixed quiz', () => {
    const kv = new MemoryKeyValue();
    kv.setItem(NAMESPACE + 'lastResult', '{"score":3,"total":10}');
    expect(new AppStorage(kv, CONTENT).lastResult()).toEqual({ lesson: 'mixed', score: 3, total: 10 });
  });
});
