import { describe, expect, it } from 'vitest';
import { buildSteps } from './game.ts';
import { MESSAGES } from '../i18n.ts';
import { parseMap } from './layout.ts';

/** About two lines on a 360 px phone. */
const MAX_CHARS = 96;
/** The two challenges that explain `if` and `else` need more room for that hint. */
const HINTS: Record<string, number> = { 'ring-search': 220, 'ring-shooter': 240 };

describe('the goal line of a task', () => {
  for (const [lang, messages] of [['de', MESSAGES.de], ['en', MESSAGES.en]] as const) {
    it(`${lang}: goal and catch together stay short (at most two lines on a phone)`, () => {
      for (const s of buildSteps()) {
        const n = parseMap(s.enemy!.map).enemies.length;
        const goal = (n === 1 ? messages['robot.goal.one'] : messages['robot.goal.many']).replace('{n}', String(n));
        const text = `${goal} ${s.enemy!.catchLine[lang]}`;
        expect(text.length, `${s.id}: ${text}`).toBeLessThanOrEqual(HINTS[s.id] ?? MAX_CHARS);
      }
    });
  }
});
