import { describe, expect, it } from 'vitest';
import { buildProblem, STAR_GATE, START_BUILD, type Build } from './build.ts';
import { precheck, runBattle } from './battle.ts';

const plated: Build = { ...START_BUILD, chassis: 'medium', gear: ['eyes', 'plates'] };
const shooter = 'while True:\n    fire()';
const layout = (maxTicks: number) => ({ map: ['..D..', '.....', '.....', '..^..'], enemies: [{ hp: 3, script: shooter }], seed: 1, maxTicks });

describe('armor plates', () => {
  it('are earned with stars, not with a chapter', () => {
    expect(buildProblem(plated, 99, 0)).toBe('locked');
    expect(buildProblem({ ...plated, chassis: 'light' }, 0, STAR_GATE.plates)).toBeUndefined();
  });

  it('take 1 damage off every hit until the integrity is gone', () => {
    const r = runBattle({ build: plated, script: 'plates.integrity()\nwait()\nwait()\nwait()\nwait()\nwait()\nwait()\nwait()', layout: layout(8) });
    // five hits are absorbed completely (20 integrity each), the remaining three land
    expect(r.damageTaken).toBe(3);
    const bare = runBattle({ build: { ...plated, gear: ['eyes'] }, script: 'wait()', layout: layout(8) });
    expect(bare.damageTaken).toBe(8);
  });

  it('report their integrity and are friendly when missing', () => {
    const r = runBattle({ build: plated, script: 'say(plates.integrity())\nwait()\nwait()\nsay(plates.integrity())', layout: layout(3) });
    const said = r.frames.flatMap((f) => f.bubbles.map((b) => b.text));
    expect(said).toEqual(['100', '60']);
    expect(precheck({ ...plated, gear: ['eyes'] }, 'say(plates.integrity())')).toBeDefined();
  });
});

describe('RobotGame and stars', () => {
  it('opens the plates in the builder from 12 stars', async () => {
    const { AppStorage, MemoryKeyValue } = await import('../storage.ts');
    const { CONTENT } = await import('../content/lessons.ts');
    const { RobotGame } = await import('./game.ts');
    const storage = new AppStorage(new MemoryKeyValue(), CONTENT);
    const game = new RobotGame(storage);
    expect(game.can('gear', 'plates')).toBe(false);
    storage.setGameData({ solved: ['first-contact'], stars: { 'first-contact': 3, 'one-more-line': 3, 'training-dummy': 3, 'corner-dummy': 3 } }, 'robot');
    expect(game.can('gear', 'plates')).toBe(true);
    expect(game.setBuild({ ...START_BUILD, gear: ['eyes', 'plates'] })).toBe(true);
  });
});
