import { describe, expect, it } from 'vitest';
import { buildProblem, GEAR, START_BUILD, type Build, type GearId } from './build.ts';
import { ENEMIES } from './content/index.ts';
import { DEFAULT_BUILD, fightEnemy } from './fight.ts';
import { precheck } from './battle.ts';
import { RobotGame } from './game.ts';
import { AppStorage, MemoryKeyValue } from '../storage.ts';
import { CONTENT } from '../content/lessons.ts';
import { UI_DE, UI_EN } from './messages-ui.ts';

/**
 * Gear is free: any part can be equipped at any time, and no battle or challenge needs one specific part.
 * Every reference solution must win with the starting robot (light chassis, wheels, blaster and eyes), and the
 * same script must still win when other parts are added.
 */
const chapters = [...new Set(ENEMIES.map((e) => e.chapter))];
const label = (c: number) => (c === 25 ? 'Practice Field I' : c === 45 ? 'Exams' : `Chapter ${c}`);

describe('default gear', () => {
  it('is the blaster and eyes on wheels', () => {
    expect(DEFAULT_BUILD).toEqual(START_BUILD);
    expect(START_BUILD).toMatchObject({ chassis: 'light', locomotion: 'wheels', gear: ['blaster', 'eyes'] });
  });

  for (const c of chapters) {
    it(`${label(c)}: every reference solution wins with the default gear (and passes the pre-battle check)`, () => {
      for (const e of ENEMIES.filter((x) => x.chapter === c)) {
        expect(precheck(DEFAULT_BUILD, e.solution), `${e.id} precheck`).toBeUndefined();
        const r = fightEnemy(e, DEFAULT_BUILD, e.solution);
        expect(r.won, `${e.id}: ${JSON.stringify([r.fight.battle.reason, r.fight.unmet])}`).toBe(true);
      }
    });
  }
});

const others = GEAR.filter((g) => !START_BUILD.gear.includes(g));
const variants: [string, Build][] = [
  ['medium chassis', { ...START_BUILD, chassis: 'medium' }],
  ...others.map((g): [string, Build] => [`blaster, eyes and ${g}`, { ...START_BUILD, chassis: 'medium', gear: ['blaster', 'eyes', g as GearId] }]),
];

describe('other gear', () => {
  for (const [name, build] of variants) {
    it(`the same solutions still win with ${name}`, () => {
      expect(buildProblem(build)).toBeUndefined();
      for (const e of ENEMIES) {
        const r = fightEnemy(e, build, e.solution);
        expect(r.won, `${e.id} with ${name}: ${JSON.stringify([r.fight.battle.reason, r.fight.unmet, r.fight.battle.error?.message])}`).toBe(true);
      }
    });
  }

  it('the burst blaster (Mk II) is a different tool, not a drop-in: it still wins where it does not overheat', () => {
    const mk2: Build = { ...START_BUILD, chassis: 'medium', blasterMark: 2 };
    for (const id of ['first-contact', 'one-more-line', 'training-dummy', 'hello-robot', 'far-dummy']) {
      const e = ENEMIES.find((x) => x.id === id)!;
      expect(fightEnemy(e, mk2, e.solution).won, id).toBe(true);
    }
  });

  it('the builder never refuses a part for being "locked": any chassis, drive and gear at the very start', () => {
    const game = new RobotGame(new AppStorage(new MemoryKeyValue(), CONTENT));
    expect(game.level()).toBe(0);
    for (const chassis of ['light', 'medium'] as const)
      for (const locomotion of ['wheels', 'legs', 'treads'] as const)
        for (const g of GEAR) expect(game.setBuild({ ...START_BUILD, chassis, locomotion, gear: [g] }), `${chassis}/${locomotion}/${g}`).toBe(true);
  });
});

describe('gear labels', () => {
  it('promise no lock: all gear is free, so no label says "from n stars"', () => {
    for (const [key, de] of Object.entries(UI_DE)) {
      if (!key.startsWith('robot.gear.')) continue;
      expect(de, key).not.toMatch(/Stern/);
      expect(UI_EN[key as keyof typeof UI_DE], key).not.toMatch(/star/i);
    }
  });
});
