import { describe, expect, it } from 'vitest';
import { QUESTIONS, QUESTIONS_BY_ID } from './content/questions.ts';
import { CONTENT } from './content/lessons.ts';
import {
  SESSION_LENGTH,
  orderedSession,
  pickLeastPlayed,
  advance,
  answer,
  buildSession,
  parseSession,
  present,
  score,
  shuffle,
  type Rng,
} from './session.ts';

/** Small deterministic PRNG (mulberry32). */
function seeded(seed: number): Rng {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('session builder', () => {
  it('picks 10 distinct questions', () => {
    for (let seed = 0; seed < 50; seed++) {
      const session = buildSession(QUESTIONS, seeded(seed));
      expect(session.items).toHaveLength(SESSION_LENGTH);
      expect(new Set(session.items.map((i) => i.id)).size).toBe(SESSION_LENGTH);
      expect(session.index).toBe(0);
      for (const item of session.items) {
        expect(QUESTIONS_BY_ID.has(item.id)).toBe(true);
        expect(item.picked).toBeNull();
      }
    }
  });

  it('is deterministic for an injected RNG', () => {
    expect(buildSession(QUESTIONS, seeded(42))).toEqual(buildSession(QUESTIONS, seeded(42)));
    expect(buildSession(QUESTIONS, seeded(1))).not.toEqual(buildSession(QUESTIONS, seeded(2)));
  });

  it('shuffles choices and remaps the answer index', () => {
    let moved = 0;
    for (let seed = 0; seed < 20; seed++) {
      for (const item of buildSession(QUESTIONS, seeded(seed)).items) {
        const q = QUESTIONS_BY_ID.get(item.id)!;
        expect([...item.order].sort()).toEqual([0, 1, 2, 3]);
        const shown = present(q, item.order);
        expect(shown.choices).toHaveLength(4);
        expect(shown.choices[shown.answerIndex]).toEqual(q.choices[q.answerIndex]);
        expect(new Set(shown.choices)).toEqual(new Set(q.choices));
        if (shown.answerIndex !== q.answerIndex) moved++;
      }
    }
    expect(moved).toBeGreaterThan(0);
  });

  it('draws every question over many sessions (uniform pick, no bias to the front)', () => {
    const seen = new Set<string>();
    const rng = seeded(7);
    for (let i = 0; i < 200; i++) for (const item of buildSession(QUESTIONS, rng).items) seen.add(item.id);
    expect(seen.size).toBe(QUESTIONS.length);
  });

  it('shuffle keeps all elements', () => {
    expect(shuffle([1, 2, 3, 4, 5], seeded(3)).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('answering', () => {
  const session = buildSession(QUESTIONS, seeded(5));
  const correctSlot = (s = session, i = 0) => present(QUESTIONS_BY_ID.get(s.items[i]!.id)!, s.items[i]!.order).answerIndex;

  it('locks the first pick', () => {
    const once = answer(session, 0);
    expect(once.items[0]!.picked).toBe(0);
    expect(answer(once, 1)).toBe(once);
    expect(session.items[0]!.picked).toBeNull();
  });

  it('advances only after answering and ends after the last question', () => {
    expect(advance(session)).toBeUndefined();
    let s = session;
    for (let i = 0; i < SESSION_LENGTH; i++) {
      s = answer(s, correctSlot(s, i));
      const next = advance(s);
      if (i < SESSION_LENGTH - 1) s = next!;
      else expect(next).toBeUndefined();
    }
    expect(score(s, QUESTIONS_BY_ID)).toBe(SESSION_LENGTH);
  });

  it('scores wrong answers as wrong', () => {
    const wrong = (correctSlot() + 1) % 4;
    expect(score(answer(session, wrong), QUESTIONS_BY_ID)).toBe(0);
    expect(score(answer(session, correctSlot()), QUESTIONS_BY_ID)).toBe(1);
  });
});

describe('parseSession', () => {
  const session = answer(buildSession(QUESTIONS, seeded(9)), 2);

  it('accepts a valid saved session, including a showing feedback', () => {
    expect(parseSession(JSON.parse(JSON.stringify(session)), CONTENT)).toEqual(session);
  });

  it('rejects unknown question ids', () => {
    const stale = { ...session, items: session.items.map((it, i) => (i === 3 ? { ...it, id: 'gone-01' } : it)) };
    expect(parseSession(stale, CONTENT)).toBeUndefined();
  });

  it('rejects malformed data', () => {
    const bad: unknown[] = [
      null,
      'session',
      42,
      [],
      {},
      { ...session, index: 10 },
      { ...session, index: -1 },
      { ...session, items: [] },
      { ...session, items: session.items.map((it, i) => (i === 0 ? { ...it, order: [0, 0, 1, 2] } : it)) },
      { ...session, items: session.items.map((it, i) => (i === 0 ? { ...it, order: [0, 1, 2] } : it)) },
      { ...session, items: session.items.map((it, i) => (i === 0 ? { ...it, picked: 4 } : it)) },
      { ...session, items: session.items.map((it, i) => (i === 5 ? { ...it, picked: 1 } : it)) },
      { ...session, items: [session.items[0], session.items[0]] },
      { ...session, lesson: 'unknown' },
    ];
    for (const raw of bad) expect(parseSession(raw, CONTENT), JSON.stringify(raw)).toBeUndefined();
  });
});

describe('lessons', () => {
  const walk = CONTENT.walkthroughs[2]!;

  it('keeps the order of a walkthrough and shuffles only the choices', () => {
    const session = orderedSession('functions', walk.questions, seeded(3));
    expect(session.lesson).toBe('functions');
    expect(session.items.map((i) => i.id)).toEqual(walk.questions.map((q) => q.id));
    for (const item of session.items) expect([...item.order].sort()).toEqual([0, 1, 2, 3]);
  });

  it('marks random sessions as the mixed lesson', () => {
    expect(buildSession(QUESTIONS, seeded(1)).lesson).toBe('mixed');
  });

  it('picks among the least played options only', () => {
    const played = new Map([['a', 2], ['b', 0], ['c', 1], ['d', 0]]);
    const picks = new Set<string>();
    for (let seed = 0; seed < 40; seed++) picks.add(pickLeastPlayed([...played.keys()], (k) => played.get(k)!, seeded(seed)));
    expect([...picks].sort()).toEqual(['b', 'd']);
  });

  it('reads a session saved before lessons existed as mixed', () => {
    const { lesson: _, ...old } = buildSession(QUESTIONS, seeded(4));
    expect(parseSession(JSON.parse(JSON.stringify(old)), CONTENT)?.lesson).toBe('mixed');
  });

  it('accepts a saved walkthrough and rejects one that does not match a function', () => {
    const session = answer(orderedSession('functions', walk.questions, seeded(5)), 1);
    expect(parseSession(JSON.parse(JSON.stringify(session)), CONTENT)).toEqual(session);
    const reversed = { ...session, index: 0, items: [...session.items].reverse().map((it) => ({ ...it, picked: null })) };
    const truncated = { ...session, items: session.items.slice(0, -1) };
    const mixedIds = { ...session, lesson: 'mixed' };
    const walkAsMixed = { ...session, lesson: 'functions', items: buildSession(QUESTIONS, seeded(6)).items };
    for (const raw of [reversed, truncated, mixedIds, walkAsMixed]) {
      expect(parseSession(JSON.parse(JSON.stringify(raw)), CONTENT), JSON.stringify(raw)).toBeUndefined();
    }
  });
});
