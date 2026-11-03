import { describe, expect, it, vi } from 'vitest';
import { UPDATE_CHECK_INTERVAL_MS, UpdateManager, watchForUpdates } from './update.ts';

function setup(running: boolean) {
  const state = { running, applied: 0 };
  const manager = new UpdateManager(
    () => state.running,
    () => state.applied++,
  );
  return { state, manager };
}

describe('update manager', () => {
  it('reloads immediately outside a quiz', () => {
    const { state, manager } = setup(false);
    manager.updateFound();
    expect(state.applied).toBe(1);
  });

  it('defers the reload while a quiz is running and applies it when the quiz ends', () => {
    const { state, manager } = setup(true);
    manager.updateFound();
    expect(state.applied).toBe(0);
    manager.quizEnded(); // still running, e.g. navigation inside the quiz
    expect(state.applied).toBe(0);
    state.running = false;
    manager.quizEnded();
    expect(state.applied).toBe(1);
    manager.quizEnded();
    expect(state.applied).toBe(1);
  });

  it('does nothing when the quiz ends without a pending update', () => {
    const { state, manager } = setup(false);
    manager.quizEnded();
    expect(state.applied).toBe(0);
  });
});

describe('update checks', () => {
  it('checks on launch, when visible again, and hourly', () => {
    vi.useFakeTimers();
    const update = vi.fn(() => Promise.resolve());
    const doc = new EventTarget() as Document & { visibilityState: string };
    watchForUpdates({ update } as unknown as ServiceWorkerRegistration, doc);
    expect(update).toHaveBeenCalledTimes(1);

    doc.visibilityState = 'hidden';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(update).toHaveBeenCalledTimes(1);
    doc.visibilityState = 'visible';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(update).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);
    expect(update).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});
