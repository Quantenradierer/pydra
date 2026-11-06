import type { Rng } from '../session.ts';
import type { PointsEvent } from '../points/state.ts';
import type { AppStorage } from '../storage.ts';
import { LEVELS, type GameLevel } from './levels.ts';
import type { PuzzleLevel } from './puzzle.ts';
import { levelToShow, openLevel, parseGameProgress, pick, type GameProgress, type LevelState } from './progress.ts';

/** Where a hydra game keeps its progress in storage. */
export type GameKey = 'game' | 'hunt';

/** A hydra game on top of storage: every change is saved straight away. */
export class Game<L extends PuzzleLevel = GameLevel> {
  private storage: AppStorage;
  readonly levels: readonly L[];
  private rng: Rng;
  private key: GameKey;
  private onPoints: (event: PointsEvent) => void;

  constructor(
    storage: AppStorage,
    levels: readonly L[],
    rng: Rng = Math.random,
    key: GameKey = 'game',
    onPoints: (event: PointsEvent) => void = () => {},
  ) {
    this.storage = storage;
    this.levels = levels;
    this.rng = rng;
    this.key = key;
    this.onPoints = onPoints;
  }

  /** The fishing game. */
  static fishing(storage: AppStorage, rng?: Rng, onPoints?: (event: PointsEvent) => void): Game<GameLevel> {
    return new Game(storage, LEVELS, rng, 'game', onPoints);
  }

  progress(): GameProgress {
    return parseGameProgress(this.storage.gameData(this.key), this.levels);
  }

  private save(progress: GameProgress): GameProgress {
    this.storage.setGameData(progress, this.key);
    return progress;
  }

  /** The level to play and its state; opens it if needed (or the level with the given id). */
  open(id?: string): { level: L; state: LevelState } {
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
    const next = this.save(pick(progress, level, slot));
    if (next.solved.length > progress.solved.length) {
      this.onPoints({ type: 'level', game: this.key, id: level.id, clean: progress.current!.tried.length === 0 });
    }
    return next.current;
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
