export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Applies a new app version (a reload) as soon as one is found, unless a
 * quiz is running: then the update waits until the quiz ends.
 */
export class UpdateManager {
  private pending = false;

  constructor(
    private isQuizRunning: () => boolean,
    private apply: () => void,
  ) {}

  /** A new service worker is waiting. */
  updateFound() {
    if (this.isQuizRunning()) this.pending = true;
    else this.apply();
  }

  /** Called whenever the app leaves the quiz (summary, quit, home). */
  quizEnded() {
    if (!this.pending || this.isQuizRunning()) return;
    this.pending = false;
    this.apply();
  }
}

/** Looks for a new version on launch, when the app becomes visible, and hourly. */
export function watchForUpdates(registration: Pick<ServiceWorkerRegistration, 'update'>, doc: Document = document) {
  const check = () => void registration.update().catch(() => undefined);
  check();
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'visible') check();
  });
  setInterval(check, UPDATE_CHECK_INTERVAL_MS);
}
