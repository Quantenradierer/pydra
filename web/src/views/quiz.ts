import type { App, Screen } from '../app.ts';
import { h, svg } from '../dom.ts';
import { codeBlock } from '../highlight.ts';
import { sessionHeads } from '../hydra/heads.ts';
import { hydra } from '../hydra/view.ts';
import { CHECK, CROSS } from '../icons.ts';
import { richText } from '../rich-text.ts';
import { currentItem, isLastQuestion, present } from '../session.ts';

/** Keys typed into these belong to them, not to the quiz shortcuts. */
const TEXT_INPUTS = 'input, textarea, select, dialog';
/** Enter and Space already activate these. */
const ACTIVATABLE = 'button, a';

export function quizScreen(app: App): Screen {
  const { t, lang } = app;
  const { trainer } = app.services;
  let session = trainer.session()!;
  const item = currentItem(session);
  const { question, choices, answerIndex } = present(trainer.question(item.id), item.order);

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

  const heading = h('h1', { class: 'prompt', id: 'prompt', tabindex: -1 }, question.prompt[lang]);
  const heads = hydra(sessionHeads(session, (id) => trainer.question(id)));
  const root = h(
    'main',
    { class: 'screen quiz' },
    h('header', { class: 'quiz-header' }, heads.root, h('button', { class: 'quit', onclick: quit }, t('quiz.quit'))),
    h(
      'p',
      { class: 'quiz-meta' },
      h(
        'span',
        { class: 'progress', 'aria-label': t('quiz.progress', { n: session.index + 1, total: session.items.length }) },
        `${session.index + 1}/${session.items.length}`,
      ),
      h('span', { class: 'topic' }, t(`topic.${question.topic}`)),
    ),
    heading,
    question.code === undefined ? null : codeBlock(question.code),
    h('div', { class: 'choices', role: 'group', 'aria-labelledby': 'prompt' }, ...choiceButtons),
    feedback,
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
    session = trainer.answer(slot) ?? session;
    showFeedback(slot);
    heads.strike(session.index, slot === answerIndex);
    feedback.focus();
  }

  function goNext() {
    const result = trainer.next();
    app.navigate(result && 'items' in result ? 'quiz' : 'summary');
  }

  function quit() {
    trainer.quit();
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
    dispose: () => document.removeEventListener('keydown', onKey),
  };
}
