import { describe, expect, it } from 'vitest';
import { CONTENT } from '../content/lessons.ts';
import { AppStorage, MemoryKeyValue } from '../storage.ts';
import type { PointsEvent } from '../points/state.ts';
import { ENEMIES } from './content/index.ts';
import { CHALLENGES } from './content/challenges.ts';
import { buildSteps, isUnlocked, parseProgress, RobotGame, STARTER_SCRIPT } from './game.ts';

function setup() {
  const kv = new MemoryKeyValue();
  const events: PointsEvent[] = [];
  const game = new RobotGame(new AppStorage(kv, CONTENT), ENEMIES, CHALLENGES, (e) => events.push(e), () => 1000);
  return { kv, game, events };
}

describe('steps', () => {
  const steps = buildSteps();

  it('are all enemies and challenges in order, each challenge after its enemy', () => {
    expect(steps.filter((s) => s.kind === 'battle')).toHaveLength(ENEMIES.length);
    expect(steps.filter((s) => s.kind !== 'battle')).toHaveLength(CHALLENGES.length);
    for (const s of steps.filter((x) => x.challenge)) expect(steps.findIndex((x) => x.id === s.challenge!.after)).toBeLessThan(steps.indexOf(s));
  });

  it('unlock one battle at a time; side missions and challenges never block', () => {
    expect(isUnlocked(steps[0]!, [], steps)).toBe(true);
    expect(isUnlocked(steps.find((s) => s.id === 'one-more-line')!, [], steps)).toBe(false);
    expect(isUnlocked(steps.find((s) => s.id === 'one-more-line')!, ['first-contact'], steps)).toBe(true);
    expect(isUnlocked(steps.find((s) => s.id === 'gl-foward')!, ['first-contact'], steps)).toBe(false);
    expect(isUnlocked(steps.find((s) => s.id === 'gl-foward')!, ['first-contact', 'one-more-line'], steps)).toBe(true);
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

  it('re-tests earlier enemies: a win that breaks an old one does not count', () => {
    const hello = ENEMIES.find((e) => e.id === 'hello-robot')!;
    const far = { ...ENEMIES.find((e) => e.id === 'far-dummy')!, needs: undefined };
    const game = new RobotGame(new AppStorage(new MemoryKeyValue(), CONTENT), [hello, far], []);
    game.setScript(hello.solution);
    expect(game.run('hello-robot')!.won).toBe(true);
    // Beats the far dummy but no longer says hello: Hello Robot would be lost again.
    game.setScript('forward(4)\nfire()\nfire()');
    const r = game.run('far-dummy')!;
    expect(r.report!.won).toBe(true);
    expect(r).toMatchObject({ won: false, broken: ['hello-robot'] });
    expect(game.progress().solved).toEqual(['hello-robot']);
    game.setScript(far.solution);
    expect(game.run('far-dummy')).toMatchObject({ won: true, broken: [] });
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

  it('plays a challenge as a fight and pays it once', () => {
    const { game, events } = setup();
    game.run('first-contact');
    game.setScript(ENEMIES[1]!.solution);
    game.run('one-more-line');
    const step = game.step('gl-foward')!;
    expect(step.enemy?.regression).toBe(false);
    game.setScript('foward()\nfire()\nfire()');
    expect(game.run('gl-foward')?.error).toBeDefined();
    game.setScript(ENEMIES[1]!.solution);
    expect(game.run('gl-foward')?.firstWin).toBe(true);
    expect(game.run('gl-foward')?.firstWin).toBe(false);
    expect(events.filter((e) => e.type === 'level' && e.id === 'gl-foward')).toEqual([{ type: 'level', game: 'robot', id: 'gl-foward', clean: false }]);
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
