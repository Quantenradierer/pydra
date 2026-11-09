import { describe, expect, it } from 'vitest';
import { CONTENT } from '../content/lessons.ts';
import { AppStorage, MemoryKeyValue } from '../storage.ts';
import { ENEMIES } from './content/index.ts';
import { RobotGame } from './game.ts';
import { fightEnemy, DEFAULT_BUILD } from './fight.ts';
import { dailySeed, today, trainingFight } from './training.ts';

describe('Training Grounds', () => {
  for (const level of [2, 3, 4]) {
    it(`generates fights at level ${level} that their own script wins, for 60 seeds`, () => {
      for (let seed = 1; seed <= 60; seed++) {
        const f = trainingFight(seed, level);
        const r = fightEnemy(f.enemy, DEFAULT_BUILD, f.solution);
        expect(r.won, `seed ${seed}: ${JSON.stringify([r.fight.battle.reason, r.fight.battle.error?.message])}`).toBe(true);
      }
    });
  }
  it('is deterministic per seed and varies between seeds', () => {
    expect(trainingFight(5, 3)).toEqual(trainingFight(5, 3));
    const maps = new Set(Array.from({ length: 30 }, (_, i) => trainingFight(i + 1, 3).enemy.map.join('/')));
    expect(maps.size).toBeGreaterThan(5);
  });
  it('is not won by an empty script', () => {
    for (let seed = 1; seed <= 20; seed++) for (const level of [2, 3, 4]) {
      const f = trainingFight(seed, level);
      expect(fightEnemy(f.enemy, DEFAULT_BUILD, 'wait()').won).toBe(false);
    }
  });
  it('has one daily seed per date', () => {
    expect(dailySeed('2026-11-08')).toBe(dailySeed('2026-11-08'));
    expect(dailySeed('2026-11-08')).not.toBe(dailySeed('2026-11-09'));
    expect(today(new Date(2026, 10, 8, 23, 30).getTime())).toBe('2026-11-08');
  });
});

describe('RobotGame training', () => {
  const game = () => new RobotGame(new AppStorage(new MemoryKeyValue(), CONTENT), ENEMIES, () => {}, () => new Date(2026, 10, 8, 12).getTime());
  it('opens with Chapter 2 and counts wins; the daily fight once per day', () => {
    const g = game();
    expect(g.canTrain()).toBe(false);
    const kv = new MemoryKeyValue();
    const storage = new AppStorage(kv, CONTENT);
    storage.setGameData({ solved: ENEMIES.filter((e) => e.chapter < 2).map((e) => e.id) }, 'robot');
    const g2 = new RobotGame(storage, ENEMIES, () => {}, () => new Date(2026, 10, 8, 12).getTime());
    expect(g2.canTrain()).toBe(true);
    const step = g2.trainingStep('daily');
    expect(step.id).toBe('training-daily-2026-11-08');
    expect(g2.runTraining(step)!.won).toBe(false);
    g2.setScript(trainingFight(dailySeed('2026-11-08'), 2).solution);
    expect(g2.runTraining(step)!.won).toBe(true);
    expect(g2.trainingStats()).toEqual({ wins: 1, dailyDone: true });
    expect(g2.nextTrainingSeed()).toBe(1);
    expect(g2.nextTrainingSeed()).toBe(2);
  });
});
