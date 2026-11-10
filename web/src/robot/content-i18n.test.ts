import { describe, expect, it } from 'vitest';
import { ENEMIES } from './content/index.ts';

/** The same word in both languages (a name, not a missing translation). */
const NAMES = new Set(['Regenerator', 'Countdown']);

describe('every task text exists in German and in English', () => {
  it('enemies: title and catch line differ between the languages', () => {
    for (const e of ENEMIES) {
      if (!NAMES.has(e.title.de)) expect(e.title.en, e.id).not.toBe(e.title.de);
      expect(e.catchLine.en, e.id).not.toBe(e.catchLine.de);
    }
  });
});
