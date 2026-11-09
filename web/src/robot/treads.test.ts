import { describe, expect, it } from 'vitest';
import { buildProblem, parseBuild, START_BUILD, type Build } from './build.ts';
import { precheck, runBattle } from './battle.ts';

const treads: Build = { ...START_BUILD, chassis: 'medium', locomotion: 'treads' };
const layout = (map: string[], hp = 3, script?: string, maxTicks?: number) => ({ map, enemies: [{ hp, ...(script ? { script, gear: ['blaster', 'eyes'] } : {}) }], seed: 1, ...(maxTicks ? { maxTicks } : {}) });
const player = (r: ReturnType<typeof runBattle>, i = -1) => r.frames.at(i)!.robots.find((x) => x.id === 'player')!;

describe('treads', () => {
  it('are free to equip and survive a build round trip', () => {
    expect(buildProblem(treads)).toBeUndefined();
    expect(parseBuild(JSON.parse(JSON.stringify(treads)))).toEqual(treads);
  });

  it('drive like wheels, cross rubble, and a turn takes two ticks', () => {
    const r = runBattle({ build: treads, script: 'forward()\nturn_right()\nforward()', layout: layout(['.....', '.D...', '.....', '.~...', '.^...'], 1) });
    expect(r.frames[1]!.robots.find((x) => x.id === 'player')!.pos).toEqual({ x: 1, y: 3 }); // over the rubble
    expect(r.frames[2]!.robots.find((x) => x.id === 'player')!.facing).toBe('N'); // the first tick of the turn is lost
    expect(r.frames[3]!.robots.find((x) => x.id === 'player')!.facing).toBe('E');
    expect(r.frames[4]!.robots.find((x) => x.id === 'player')!.pos).toEqual({ x: 2, y: 3 });
  });

  it('give +3 armor: a blaster shot does nothing', () => {
    const shooter = 'while True:\n    fire()';
    const wheels = runBattle({ build: { ...treads, locomotion: 'wheels' }, script: 'wait()\nwait()\nwait()', layout: layout(['..D..', '.....', '.....', '..^..'], 3, shooter, 3) });
    const armored = runBattle({ build: treads, script: 'wait()\nwait()\nwait()', layout: layout(['..D..', '.....', '.....', '..^..'], 3, shooter, 3) });
    expect(wheels.damageTaken).toBe(3);
    expect(armored.damageTaken).toBe(0);
  });

  it('push() steps forward and shoves the robot in front one tile further', () => {
    const r = runBattle({ build: treads, script: 'push()\npush()', layout: layout(['.....', '..D..', '.....', '..^..'], 5) });
    const dummy = r.frames.at(-1)!.robots.find((x) => x.id === 'enemy1')!;
    expect(dummy.pos).toEqual({ x: 2, y: 0 });
    expect(player(r).pos).toEqual({ x: 2, y: 1 }); // the first push steps up to it, the second shoves it and follows
  });

  it('are not equipped on wheels: push() gets a friendly message', () => {
    expect(precheck({ ...treads, locomotion: 'wheels' }, 'push()')).toBeDefined();
    expect(precheck(treads, 'push()')).toBeUndefined();
  });
});
