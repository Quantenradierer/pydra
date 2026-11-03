import { describe, expect, it } from 'vitest';
import { FEEDBACK_MAX_LENGTH, validateFeedback } from './feedback.ts';

describe('feedback validation', () => {
  it('accepts and trims text', () => {
    expect(validateFeedback({ text: '  hello ' })).toEqual({ text: 'hello' });
  });

  it('rejects missing or non-string text', () => {
    expect(validateFeedback(null)).toEqual({ error: 'invalid' });
    expect(validateFeedback({ text: 5 })).toEqual({ error: 'invalid' });
  });

  it('rejects empty text', () => {
    expect(validateFeedback({ text: '   ' })).toEqual({ error: 'empty' });
  });

  it('allows exactly the maximum length and rejects one more', () => {
    expect(validateFeedback({ text: 'a'.repeat(FEEDBACK_MAX_LENGTH) })).toEqual({ text: 'a'.repeat(2000) });
    expect(validateFeedback({ text: 'a'.repeat(FEEDBACK_MAX_LENGTH + 1) })).toEqual({ error: 'too-long' });
  });

  it('counts characters, not UTF-16 units', () => {
    expect(validateFeedback({ text: '🎵'.repeat(FEEDBACK_MAX_LENGTH) })).not.toHaveProperty('error');
  });
});
