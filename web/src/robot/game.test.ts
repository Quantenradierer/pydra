import { describe, expect, it } from 'vitest';
import { CONTENT } from '../content/lessons.ts';
import { AppStorage, MemoryKeyValue } from '../storage.ts';
import type { PointsEvent } from '../points/state.ts';
import { ENEMIES } from './content/index.ts';
import { buildSteps, isUnlocked, parseProgress, RobotGame, STARTER_SCRIPT } from './game.ts';

function setup() {
  const kv = new MemoryKeyValue();
  const events: PointsEvent[] = [];
  const game = new RobotGame(new AppStorage(kv, CONTENT), ENEMIES, (e) => events.push(e), () => 1000);
  return { kv, game, events };
}

describe('steps', () => {
  const steps = buildSteps();

  it('are the enemies in order, one challenge each, nothing else', () => {
    expect(steps.map((s) => s.id)).toEqual(ENEMIES.map((e) => e.id));
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
  });

  it('unlock one after the other, no gaps', () => {
    expect(isUnlocked(steps[0]!, [], steps)).toBe(true);
    expect(isUnlocked(steps.find((s) => s.id === 'one-more-line')!, [], steps)).toBe(false);
    expect(isUnlocked(steps.find((s) => s.id === 'one-more-line')!, ['first-contact'], steps)).toBe(true);
    expect(isUnlocked(steps.find((s) => s.id === 'training-dummy')!, ['first-contact'], steps)).toBe(false);
  });
});

describe('RobotGame', () => {
  it('starts with a finished script, never a blank file', () => {
    const { game } = setup();
    expect(game.script()).toBe(STARTER_SCRIPT);
    game.setScript('   \n');
    expect(game.script()).toBe(STARTER_SCRIPT);
    game.setScript('fire()');
    expect(game.script()).toBe('fire()');
  });

  it('wins First Contact with the starter script: points once, stars, history', () => {
    const { game, events } = setup();
    const r = game.run('first-contact')!;
    expect(r.won).toBe(true);
    expect(r.firstWin).toBe(true);
    expect(r.stars).toBe(3);
    expect(events).toEqual([{ type: 'level', game: 'robot', id: 'first-contact', clean: true }]);
    expect(game.run('first-contact')!.firstWin).toBe(false);
    expect(events).toHaveLength(1);
    expect(game.history()).toHaveLength(1);
    expect(game.stats()).toMatchObject({ done: 1, total: buildSteps().length });
  });

  it('can hold the points back until the screen shows the verdict (after the fight was played)', () => {
    const { game, events } = setup();
    const r = game.run('first-contact', true)!;
    expect(r.won).toBe(true);
    expect(events).toEqual([]);
    r.award!();
    expect(events).toEqual([{ type: 'level', game: 'robot', id: 'first-contact', clean: true }]);
    expect(game.run('first-contact', true)!.award).toBeUndefined();
  });

  it('keeps the script after a win and after a loss, and a loss sends the player back to it', () => {
    const { game } = setup();
    game.run('first-contact');
    game.setScript('turn_left()');
    expect(game.run('one-more-line')!.won).toBe(false);
    expect(game.script()).toBe('turn_left()');
    expect(game.progress().misses['one-more-line']).toBe(1);
    expect(game.history().at(-1)!.result).toBe('lost');
  });

  it('refuses a locked step', () => {
    expect(setup().game.run('training-dummy')).toBeUndefined();
  });

  it('reports problems before the fight', () => {
    const { game } = setup();
    game.setScript('foward()\nfire()');
    const r = game.run('first-contact')!;
    expect(r.error?.code).toBe('unknown-name');
    expect(game.history().at(-1)!.result).toBe('error');
  });

  it('restores an old version', () => {
    const { game } = setup();
    game.run('first-contact');
    game.setScript('x = 1');
    expect(game.restore(0)).toBe(true);
    expect(game.script()).toBe(STARTER_SCRIPT);
  });

  it('lets the player equip any part at any time, only slots and duplicates are refused', () => {
    const { game } = setup();
    expect(game.level()).toBe(0);
    expect(game.setBuild({ chassis: 'light', locomotion: 'legs', gear: ['cannon', 'eyes'], addons: [], blasterMark: 1 })).toBe(true);
    expect(game.setBuild({ chassis: 'light', locomotion: 'treads', gear: ['hammer', 'shield'], addons: [], blasterMark: 1 })).toBe(true);
    expect(game.setBuild({ chassis: 'medium', locomotion: 'wheels', gear: ['blaster', 'gps', 'plates'], addons: [], blasterMark: 2 })).toBe(true);
    expect(game.build().blasterMark).toBe(2);
    expect(game.setBuild({ chassis: 'light', locomotion: 'wheels', gear: ['cannon', 'eyes', 'blaster'], addons: [], blasterMark: 1 })).toBe(false);
    expect(game.setBuild({ chassis: 'medium', locomotion: 'wheels', gear: ['eyes', 'eyes'], addons: [], blasterMark: 1 })).toBe(false);
    // The eyes' wide-angle and scanner add-ons come with the eyes.
    game.setBuild({ chassis: 'light', locomotion: 'wheels', gear: ['eyes'], addons: [], blasterMark: 1 });
    expect(game.build().addons).toEqual(['wide', 'scanner']);
  });

  it('keeps ONE script: winning, moving on and opening the next challenge never changes it', () => {
    const { game } = setup();
    const mine = 'forward()\nfire()\n# my own note\nprint("x")';
    game.setScript(mine);
    game.run('first-contact');
    expect(game.script()).toBe(mine);
    game.open('one-more-line');
    expect(game.script()).toBe(mine);
    game.run('one-more-line');
    expect(game.script()).toBe(mine);
  });

  it('an old save with removed challenge ids does not crash and keeps its script and build', () => {
    const old = { script: 'forward()\nfire()\nfire()', build: { chassis: 'medium', locomotion: 'wheels', gear: ['blaster', 'eyes'], addons: [], blasterMark: 1 }, solved: ['first-contact', 'backstep-dummy', 'gl-foward', 'cn-row-3', 'one-more-line'], stars: { 'gl-foward': 3, 'one-more-line': 2 }, misses: { 'cn-row-3': 4 }, current: 'gl-foward', history: [{ at: 1, script: 'x', step: 'gl-foward', result: 'won' }] };
    const kv = new MemoryKeyValue();
    const storage = new AppStorage(kv, CONTENT);
    storage.setGameData(old, 'robot');
    const game = new RobotGame(storage);
    const p = game.progress();
    expect(p.script).toBe(old.script);
    expect(p.solved).toEqual(['first-contact', 'one-more-line']);
    expect(p.current).toBeUndefined();
    expect(game.open().id).toBe('training-dummy');
    expect(game.stats().done).toBe(2);
    expect(game.script()).toBe(old.script);
  });

  it('ignores steps of removed task types in old saves', () => {
    const p = parseProgress({ script: 'x', solved: ['ws-step', 'first-contact'], stars: { 'ws-step': 2 } }, buildSteps());
    expect(p.solved).toEqual(['first-contact']);
    expect(p.stars).toEqual({});
  });

  it('reads damaged progress defensively', () => {
    const steps = buildSteps();
    expect(parseProgress('junk', steps).script).toBe(STARTER_SCRIPT);
    // Old saves: the removed concept-card and hint lists are ignored.
    const old = parseProgress({ script: 'x', cards: ['ch0', 7], hints: { 'first-contact': 3 } }, steps);
    expect('cards' in old || 'hints' in old).toBe(false);
    const p = parseProgress({ script: 'x', solved: ['first-contact', 'nope'], stars: { 'first-contact': 9 }, build: { chassis: 'huge' }, runs: 2, wins: 5 }, steps);
    expect(p.solved).toEqual(['first-contact']);
    expect(p.stars).toEqual({});
    expect(p.wins).toBe(0);
    expect(p.build.chassis).toBe('light');
  });
});
