import { describe, expect, it } from 'vitest';
import { parseRichText } from './rich-text.ts';

describe('parseRichText', () => {
  it('keeps plain text as one paragraph with one span', () => {
    expect(parseRichText('Just text.')).toEqual([[{ code: false, text: 'Just text.' }]]);
  });

  it('turns backtick spans into code spans', () => {
    expect(parseRichText('Use `len(s)` here: `{1, 2}`')).toEqual([
      [
        { code: false, text: 'Use ' },
        { code: true, text: 'len(s)' },
        { code: false, text: ' here: ' },
        { code: true, text: '{1, 2}' },
      ],
    ]);
  });

  it('splits paragraphs at blank lines', () => {
    expect(parseRichText('First.\n\nSecond `x`.')).toEqual([
      [{ code: false, text: 'First.' }],
      [
        { code: false, text: 'Second ' },
        { code: true, text: 'x' },
        { code: false, text: '.' },
      ],
    ]);
  });

  it('keeps markup-like text as plain text', () => {
    expect(parseRichText('<b>no</b>')).toEqual([[{ code: false, text: '<b>no</b>' }]]);
  });
});
