import type { App, Screen } from '../app.ts';
import { h, svg } from '../dom.ts';
import { mistake, REVEAL_AFTER, tracePrint, unlockedPredict, type PredictTrace } from '../game/predict.ts';
import { STEP_MS } from '../game/speed.ts';
import { highlight } from '../highlight.ts';
import { HEIGHT, necks } from '../hydra/geometry.ts';
import type { HeadState } from '../hydra/heads.ts';
import { hydra } from '../hydra/view.ts';
import { CHECK, CROSS } from '../icons.ts';
import type { MessageKey } from '../i18n.ts';
import { richText } from '../rich-text.ts';
import { subpageHeader } from './header.ts';
import { levelStrip } from './level-strip.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * "What does the hydra say?": a short program that prints a few lines. The
 * hydra has one head per printed line; the player types each line, then
 * checks. The program runs step by step like in the other games, and each
 * time it prints, the head of that line falls (right) or grows back (wrong).
 * The right output is never shown unless the player asks for it after
 * missing twice.
 */
export function predictScreen(app: App): Screen {
  const { t, lang } = app;
  const { predict: game } = app.services;
  const opened = game.open();
  const level = opened.level;
  let state = opened.state;
  const levelIndex = game.levels.indexOf(level);
  const count = level.output.length;

  // ---------------------------------------------------------------- level strip
  const progress = game.progress();
  const open = unlockedPredict(progress, game.levels);
  const strip = levelStrip(
    t,
    game.levels.map((l, i) => ({
      solved: progress.solved.includes(l.id),
      open: open[i]!,
      current: l === level,
      go: () => {
        game.open(l.id);
        app.render();
      },
    })),
  );

  // ---------------------------------------------------------------- the hydra: one head per printed line
  const beast = hydra(Array.from({ length: count }, (): HeadState => 'idle'));
  beast.root.dataset.testid = 'hydra';
  // Numbers in the water under the necks tie each head to its output line.
  for (const [i, shape] of necks(count).entries()) {
    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('class', 'predict-head-number');
    label.setAttribute('x', String(shape.base.x));
    label.setAttribute('y', String(HEIGHT - 1.5));
    label.textContent = String(i + 1);
    beast.root.append(label);
  }
  const heads = [...beast.root.querySelectorAll<SVGGElement>('.hydra-head')].sort(
    (a, b) => Number(a.dataset.index) - Number(b.dataset.index),
  );
  function setHead(i: number, s: HeadState, animate: boolean) {
    const head = heads[i]!;
    if (head.dataset.state === s && !animate) return;
    head.classList.remove('hydra-strike');
    head.dataset.state = s;
    if (animate) {
      // Restart the animation: the class must be re-added after a style flush.
      head.getBoundingClientRect();
      head.classList.add('hydra-strike');
    }
  }

  // ---------------------------------------------------------------- run controls
  const position = h('p', { class: 'run-position', 'data-testid': 'run-position' }, t('predict.idle'));
  const control = (label: MessageKey, glyph: string, onclick: () => void, testId: string) =>
    h('button', { class: 'run-control', 'data-testid': testId, disabled: true, onclick, 'aria-label': t(label), title: t(label) }, glyph);
  const restart = control('game.restart', '↺', () => go(0, true), 'run-restart');
  const playPause = control('game.play', '▶', () => (timer === undefined ? play() : pause()), 'run-play');
  const step = control('game.step', '→', () => (pause(), go(index + 1)), 'run-step');
  const toEnd = control('game.end', '⇥', () => (pause(), go(Infinity)), 'run-end');
  const vars = h('p', { class: 'vars', 'data-testid': 'vars' });

  // ---------------------------------------------------------------- the program
  const codeLines = level.code.split('\n').map((text) => {
    const line = h('span', { class: 'line' });
    // highlight.js escapes the source, so its HTML output is safe to insert.
    line.innerHTML = highlight(text);
    return line;
  });
  const code = h('code', { class: 'hljs language-python' });
  for (const [i, line] of codeLines.entries()) code.append(...(i === 0 ? [line] : ['\n', line]));
  const programBox = h('pre', { class: 'code numbered program', 'data-testid': 'program' }, code);

  // ---------------------------------------------------------------- the output lines the player types
  const inputs = state.guesses.map((guess, i) =>
    h('input', {
      class: 'predict-input',
      type: 'text',
      value: guess,
      'data-testid': `guess-${i + 1}`,
      'aria-label': t('predict.line', { n: i + 1 }),
      autocomplete: 'off',
      autocapitalize: 'off',
      autocorrect: 'off',
      spellcheck: 'false',
      enterkeyhint: i === count - 1 ? 'done' : 'next',
      oninput: () => typed(),
      onfocus: () => render(),
      onblur: () => render(),
      onkeydown: (event: Event) => {
        if ((event as KeyboardEvent).key !== 'Enter') return;
        event.preventDefault();
        if (i < count - 1) inputs[i + 1]!.focus();
        else check();
      },
    }),
  );
  // The input keeps its value as a property; the attribute only sets the start.
  for (const [i, input] of inputs.entries()) input.value = state.guesses[i]!;
  const marks = inputs.map(() => h('span', { class: 'mark' }));
  const rows = inputs.map((input, i) =>
    h(
      'li',
      { class: 'predict-line', 'data-testid': `output-${i + 1}` },
      h('span', { class: 'predict-number', 'aria-hidden': 'true' }, String(i + 1)),
      input,
      marks[i]!,
    ),
  );
  const outputBox = h(
    'div',
    { class: 'predict-console' },
    h('p', { class: 'predict-console-title', 'aria-hidden': 'true' }, t('predict.output')),
    h('ol', { class: 'predict-lines', 'aria-label': t('predict.output') }, ...rows),
  );

  const checkButton = h('button', { class: 'primary predict-check', 'data-testid': 'check', onclick: () => check() }, t('predict.check'));
  const feedback = h('section', { class: 'feedback', 'aria-live': 'polite', tabindex: -1, 'data-testid': 'feedback' });
  feedback.dataset.task = t('predict.task');

  const heading = h('h2', { class: 'level-title', tabindex: -1 }, `${t('game.level', { n: levelIndex + 1 })}: ${level.title[lang]}`);
  const root = h(
    'main',
    { class: 'screen game predict' },
    h('div', { class: 'game-bar' }, subpageHeader(app, t('lesson.predict.title')), strip),
    h(
      'div',
      { class: 'stage', 'data-testid': 'stage' },
      h(
        'div',
        { class: 'arena-box predict-hydra-box' },
        beast.root,
        h(
          'details',
          { class: 'info' },
          h('summary', {}, heading),
          h(
            'div',
            { class: 'info-body' },
            h('div', { class: 'intro' }, ...richText(level.intro[lang])),
            h('div', { class: 'info-rule' }, ...richText(t('predict.info'))),
          ),
        ),
      ),
      h(
        'div',
        { class: 'run' },
        position,
        h('div', { class: 'run-controls', role: 'group', 'aria-label': t('game.controls') }, restart, playPause, step, toEnd),
      ),
      h('div', { class: 'program-slot' }, programBox),
      vars,
    ),
    outputBox,
    checkButton,
    feedback,
  );

  // ---------------------------------------------------------------- the run
  let trace: PredictTrace | undefined;
  /** Per output line, whether the checked guess is right. */
  let right: boolean[] = [];
  let index = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  let finishedShown = false;
  /** Heads already showing their verdict, so each falls or regrows once when the run reaches it. */
  let shown = 0;

  function render() {
    const steps = trace?.steps;
    const snap = steps?.[index];
    const last = steps !== undefined && index === steps.length - 1;
    const printed = snap?.printed ?? 0;
    for (let i = 0; i < count; i++) {
      if (!trace) setHead(i, document.activeElement === inputs[i] ? 'active' : 'idle', false);
      else if (i < printed) setHead(i, right[i] ? 'slashed' : 'regrown', i >= shown);
      else setHead(i, 'idle', false);
    }
    shown = printed;
    for (const [i, row] of rows.entries()) {
      const done = trace !== undefined && i < printed;
      row.classList.toggle('right', done && right[i]!);
      row.classList.toggle('wrong', done && !right[i]);
      // The line printed by the step showing is marked like the running code line.
      row.classList.toggle('focus', trace !== undefined && snap!.line !== null && i === printed - 1 && printed > (steps![index - 1]?.printed ?? 0));
      if (done) marks[i]!.replaceChildren(svg(right[i] ? CHECK : CROSS), h('span', { class: 'sr-only' }, t(right[i] ? 'quiz.correctAnswer' : 'quiz.yourWrongAnswer')));
      else marks[i]!.replaceChildren();
    }
    for (const [i, line] of codeLines.entries()) line.classList.toggle('focus', snap !== undefined && snap.line === i + 1);
    const focused = codeLines[(snap?.line ?? 0) - 1];
    // Keep the running line visible inside a scrolling program, without moving the page.
    if (focused) {
      if (focused.offsetTop < programBox.scrollTop) programBox.scrollTop = focused.offsetTop;
      else if (focused.offsetTop + focused.offsetHeight > programBox.scrollTop + programBox.clientHeight) {
        programBox.scrollTop = focused.offsetTop + focused.offsetHeight - programBox.clientHeight;
      }
    }
    const counter = { n: index + 1, total: steps?.length ?? 1 };
    position.textContent = !snap
      ? t('predict.idle')
      : snap.line === null
        ? t('game.finished', counter)
        : t('game.position', { ...counter, line: snap.line });
    const shownVars = snap?.vars ?? [];
    vars.replaceChildren(
      h('span', { class: 'vars-label' }, `${t('game.vars')}: `),
      ...(shownVars.length === 0
        ? [h('span', { class: 'vars-none' }, t('game.noVars'))]
        : shownVars.flatMap(([name, value], i) => [i > 0 ? ' ' : '', h('code', {}, `${name} = ${value}`)])),
    );
    restart.disabled = !trace;
    playPause.disabled = !trace || last;
    step.disabled = !trace || last;
    toEnd.disabled = !trace || last;
    const label = timer === undefined ? t('game.play') : t('game.pause');
    playPause.textContent = timer === undefined ? '▶' : '❚❚';
    playPause.setAttribute('aria-label', label);
    playPause.title = label;
  }

  function go(to: number, resume = false) {
    if (!trace) return;
    const target = Math.max(0, Math.min(to, trace.steps.length - 1));
    // Going back puts the heads back up without an animation.
    if (target < index) shown = Math.min(shown, trace.steps[target]!.printed);
    index = target;
    if (index === trace.steps.length - 1) {
      pause();
      if (!finishedShown) finish();
    } else if (resume) play();
    render();
  }

  function play() {
    if (timer !== undefined || !trace) return;
    timer = setInterval(() => go(index + 1), STEP_MS[app.services.storage.gameSpeed()]);
    render();
  }

  function pause() {
    if (timer === undefined) return;
    clearInterval(timer);
    timer = undefined;
    render();
  }

  /** Back to the level before a check, e.g. after a line was changed. */
  function stopRun() {
    pause();
    trace = undefined;
    right = [];
    index = 0;
    shown = 0;
    finishedShown = false;
    feedback.replaceChildren();
    render();
  }

  function typed() {
    const guesses = inputs.map((input) => input.value);
    game.type(guesses);
    state = { ...state, guesses, solved: state.solved && guesses.every((g, i) => g === state.guesses[i]) };
    if (trace) stopRun();
    else if (feedback.childElementCount > 0) feedback.replaceChildren();
  }

  /** Runs the program from the start; `autoplay` plays it at the game speed, else it jumps to the end. */
  function runChecked(autoplay: boolean) {
    pause();
    trace = tracePrint(level.code);
    index = 0;
    shown = 0;
    finishedShown = false;
    feedback.replaceChildren();
    root.querySelector('.info')?.removeAttribute('open');
    if (autoplay) go(0, true);
    else {
      // A solved level shows its finished run again, without replaying it.
      shown = count;
      go(Infinity);
    }
  }

  function check() {
    const empty = inputs.find((input) => input.value.trim() === '');
    if (empty) {
      stopRun();
      feedback.replaceChildren(h('p', { class: 'verdict wrong', 'data-testid': 'outcome' }, t('predict.fillAll')));
      empty.focus();
      return;
    }
    const result = game.check();
    if (!result) return;
    right = result.right;
    state = game.progress().current ?? state;
    if (result.solved) strip.querySelector('[aria-current]')?.classList.add('solved');
    // Close the phone keyboard so the run can be watched.
    if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur();
    runChecked(true);
  }

  function finish() {
    if (!trace) return;
    finishedShown = true;
    const won = right.every(Boolean);
    const parts: Node[] = [
      h(
        'p',
        { class: `verdict ${won ? 'correct' : 'wrong'}`, 'data-testid': 'outcome' },
        won ? t('predict.outcome.success') : t('predict.outcome.wrong', { right: right.filter(Boolean).length, total: count }),
      ),
    ];
    if (won) {
      parts.push(h('div', { class: 'explanation' }, ...richText(level.explain[lang])));
      if (levelIndex < game.levels.length - 1) {
        parts.push(
          h(
            'button',
            {
              class: 'primary next',
              onclick: () => {
                game.open(game.levels[levelIndex + 1]!.id);
                app.render();
              },
            },
            t('game.next'),
          ),
        );
      } else {
        parts.push(
          h('p', { class: 'all-done' }, t('game.allDone')),
          h('button', { class: 'primary next', onclick: () => app.navigate('home') }, t('summary.home')),
        );
      }
    } else {
      const notes = level.output.flatMap((line, i) => {
        const kind = mistake(state.guesses[i]!, line);
        return kind ? [t(`predict.mistake.${kind}`, { n: i + 1 })] : [];
      });
      parts.push(
        h(
          'div',
          { class: 'explanation' },
          ...notes.flatMap((note) => richText(note)),
          ...richText(`${t('order.hint')} ${level.hint[lang]}`),
          h('p', { class: 'try-again' }, t('predict.trace')),
        ),
      );
      if (state.misses >= REVEAL_AFTER) {
        const reveal = h(
          'button',
          {
            class: 'predict-reveal',
            'data-testid': 'reveal',
            onclick: () =>
              reveal.replaceWith(
                h(
                  'div',
                  { class: 'predict-revealed', 'data-testid': 'revealed' },
                  h('p', {}, t('predict.revealed')),
                  h('pre', { class: 'code' }, h('code', {}, level.output.join('\n'))),
                  h('p', {}, t('predict.copy')),
                ),
              ),
          },
          t('predict.reveal'),
        );
        parts.push(reveal);
      }
    }
    feedback.replaceChildren(...parts);
  }

  if (state.solved) {
    right = level.output.map(() => true);
    runChecked(false);
  } else render();

  const current = strip.querySelector<HTMLElement>('[aria-current]');
  requestAnimationFrame(() => {
    if (current) strip.scrollLeft = current.offsetLeft - (strip.clientWidth - current.offsetWidth) / 2;
  });

  return { root, focus: heading, dispose: () => pause() };
}
