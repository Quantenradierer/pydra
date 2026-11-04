import type { Rng } from '../session.ts';
import type { AppStorage } from '../storage.ts';
import { LEVELS, type GameLevel } from './levels.ts';
import { levelToShow, openLevel, parseGameProgress, pick, type GameProgress, type LevelState } from './progress.ts';

/** The hydra game on top of storage: every change is saved straight away. */
export class Game {
  private storage: AppStorage;
  readonly levels: readonly GameLevel[];
  private rng: Rng;

  constructor(storage: AppStorage, levels: readonly GameLevel[] = LEVELS, rng: Rng = Math.random) {
    this.storage = storage;
    this.levels = levels;
    this.rng = rng;
  }

  progress(): GameProgress {
    return parseGameProgress(this.storage.gameData(), this.levels);
  }

  private save(progress: GameProgress): GameProgress {
    this.storage.setGameData(progress);
    return progress;
  }

  /** The level to play and its state; opens it if needed (or the level with the given id). */
  open(id?: string): { level: GameLevel; state: LevelState } {
    const progress = this.progress();
    const level = this.levels.find((l) => l.id === id) ?? levelToShow(progress, this.levels);
    const next = openLevel(progress, level, this.rng);
    if (next !== progress) this.save(next);
    return { level, state: next.current! };
  }

  /** Picks the choice in a slot of the current level; returns the new state. */
  pick(slot: number): LevelState | undefined {
    const progress = this.progress();
    const level = this.levels.find((l) => l.id === progress.current?.level);
    if (!level) return undefined;
    return this.save(pick(progress, level, slot)).current;
  }

  /** Levels solved, how many there are, and the share of right picks in whole percent. */
  stats(): { done: number; total: number; picks: number; percent: number } {
    const { solved, picks, correctPicks } = this.progress();
    return {
      done: solved.length,
      total: this.levels.length,
      picks,
      percent: picks === 0 ? 0 : Math.round((100 * correctPicks) / picks),
    };
  }
}
