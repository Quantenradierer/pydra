/** Chrome's install prompt event (not in the DOM typings). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Keeps the browser's install prompt so Settings can offer an "Install app"
 * button. Only browsers that fire `beforeinstallprompt` get the button, so
 * it never shows on iOS or once the app is installed.
 */
export class InstallPrompt {
  private event?: BeforeInstallPromptEvent;
  private listeners = new Set<() => void>();

  constructor(target: Window) {
    target.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.event = e as BeforeInstallPromptEvent;
      this.changed();
    });
    target.addEventListener('appinstalled', () => {
      this.event = undefined;
      this.changed();
    });
  }

  get available(): boolean {
    return this.event !== undefined;
  }

  /** Calls the listener when availability changes; returns an unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async prompt() {
    const event = this.event;
    if (!event) return;
    // A prompt event can be used only once.
    this.event = undefined;
    await event.prompt();
    await event.userChoice;
    this.changed();
  }

  private changed() {
    for (const listener of this.listeners) listener();
  }
}
