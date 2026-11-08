import { describe, expect, it } from 'vitest';
import { CONTENT } from '../content/lessons.ts';
import { AppStorage, MemoryKeyValue } from '../storage.ts';
import { CARDS, cardsOfChapter } from './content/cards.ts';
import { RobotGame } from './game.ts';
import { parse } from './py/parser.ts';
import { UNLOCK_CHAPTER } from './build.ts';

describe('concept cards', () => {
  it('have unique ids, both languages, and examples that parse', () => {
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
    for (const c of CARDS) {
      expect(c.idea.de.length, c.id).toBeGreaterThan(20);
      expect(c.idea.en.length, c.id).toBeGreaterThan(20);
      expect(() => parse(c.example), c.id).not.toThrow();
    }
  });
  it('open every chapter 0-4 and every part with its unlock chapter', () => {
    for (let ch = 0; ch <= 4; ch++) expect(cardsOfChapter(ch).some((c) => c.kind === 'chapter'), `chapter ${ch}`).toBe(true);
    expect(CARDS.find((c) => c.id === 'part-hammer')!.chapter).toBe(UNLOCK_CHAPTER.gear.hammer);
    expect(CARDS.find((c) => c.id === 'part-gps')!.chapter).toBe(UNLOCK_CHAPTER.gear.gps);
    expect(CARDS.find((c) => c.id === 'part-treads')!.chapter).toBe(UNLOCK_CHAPTER.locomotion.treads);
    expect(CARDS.find((c) => c.id === 'part-cannon')!.chapter).toBe(UNLOCK_CHAPTER.gear.cannon);
  });
  it('are remembered once read, and unknown ids are ignored', () => {
    const game = new RobotGame(new AppStorage(new MemoryKeyValue(), CONTENT));
    expect(game.cardSeen('ch0')).toBe(false);
    game.markCard('ch0');
    game.markCard('ch0');
    game.markCard('nope');
    expect(game.progress().cards).toEqual(['ch0']);
    expect(game.cardSeen('ch0')).toBe(true);
  });
});
