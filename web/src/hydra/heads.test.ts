import { describe, expect, it } from 'vitest';
import { QUESTIONS, QUESTIONS_BY_ID } from '../content/questions.ts';
import { advance, answer, buildSession, currentItem, parseSession, present, type Session } from '../session.ts';
import { resultHeads, sessionHeads } from './heads.ts';

const question = (id: string) => QUESTIONS_BY_ID.get(id)!;

function correctSlot(session: Session): number {
  const item = currentItem(session);
  return present(question(item.id), item.order).answerIndex;
}

describe('session heads', () => {
  it('starts with the first head active and the others idle', () => {
    const heads = sessionHeads(buildSession(QUESTIONS), question);
    expect(heads).toEqual(['active', ...Array(9).fill('idle')]);
  });

  it('slashes the head of a right answer and regrows the head of a wrong one', () => {
    let session = buildSession(QUESTIONS);
    session = answer(session, correctSlot(session));
    expect(sessionHeads(session, question).slice(0, 2)).toEqual(['slashed', 'idle']);

    session = advance(session)!;
    expect(sessionHeads(session, question).slice(0, 3)).toEqual(['slashed', 'active', 'idle']);
    session = answer(session, (correctSlot(session) + 1) % 4);
    session = advance(session)!;
    expect(sessionHeads(session, question).slice(0, 3)).toEqual(['slashed', 'regrown', 'active']);
  });

  it('gives the same heads for a session restored from storage', () => {
    let session = buildSession(QUESTIONS);
    session = advance(answer(session, correctSlot(session)))!;
    session = answer(session, (correctSlot(session) + 2) % 4);
    const restored = parseSession(JSON.parse(JSON.stringify(session)), QUESTIONS_BY_ID)!;
    expect(sessionHeads(restored, question)).toEqual(sessionHeads(session, question));
  });
});

describe('result heads', () => {
  it('slashes exactly `score` heads and regrows the rest', () => {
    for (let score = 0; score <= 10; score++) {
      const heads = resultHeads(score, 10);
      expect(heads).toHaveLength(10);
      expect(heads.filter((h) => h === 'slashed')).toHaveLength(score);
      expect(heads.filter((h) => h === 'regrown')).toHaveLength(10 - score);
    }
  });

  it('spreads the slashed heads over the hydra', () => {
    expect(resultHeads(5, 10)).toEqual(Array(5).fill(['regrown', 'slashed']).flat());
  });
});
