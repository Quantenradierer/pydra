import { registerSW } from 'virtual:pwa-register';
import { App } from './app.ts';
import { CONTENT } from './content/lessons.ts';
import { FeedbackQueue } from './feedback/queue.ts';
import { Game } from './game/game.ts';
import { HEADS_LEVELS } from './game/heads-levels.ts';
import { InstallPrompt } from './install.ts';
import { AppStorage } from './storage.ts';
import { Trainer } from './trainer.ts';
import { UpdateManager, watchForUpdates } from './update.ts';
import './style.css';

const storage = new AppStorage(localStorage, CONTENT);
const trainer = new Trainer(storage, CONTENT);
const game = Game.fishing(storage);
const heads = new Game(storage, HEADS_LEVELS, Math.random, 'heads');
const feedback = new FeedbackQueue(storage);
const install = new InstallPrompt(window);

// A new version reloads the app at once, or when the running quiz or a hydra game is left.
const updates = new UpdateManager(
  () => trainer.isRunning() || location.hash === '#/game' || location.hash === '#/heads',
  () => void updateSW(true),
);
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh: () => updates.updateFound(),
  onRegisteredSW(_url, registration) {
    if (registration) watchForUpdates(registration);
  },
});

new App(document.getElementById('app')!, { storage, trainer, game, heads, feedback, install, updates }).start();

// Deliver feedback written while offline.
const flushFeedback = () => void feedback.flush();
flushFeedback();
addEventListener('online', flushFeedback);
