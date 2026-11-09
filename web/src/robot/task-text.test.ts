import { describe, expect, it } from 'vitest';
import { buildSteps } from './game.ts';
import { MESSAGES } from '../i18n.ts';

/** About two lines on a 360 px phone. */
const MAX_CHARS = 96;

describe('the goal line of a task', () => {
  for (const [lang, messages] of [['de', MESSAGES.de], ['en', MESSAGES.en]] as const) {
    it(`${lang}: goal and catch together stay short (at most two lines on a phone)`, () => {
      for (const s of buildSteps()) {
        const goal = (s.enemy!.enemies.length === 1 ? messages['robot.goal.one'] : messages['robot.goal.many']).replace('{n}', String(s.enemy!.enemies.length));
        const text = `${goal} ${s.enemy!.catchLine[lang]}`;
        expect(text.length, `${s.id}: ${text}`).toBeLessThanOrEqual(MAX_CHARS);
      }
    });
  }
});
