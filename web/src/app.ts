import type { FeedbackQueue } from './feedback/queue.ts';
import type { Game } from './game/game.ts';
import type { HeadsLevel } from './game/heads.ts';
import { translate, type Lang, type MessageKey, type Params } from './i18n.ts';
import type { InstallPrompt } from './install.ts';
import type { AppStorage } from './storage.ts';
import type { Trainer } from './trainer.ts';
import type { UpdateManager } from './update.ts';
import { feedbackScreen } from './views/feedback.ts';
import { gameScreen } from './views/game.ts';
import { headsScreen } from './views/heads.ts';
import { homeScreen } from './views/home.ts';
import { quizScreen } from './views/quiz.ts';
import { settingsScreen } from './views/settings.ts';
import { summaryScreen } from './views/summary.ts';

export const ROUTES = ['home', 'quiz', 'summary', 'settings', 'feedback', 'game', 'heads'] as const;
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
  heads: Game<HeadsLevel>;
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
  heads: headsScreen,
};

/** The hydra games' screens. */
export const isGame = (route: Route) => route === 'game' || route === 'heads';

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
    if (route === 'settings' || route === 'feedback' || isGame(route)) history.pushState({ fromHome: true }, '', url);
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
