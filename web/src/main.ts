import { registerSW } from 'virtual:pwa-register';
import { App, GAME_ROUTES } from './app.ts';
import { CONTENT } from './content/lessons.ts';
import { DailyChallenge } from './daily/challenge.ts';
import { FeedbackQueue } from './feedback/queue.ts';
import { Game } from './game/game.ts';
import { HUNT_LEVELS, type HuntLevel } from './game/hunt-levels.ts';
import { OrderGame } from './game/order.ts';
import { PredictGame } from './game/predict.ts';
import { RobotGame } from './robot/game.ts';
import { FactoryGame } from './factory/game.ts';
import { InstallPrompt } from './install.ts';
import { PointsService } from './points/service.ts';
import { XP_GAMES, type PointsEvent, type XpGame } from './points/state.ts';
import { AppStorage } from './storage.ts';
import { Trainer } from './trainer.ts';
import { UpdateManager, watchForUpdates } from './update.ts';
import './style.css';
import './robot/art/robot-art.css';
import './robot-work.css';
import './factory.css';

const storage = new AppStorage(localStorage, CONTENT);

// The games by key; assigned below, read lazily by the points.
let games: { game: Game; hunt: Game<HuntLevel>; order: OrderGame; predict: PredictGame; robot: RobotGame; factory: FactoryGame };

const byGame = <T>(fn: (key: XpGame) => T) => Object.fromEntries(XP_GAMES.map((key) => [key, fn(key)])) as Record<XpGame, T>;

// Points: the games and the quiz report to it; it reads the games back lazily (they are built below).
const points: PointsService = new PointsService(
  storage,
  () => ({
    totals: byGame((key) => games[key].stats().total),
    remaining: byGame((key) => games[key].stats().total - games[key].stats().done),
  }),
  () => [
    ...Object.entries(storage.questionStats()).filter(([, s]) => s.correct > 0).map(([id]) => `q:${id}`),
    ...XP_GAMES.flatMap((key) => games[key].progress().solved.map((id) => `l:${key}:${id}`)),
  ],
);
const onPoints = (event: PointsEvent): void => points.record(event);

const trainer = new Trainer(storage, CONTENT, Math.random, () => new Date(), onPoints);
const daily = new DailyChallenge(storage, undefined, () => new Date(), Math.random, onPoints);
const game = Game.fishing(storage, Math.random, onPoints);
const hunt = new Game(storage, HUNT_LEVELS, Math.random, 'hunt', onPoints);
const order = new OrderGame(storage, undefined, onPoints);
const predict = new PredictGame(storage, undefined, onPoints);
const robot = new RobotGame(storage, undefined, onPoints);
const factory = new FactoryGame(storage, onPoints);
games = { game, hunt, order, predict, robot, factory };
const feedback = new FeedbackQueue(storage);
const install = new InstallPrompt(window);

// A new version reloads the app at once, or when the running quiz or a hydra game is left.
const updates = new UpdateManager(
  () => trainer.isRunning() || location.hash === '#/daily' || GAME_ROUTES.some((route) => location.hash === `#/${route}`),
  () => void updateSW(true),
);
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh: () => updates.updateFound(),
  onRegisteredSW(_url, registration) {
    if (registration) watchForUpdates(registration);
  },
});

new App(document.getElementById('app')!, { storage, trainer, daily, game, hunt, order, predict, robot, factory, points, feedback, install, updates }).start();

// Deliver feedback written while offline.
const flushFeedback = () => void feedback.flush();
flushFeedback();
addEventListener('online', flushFeedback);
