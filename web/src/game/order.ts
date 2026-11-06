import type { PointsEvent } from '../points/state.ts';
import type { AppStorage } from '../storage.ts';
import { ORDER_LEVELS, type OrderLevel } from './order-levels.ts';

/** Everything "Code puzzle" saves. */
export interface OrderProgress {
  /** Ids of the levels solved at least once. */
  solved: string[];
  /** Every run of a program, and the ones that solved their level: the stats on Home. */
  runs: number;
  wins: number;
  /** The level being played and how its lines are arranged right now. */
  current?: { level: string; order: number[] };
}

export const EMPTY_ORDER_PROGRESS: OrderProgress = { solved: [], runs: 0, wins: 0 };

const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

/** Whether `order` holds every line index of the level exactly once. */
export function isArrangement(level: OrderLevel, order: unknown): order is number[] {
  if (!Array.isArray(order) || order.length !== level.lines.length) return false;
  return order.every((i) => Number.isInteger(i) && i >= 0 && i < level.lines.length) && new Set(order).size === order.length;
}

/** Reads saved progress defensively: unknown levels and malformed parts are dropped. */
export function parseOrderProgress(raw: unknown, levels: readonly OrderLevel[]): OrderProgress {
  if (typeof raw !== 'object' || raw === null) return EMPTY_ORDER_PROGRESS;
  const r = raw as Record<string, unknown>;
  if (!isCount(r.runs) || !isCount(r.wins) || r.wins > r.runs) return EMPTY_ORDER_PROGRESS;
  const ids = new Set(levels.map((l) => l.id));
  const solved = Array.isArray(r.solved) ? [...new Set(r.solved.filter((id): id is string => ids.has(id as string)))] : [];
  const progress: OrderProgress = { solved, runs: r.runs, wins: r.wins };
  const current = r.current as Record<string, unknown> | undefined;
  const level = levels.find((l) => l.id === current?.level);
  if (level && isArrangement(level, current?.order)) progress.current = { level: level.id, order: [...current.order] };
  return progress;
}

/** Levels that can be opened: every solved one and the first unsolved one. */
export function unlockedOrder(progress: OrderProgress, levels: readonly OrderLevel[]): boolean[] {
  const firstOpen = levels.findIndex((l) => !progress.solved.includes(l.id));
  return levels.map((l, i) => progress.solved.includes(l.id) || i === firstOpen);
}

/** "Code puzzle" on top of storage: every change is saved straight away. */
export class OrderGame {
  private storage: AppStorage;
  readonly levels: readonly OrderLevel[];
  private onPoints: (event: PointsEvent) => void;

  constructor(
    storage: AppStorage,
    levels: readonly OrderLevel[] = ORDER_LEVELS,
    onPoints: (event: PointsEvent) => void = () => {},
  ) {
    this.storage = storage;
    this.levels = levels;
    this.onPoints = onPoints;
  }

  progress(): OrderProgress {
    return parseOrderProgress(this.storage.gameData('order'), this.levels);
  }

  private save(progress: OrderProgress) {
    this.storage.setGameData(progress, 'order');
  }

  /**
   * The level to play (the given one, else the one in progress, else the
   * first unsolved, else the first) and its lines' order. A level opened
   * anew starts from its shuffled order.
   */
  open(id?: string): { level: OrderLevel; order: number[] } {
    const progress = this.progress();
    const level =
      this.levels.find((l) => l.id === id) ??
      this.levels.find((l) => l.id === progress.current?.level) ??
      this.levels.find((l) => !progress.solved.includes(l.id)) ??
      this.levels[0]!;
    if (progress.current?.level === level.id) return { level, order: progress.current.order };
    const order = [...level.start];
    this.save({ ...progress, current: { level: level.id, order } });
    return { level, order };
  }

  /** Keeps the current arrangement of the open level. */
  arrange(order: number[]) {
    const progress = this.progress();
    const level = this.levels.find((l) => l.id === progress.current?.level);
    if (!level || !isArrangement(level, order)) return;
    this.save({ ...progress, current: { level: level.id, order: [...order] } });
  }

  /** Counts a run of the open level; a successful one solves it. */
  ran(success: boolean) {
    const progress = this.progress();
    const id = progress.current?.level;
    if (!id) return;
    const solved = success && !progress.solved.includes(id) ? [...progress.solved, id] : progress.solved;
    this.save({ ...progress, solved, runs: progress.runs + 1, wins: progress.wins + (success ? 1 : 0) });
    if (solved !== progress.solved) this.onPoints({ type: 'level', game: 'order', id, clean: false });
  }

  /** Levels solved, how many there are, and the runs so far. */
  stats(): { done: number; total: number; runs: number } {
    const { solved, runs } = this.progress();
    return { done: solved.length, total: this.levels.length, runs };
  }
}
