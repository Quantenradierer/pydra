import { describe, expect, it } from 'vitest';
import { buildProblem, START_BUILD, type Build } from './build.ts';
import { precheck, runBattle } from './battle.ts';

const plated: Build = { ...START_BUILD, chassis: 'medium', gear: ['eyes', 'plates'] };
const shooter = 'while True:\n    fire()';
const layout = (maxTicks: number) => ({ map: ['..D..', '.....', '.....', '..^..'], enemies: [{ hp: 3, script: shooter }], seed: 1, maxTicks });

describe('armor plates', () => {
  it('are free to equip from the start', () => {
    expect(buildProblem(plated)).toBeUndefined();
    expect(buildProblem({ ...plated, chassis: 'light' })).toBeUndefined();
  });

  it('take 1 damage off every hit until the integrity is gone', () => {
    const r = runBattle({ build: plated, script: 'plates.integrity()\nwait()\nwait()\nwait()\nwait()\nwait()\nwait()\nwait()', layout: layout(8) });
    // five hits are absorbed completely (20 integrity each), the remaining three land
    expect(r.damageTaken).toBe(3);
    const bare = runBattle({ build: { ...plated, gear: ['eyes'] }, script: 'wait()', layout: layout(8) });
    expect(bare.damageTaken).toBe(8);
  });

  it('report their integrity and are friendly when missing', () => {
    const r = runBattle({ build: plated, script: 'print(plates.integrity())\nwait()\nwait()\nprint(plates.integrity())', layout: layout(3) });
    const said = r.frames.flatMap((f) => f.bubbles.map((b) => b.text));
    expect(said).toEqual(['100', '60']);
    expect(precheck({ ...plated, gear: ['eyes'] }, 'print(plates.integrity())')).toBeDefined();
  });
});
