import type { FeedbackQueue } from './feedback/queue.ts';
import type { Game } from './game/game.ts';
import type { HuntLevel } from './game/hunt-levels.ts';
import type { OrderGame } from './game/order.ts';
import type { PredictGame } from './game/predict.ts';
import { h } from './dom.ts';
import { levelInfo } from './points/levels.ts';
import type { DailyTask } from './points/state.ts';
import { translate, type Lang, type MessageKey, type Params } from './i18n.ts';
import type { InstallPrompt } from './install.ts';
import type { PointsResult } from './points/engine.ts';
import type { PointsService } from './points/service.ts';
import type { AppStorage } from './storage.ts';
import type { Trainer } from './trainer.ts';
import type { UpdateManager } from './update.ts';
import { feedbackScreen } from './views/feedback.ts';
import { gameScreen } from './views/game.ts';
import { huntScreen } from './views/hunt.ts';
import { orderScreen } from './views/order.ts';
import { predictScreen } from './views/predict.ts';
import { profileScreen } from './views/profile.ts';
import { homeScreen } from './views/home.ts';
import { quizScreen } from './views/quiz.ts';
import { settingsScreen } from './views/settings.ts';
import { summaryScreen } from './views/summary.ts';

export const ROUTES = ['home', 'quiz', 'summary', 'settings', 'feedback', 'game', 'hunt', 'order', 'predict', 'profile'] as const;
export type Route = (typeof ROUTES)[number];

/** What a view renders; dispose() removes listeners when the screen is left. */
export interface Screen {
  root: HTMLElement;
  /** Element to focus after rendering; defaults to the screen's heading. */
  focus?: HTMLElement;
  dispose?: () => void;
}

export interface Services {
  storage: AppStorage;
  trainer: Trainer;
  game: Game;
  hunt: Game<HuntLevel>;
  order: OrderGame;
  predict: PredictGame;
  points: PointsService;
  feedback: FeedbackQueue;
  install: InstallPrompt;
  updates: UpdateManager;
}

const VIEWS: Record<Route, (app: App) => Screen> = {
  home: homeScreen,
  quiz: quizScreen,
  summary: summaryScreen,
  settings: settingsScreen,
  feedback: feedbackScreen,
  game: gameScreen,
  hunt: huntScreen,
  order: orderScreen,
  predict: predictScreen,
  profile: profileScreen,
};

/** The hydra games' screens. */
export const GAME_ROUTES = ['game', 'hunt', 'order', 'predict'] as const satisfies readonly Route[];
export type GameRoute = (typeof GAME_ROUTES)[number];
export const isGame = (route: Route): route is GameRoute => (GAME_ROUTES as readonly Route[]).includes(route);

function routeFromHash(hash: string): Route {
  const name = hash.replace(/^#\/?/, '');
  return (ROUTES as readonly string[]).includes(name) ? (name as Route) : 'home';
}

/** Hash router plus the state shared by all screens. */
export class App {
  lang: Lang;
  private screen?: Screen;

  constructor(
    private root: HTMLElement,
    readonly services: Services,
  ) {
    this.lang = services.storage.language();
    services.points.subscribe((result) => this.toast(result));
  }

  /** A short note about what the last answer earned. It does not take focus; screen readers announce it. */
  private toast(result: PointsResult) {
    const lines: string[] = [];
    if (result.gained > 0) lines.push(this.t('points.gained', { n: result.gained }));
    if (result.levelUp) lines.push(this.t('points.levelUp', { n: result.levelUp, title: this.t(`level.title.${levelInfo(this.services.points.state().total).title}`) }));
    for (const task of result.tasks) lines.push(this.t('points.taskDone', { task: this.taskLabel(task) }));
    for (const id of result.achievements) lines.push(this.t('points.achievement', { title: this.t(`ach.${id}.title` as MessageKey) }));
    if (lines.length === 0) return;
    let box = document.getElementById('toasts');
    if (!box) {
      box = h('div', { id: 'toasts', class: 'toasts', 'aria-live': 'polite' });
      document.body.append(box);
    }
    const note = h('div', { class: 'toast' }, ...lines.map((line) => h('p', {}, line)));
    box.append(note);
    setTimeout(() => note.remove(), 2500 + 1000 * lines.length);
  }

  /** The name of a daily task, in the active language. */
  taskLabel(task: DailyTask): string {
    if (task.kind === 'quiz') return this.t('task.quiz');
    if (task.kind === 'levels') return this.t('task.levels');
    return this.t('task.game', { game: this.t(`lesson.${task.game!}.title`) });
  }

  t = (key: MessageKey, params?: Params): string => translate(this.lang, key, params);

  /** Shows the first screen: a saved session resumes without asking. */
  start() {
    addEventListener('popstate', () => this.render());
    if (this.services.trainer.isRunning()) history.replaceState(null, '', '#/quiz');
    this.render();
  }

  /**
   * Settings, Feedback and the hydra games are pushed onto the history so the
   * system back button returns home; quiz screens replace the entry.
   */
  navigate(route: Route) {
    const url = route === 'home' ? '#/' : `#/${route}`;
    if (route === 'settings' || route === 'feedback' || route === 'profile' || isGame(route)) history.pushState({ fromHome: true }, '', url);
    else history.replaceState(null, '', url);
    this.render();
  }

  /** Back from a pushed screen. */
  back() {
    if ((history.state as { fromHome?: boolean } | null)?.fromHome) history.back();
    else this.navigate('home');
  }

  setLanguage(lang: Lang) {
    this.lang = lang;
    this.services.storage.setLanguage(lang);
    this.render();
    this.root.querySelector<HTMLElement>(`[data-lang="${lang}"]`)?.focus();
  }

  render() {
    const { trainer, storage, updates } = this.services;
    let route = routeFromHash(location.hash);
    if ((route === 'quiz' && !trainer.isRunning()) || (route === 'summary' && !storage.lastResult())) {
      route = 'home';
      history.replaceState(null, '', '#/');
    }
    this.screen?.dispose?.();
    this.screen = VIEWS[route](this);
    this.screen.root.dataset.screen = route;
    this.root.replaceChildren(this.screen.root);
    document.documentElement.lang = this.lang;
    document.title = this.t('app.title');
    (this.screen.focus ?? this.screen.root.querySelector<HTMLElement>('h1'))?.focus({ preventScroll: true });
    // The hydra games count like a quiz: an update waits until the player leaves them.
    if (route !== 'quiz' && !isGame(route)) updates.quizEnded();
  }
}
