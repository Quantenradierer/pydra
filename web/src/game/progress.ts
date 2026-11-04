import { shuffle, type Rng } from '../session.ts';
import type { PuzzleLevel } from './puzzle.ts';

/** The level being played. */
export interface LevelState {
  level: string;
  /** order[slot] = index into level.choices shown at that slot. */
  order: number[];
  /** Wrong choices tried so far (indices into level.choices), in the order they were picked. */
  tried: number[];
  /** Whether the right choice has been picked. */
  solved: boolean;
}

/** Everything the game saves. */
export interface GameProgress {
  /** Ids of the levels solved at least once. */
  solved: string[];
  /** Every pick, and the right ones: the "% correct" on Home. */
  picks: number;
  correctPicks: number;
  current?: LevelState;
}

export const EMPTY_PROGRESS: GameProgress = { solved: [], picks: 0, correctPicks: 0 };

/** What a choice slot shows. The right answer shows only once it has been picked. */
export type ChoiceState = 'open' | 'wrong' | 'right';

export function choiceStates(level: PuzzleLevel, state: LevelState): ChoiceState[] {
  return state.order.map((choice) => {
    if (state.tried.includes(choice)) return 'wrong';
    if (state.solved && choice === level.answerIndex) return 'right';
    return 'open';
  });
}

/** Levels that can be opened: every solved one and the first unsolved one. */
export function unlocked(progress: GameProgress, levels: readonly PuzzleLevel[]): boolean[] {
  const firstOpen = levels.findIndex((l) => !progress.solved.includes(l.id));
  return levels.map((l, i) => progress.solved.includes(l.id) || i === firstOpen);
}

/** The level to show when the game opens: the one in progress, else the first unsolved, else the first. */
export function levelToShow<L extends PuzzleLevel>(progress: GameProgress, levels: readonly L[]): L {
  return (
    levels.find((l) => l.id === progress.current?.level) ?? levels.find((l) => !progress.solved.includes(l.id)) ?? levels[0]!
  );
}

/** Starts (or keeps) a level as the current one; a new start shuffles its choices. */
export function openLevel(progress: GameProgress, level: PuzzleLevel, rng: Rng = Math.random): GameProgress {
  if (progress.current?.level === level.id) return progress;
  const order = shuffle(
    level.choices.map((_, i) => i),
    rng,
  );
  return { ...progress, current: { level: level.id, order, tried: [], solved: false } };
}

/**
 * Picks the choice in a slot of the current level. Every choice can be
 * picked at any time, so players can compare the answers; the progress
 * only changes where it should:
 * - a new wrong pick is remembered as tried;
 * - the first right pick solves the level;
 * - on a level that is already solved (practice) nothing counts as a pick
 *   and nothing is un-solved: wrong choices are only marked as tried, so
 *   their outcome stays visible;
 * - picking a tried choice again, or an unknown slot, changes nothing.
 */
export function pick(progress: GameProgress, level: PuzzleLevel, slot: number): GameProgress {
  const current = progress.current;
  if (!current || current.level !== level.id) return progress;
  const choice = current.order[slot];
  if (choice === undefined) return progress;
  const correct = choice === level.answerIndex;
  const practice = progress.solved.includes(level.id);
  if (correct ? practice && current.solved : current.tried.includes(choice)) return progress;
  const next: LevelState = correct ? { ...current, solved: true } : { ...current, tried: [...current.tried, choice] };
  if (practice) return { ...progress, current: next };
  return {
    solved: correct ? [...progress.solved, level.id] : progress.solved,
    picks: progress.picks + 1,
    correctPicks: progress.correctPicks + (correct ? 1 : 0),
    current: next,
  };
}

const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

/** Reads saved progress defensively: unknown levels and malformed parts are dropped. */
export function parseGameProgress(raw: unknown, levels: readonly PuzzleLevel[]): GameProgress {
  if (typeof raw !== 'object' || raw === null) return EMPTY_PROGRESS;
  const r = raw as Record<string, unknown>;
  if (!isCount(r.picks) || !isCount(r.correctPicks) || r.correctPicks > r.picks) return EMPTY_PROGRESS;
  const ids = new Set(levels.map((l) => l.id));
  const solved = Array.isArray(r.solved) ? [...new Set(r.solved.filter((id): id is string => ids.has(id as string)))] : [];
  const progress: GameProgress = { solved, picks: r.picks, correctPicks: r.correctPicks };
  const current = parseLevelState(r.current, levels);
  return current ? { ...progress, current } : progress;
}

function parseLevelState(raw: unknown, levels: readonly PuzzleLevel[]): LevelState | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const { level: id, order, tried, solved } = raw as Record<string, unknown>;
  const level = levels.find((l) => l.id === id);
  if (!level || typeof solved !== 'boolean' || !Array.isArray(order) || !Array.isArray(tried)) return undefined;
  const n = level.choices.length;
  const isChoice = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < n;
  if (order.length !== n || !order.every(isChoice) || new Set(order).size !== n) return undefined;
  if (!tried.every(isChoice) || new Set(tried).size !== tried.length || tried.includes(level.answerIndex)) return undefined;
  return { level: level.id, order: [...order], tried: [...tried], solved };
}
