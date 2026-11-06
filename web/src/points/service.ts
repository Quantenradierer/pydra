import type { AppStorage } from '../storage.ts';
import { applyEvent, backfill, rollDay, type PointsResult } from './engine.ts';
import { dayKey, emptyPoints, type PointsEvent, type PointsState } from './state.ts';
import type { GameContext } from './tasks.ts';

/** The point system on top of storage: every event is saved straight away. */
export class PointsService {
  private listeners = new Set<(result: PointsResult) => void>();

  /**
   * @param context the games' level counts (read lazily: the games are built after this)
   * @param legacy ids ("q:…", "l:…") solved before points existed, credited once
   */
  constructor(
    private storage: AppStorage,
    private context: () => GameContext,
    private legacy: () => string[] = () => [],
    private now: () => Date = () => new Date(),
  ) {}

  /** The current state, with today's tasks. The first call credits earlier progress. */
  state(): PointsState {
    let state = this.storage.points();
    if (!state) {
      state = backfill(emptyPoints(), this.legacy(), this.now(), this.context());
      this.storage.setPoints(state);
    }
    const rolled = rollDay(state, dayKey(this.now()), this.context());
    if (rolled !== state) this.storage.setPoints(rolled);
    return rolled;
  }

  record(event: PointsEvent) {
    const { state, result } = applyEvent(this.state(), event, this.now(), this.context());
    this.storage.setPoints(state);
    if (result.gained > 0 || result.achievements.length > 0) for (const listener of this.listeners) listener(result);
  }

  /** Calls the listener after every event that changed something; returns the unsubscribe function. */
  subscribe(listener: (result: PointsResult) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
