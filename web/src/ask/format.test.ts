import { describe, expect, it } from 'vitest';
import { parseChat } from './format.ts';

describe('parseChat', () => {
  it('splits text, inline code and fenced blocks', () => {
    expect(parseChat('Use `print`.\n\n```python\nprint(1)\n```\nDone <b>x</b>')).toEqual([
      {
        kind: 'text',
        paragraphs: [
          [
            { code: false, text: 'Use ' },
            { code: true, text: 'print' },
            { code: false, text: '.' },
          ],
        ],
      },
      { kind: 'code', code: 'print(1)' },
      { kind: 'text', paragraphs: [[{ code: false, text: 'Done <b>x</b>' }]] },
    ]);
  });

  it('shows an unclosed fence while streaming', () => {
    expect(parseChat('A\n```py\nx = 1')).toContainEqual({ kind: 'code', code: 'x = 1' });
  });
});
