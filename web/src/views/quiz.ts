import type { App, Route, Screen } from '../app.ts';
import type { Question } from '../content/types.ts';
import { h, svg } from '../dom.ts';
import { codeBlock } from '../highlight.ts';
import { sessionHeads } from '../hydra/heads.ts';
import { hydra } from '../hydra/view.ts';
import { CHECK, CROSS } from '../icons.ts';
import { richText } from '../rich-text.ts';
import { changedLines } from '../content/diff.ts';
import { askPanel } from './ask.ts';
import { currentItem, isLastQuestion, present, type SessionItem } from '../session.ts';

/** Keys typed into these belong to them, not to the quiz shortcuts. */
const TEXT_INPUTS = 'input, textarea, select, dialog';
/** Enter and Space already activate these. */
const ACTIVATABLE = 'button, a';

/** A run of questions as the screen needs it: the quiz session or a daily challenge. */
export interface QuizRun {
  items: SessionItem[];
  index: number;
}

/** What a run of questions is played on: the trainer's session or the daily challenge. */
export interface QuizDriver {
  session(): QuizRun;
  question(id: string): Question;
  /** Records the pick for the current question and returns the run. */
  answer(slot: number): QuizRun | undefined;
  /** Moves on; undefined once the run is over. */
  next(): QuizRun | undefined;
  /** The Quit button. */
  leave(): void;
}

/** Version A and version B side by side (stacked on narrow screens), the changed lines tinted. */
export function diffPair(t: App['t'], a: string, b: string): HTMLElement {
  const snippet = (label: string, code: string, other: string, testId: string) =>
    h(
      'figure',
      { class: 'diff-snippet', 'data-testid': testId },
      h('figcaption', {}, label),
      codeBlock(code, { changedLines: changedLines(code, other) }),
    );
  return h(
    'div',
    { class: 'diff-pair' },
    snippet(t('quiz.diff.a'), a, b, 'diff-a'),
    snippet(t('quiz.diff.b'), b, a, 'diff-b'),
  );
}

export interface RunOptions {
  driver: QuizDriver;
  /** The route of this screen, and where the last "Next" goes. */
  route: Route;
  done: Route;
  /** The quit button's text. */
  quitLabel: string;
  /** The text next to the progress (topic, lesson, step). */
  meta: (question: Question) => string;
  /** Walkthroughs show line numbers and the line asked about. */
  walkthrough?: boolean;
  /** Replaces the code view of a question (the daily challenge marks lines); null shows nothing. */
  code?: (question: Question) => Node | null;
  /** Extra class on the screen. */
  className?: string;
}

export function quizScreen(app: App): Screen {
  const { trainer } = app.services;
  const { t } = app;
  return runScreen(app, {
    driver: {
      session: () => trainer.session()!,
      question: (id) => trainer.question(id),
      answer: (slot) => trainer.answer(slot),
      next: () => {
        const result = trainer.next();
        return result && 'items' in result ? result : undefined;
      },
      leave: () => trainer.quit(),
    },
    route: 'quiz',
    done: 'summary',
    quitLabel: t('quiz.quit'),
    // Walkthroughs show the lesson instead of the topic.
    meta: (question) => (trainer.session()!.lesson === 'functions' ? t('lesson.functions.title') : t(`topic.${question.topic}`)),
    walkthrough: trainer.session()!.lesson === 'functions',
  });
}

/** The question screen shared by the quiz lessons and the daily challenge. */
export function runScreen(app: App, options: RunOptions): Screen {
  const { t, lang } = app;
  const { driver } = options;
  let session = driver.session();
  const item = currentItem(session);
  const { question, choices, answerIndex } = present(driver.question(item.id), item.order);
  const walkthrough = options.walkthrough ?? false;
  /** Spot-the-difference questions show two snippets, A and B. */
  const codeB = question.codeB;

  const choiceButtons = choices.map((choice, slot) => {
    // Values and code read the same in every language; show them as code.
    const isCode = choice.de === choice.en;
    return h(
      'button',
      { class: 'choice', 'data-slot': slot, onclick: () => choose(slot) },
      h('span', { class: 'key', 'aria-hidden': 'true' }, String(slot + 1)),
      h(isCode ? 'code' : 'span', { class: 'text' }, choice[lang]),
      h('span', { class: 'mark' }),
    );
  });

  const verdict = h('p', { class: 'verdict' });
  const explanation = h('div', { class: 'explanation' });
  const next = h('button', { class: 'primary next', onclick: () => goNext() }, isLastQuestion(session) ? t('quiz.finish') : t('quiz.next'));
  const feedback = h('section', { class: 'feedback', 'aria-live': 'polite', tabindex: -1, 'data-testid': 'feedback' });

  const ask = askPanel(app, () => {
    const picked = currentItem(session).picked;
    return {
      prompt: question.prompt[lang],
      ...(question.code === undefined
        ? {}
        : { code: codeB === undefined ? question.code : `# ${t('quiz.diff.a')}\n${question.code}\n\n# ${t('quiz.diff.b')}\n${codeB}` }),
      choices: choices.map((c) => c[lang]),
      ...(picked === null ? {} : { answered: { picked, correct: answerIndex, explanation: question.explanation[lang] } }),
    };
  });
  const heading = h('h1', { class: 'prompt', id: 'prompt', tabindex: -1 }, question.prompt[lang]);
  const heads = hydra(sessionHeads(session, (id) => driver.question(id)));
  const root = h(
    'main',
    { class: `screen quiz${options.className ? ` ${options.className}` : ''}` },
    h('header', { class: 'quiz-header' }, heads.root, h('button', { class: 'quit', onclick: quit }, options.quitLabel)),
    h(
      'p',
      { class: 'quiz-meta' },
      h(
        'span',
        { class: 'progress', 'aria-label': t('quiz.progress', { n: session.index + 1, total: session.items.length }) },
        `${session.index + 1}/${session.items.length}`,
      ),
      h('span', { class: 'topic' }, options.meta(question)),
    ),
    heading,
    options.code
      ? options.code(question)
      : question.code === undefined
        ? null
        : codeB === undefined
          ? codeBlock(question.code, { numbered: walkthrough, focusLine: question.line })
          : diffPair(t, question.code, codeB),
    h('div', { class: 'choices', role: 'group', 'aria-labelledby': 'prompt' }, ...choiceButtons),
    feedback,
    ask.root,
  );

  /** Locks the choices and shows right/wrong with icons, text and explanation. */
  function showFeedback(picked: number) {
    const correct = picked === answerIndex;
    for (const [slot, button] of choiceButtons.entries()) {
      button.disabled = true;
      const mark = button.querySelector('.mark')!;
      if (slot === answerIndex) {
        button.classList.add('correct');
        mark.replaceChildren(svg(CHECK), h('span', { class: 'sr-only' }, t('quiz.correctAnswer')));
      } else if (slot === picked) {
        button.classList.add('wrong');
        mark.replaceChildren(svg(CROSS), h('span', { class: 'sr-only' }, t('quiz.yourWrongAnswer')));
      }
    }
    verdict.textContent = correct ? t('quiz.correct') : t('quiz.wrong');
    verdict.className = `verdict ${correct ? 'correct' : 'wrong'}`;
    explanation.replaceChildren(...richText(question.explanation[lang]));
    feedback.replaceChildren(verdict, explanation, next);
  }

  function choose(slot: number) {
    if (currentItem(session).picked !== null) return;
    session = driver.answer(slot) ?? session;
    showFeedback(slot);
    heads.strike(session.index, slot === answerIndex);
    feedback.focus();
  }

  function goNext() {
    app.navigate(driver.next() ? options.route : options.done);
  }

  function quit() {
    driver.leave();
    app.navigate('home');
  }

  function onKey(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(TEXT_INPUTS)) return;
    const answered = currentItem(session).picked !== null;
    const slot = Number(event.key) - 1;
    if (!answered && Number.isInteger(slot) && slot >= 0 && slot < choiceButtons.length) {
      event.preventDefault();
      choose(slot);
    } else if (answered && (event.key === 'Enter' || event.key === ' ') && !target?.closest(ACTIVATABLE)) {
      event.preventDefault();
      goNext();
    }
  }

  document.addEventListener('keydown', onKey);
  const picked = currentItem(session).picked;
  if (picked !== null) showFeedback(picked);

  return {
    root,
    focus: picked === null ? heading : feedback,
    dispose: () => {
      document.removeEventListener('keydown', onKey);
      ask.dispose();
    },
  };
}
