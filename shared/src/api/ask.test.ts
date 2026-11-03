import { describe, expect, it } from 'vitest';
import { validateAsk } from './ask.ts';

const base = () => ({
  lang: 'de',
  question: { prompt: 'p', choices: ['a', 'b'] },
  messages: [{ role: 'user', content: 'hi' }],
});

describe('ask validation', () => {
  it('accepts a valid body, with and without the answered block', () => {
    expect(validateAsk(base())).toEqual(base());
    const answered = { ...base(), question: { ...base().question, answered: { picked: 0, correct: 1, explanation: 'e' } } };
    expect(validateAsk(answered)).toEqual(answered);
  });

  it('rejects malformed bodies', () => {
    expect(validateAsk(null)).toEqual({ error: 'invalid' });
    expect(validateAsk({ ...base(), lang: 'fr' })).toEqual({ error: 'invalid' });
    expect(validateAsk({ ...base(), messages: [{ role: 'system', content: 'x' }] })).toEqual({ error: 'invalid' });
    expect(validateAsk({ ...base(), messages: [{ role: 'user', content: '  ' }] })).toEqual({ error: 'invalid' });
    const badIndex = { ...base(), question: { ...base().question, answered: { picked: 5, correct: 1, explanation: 'e' } } };
    expect(validateAsk(badIndex)).toEqual({ error: 'invalid' });
  });

  it('enforces size caps', () => {
    expect(validateAsk({ ...base(), messages: [{ role: 'user', content: 'x'.repeat(2001) }] })).toEqual({ error: 'too-long' });
    expect(validateAsk({ ...base(), messages: Array.from({ length: 41 }, () => ({ role: 'user', content: 'x' })) })).toEqual({
      error: 'invalid',
    });
  });
});
