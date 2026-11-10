import { describe, expect, it } from 'vitest';
import { ENEMIES } from './content/index.ts';
import { trainingFight } from './training.ts';

/** The same word in both languages (a name, not a missing translation). */
const NAMES = new Set(['Regenerator', 'Countdown']);

describe('every task text exists in German and in English', () => {
  it('enemies: title and catch line differ between the languages', () => {
    for (const e of ENEMIES) {
      if (!NAMES.has(e.title.de)) expect(e.title.en, e.id).not.toBe(e.title.de);
      expect(e.catchLine.en, e.id).not.toBe(e.catchLine.de);
    }
  });
  it('training fights describe themselves in the language of the player (no English in the German text)', () => {
    for (const level of [2, 3, 4]) {
      for (let seed = 1; seed <= 30; seed++) {
        const { enemy } = trainingFight(seed, level);
        expect(enemy.catchLine.de, `${level}/${seed}`).not.toMatch(/\b(dummies|ahead|enemy|tough|sniper|shield|regenerator|far dummy|side-guard|hide-and-seek)\b/);
        expect(enemy.catchLine.en, `${level}/${seed}`).not.toMatch(/\b(Attrappen|Gegner|Scharfschütze|Schild)\b/);
      }
    }
  });
});
