import type { App, Screen } from '../app.ts';
import { h, svg } from '../dom.ts';
import { arena } from '../game/arena.ts';
import { STEP_MS } from '../game/speed.ts';
import { fill, GAP, type GameLevel } from '../game/levels.ts';
import { choiceStates, unlocked, type LevelState } from '../game/progress.ts';
import { parseMap, simulate, type Outcome, type Trace } from '../game/world.ts';
import { highlight } from '../highlight.ts';
import { CHECK, CROSS } from '../icons.ts';
import type { MessageKey } from '../i18n.ts';
import { richText } from '../rich-text.ts';
import { subpageHeader } from './header.ts';

const TEXT_INPUTS = 'input, textarea, select, dialog';

const COMMANDS: [string, MessageKey][] = [
  ['move()', 'game.cmd.move'],
  ['turn_left()', 'game.cmd.turnLeft'],
  ['turn_right()', 'game.cmd.turnRight'],
  ['wall_ahead()', 'game.cmd.wallAhead'],
  ['fish_ahead()', 'game.cmd.fishAhead'],
];

/** The level's code with line numbers; the gap is empty, or filled with a choice's code. */
function program(level: GameLevel, filled?: string): { root: HTMLPreElement; lines: HTMLElement[] } {
  const lines = level.code.split('\n').map((text) => {
    const line = h('span', { class: 'line' });
    const at = text.indexOf(GAP);
    if (at < 0) {
      line.innerHTML = highlight(text);
      return line;
    }
    const gap = h('span', {
      class: filled === undefined ? 'gap' : 'gap filled',
      'data-testid': 'gap',
    });
    if (filled === undefined) gap.textContent = GAP;
    else gap.innerHTML = highlight(filled);
    // highlight.js escapes the source, so its HTML output is safe to insert.
    line.innerHTML = highlight(text.slice(0, at));
    line.append(gap);
    line.insertAdjacentHTML('beforeend', highlight(text.slice(at + GAP.length)));
    return line;
  });
  const code = h('code', { class: 'hljs language-python' });
  for (const [i, line] of lines.entries()) code.append(...(i === 0 ? [line] : ['\n', line]));
  return {
    root: h('pre', { class: 'code numbered program', 'data-testid': 'program' }, code),
    lines,
  };
}

export function gameScreen(app: App): Screen {
  const { t, lang } = app;
  const { game } = app.services;
  const opened = game.open();
  const level = opened.level;
  let state = opened.state;
  const levelIndex = game.levels.indexOf(level);
  const world = parseMap(level.map);
  const pool = arena(world);

  // ---------------------------------------------------------------- level strip
  const progress = game.progress();
  const open = unlocked(progress, game.levels);
  const strip = h(
    'nav',
    { class: 'level-strip', 'aria-label': t('game.levels') },
    ...game.levels.map((l, i) => {
      const solved = progress.solved.includes(l.id);
      const label = t(solved ? 'game.levelSolved' : open[i] ? 'game.level' : 'game.levelLocked', { n: i + 1 });
      return h(
        'button',
        {
          class: `level-dot${solved ? ' solved' : ''}`,
          'aria-label': label,
          title: label,
          'aria-current': l === level ? 'step' : undefined,
          disabled: !open[i],
          'data-testid': `level-${i + 1}`,
          onclick: () => {
            game.open(l.id);
            app.render();
          },
        },
        String(i + 1),
      );
    }),
  );

  // ---------------------------------------------------------------- run controls
  const position = h('p', { class: 'run-position', 'data-testid': 'run-position' }, t('game.idle'));
  // Slim icon buttons; the words are their accessible names and tooltips.
  const control = (label: MessageKey, glyph: string, onclick: () => void, testId: string) =>
    h(
      'button',
      {
        class: 'run-control',
        'data-testid': testId,
        disabled: true,
        onclick,
        'aria-label': t(label),
        title: t(label),
      },
      glyph,
    );
  const restart = control('game.restart', '↺', () => go(0, true), 'run-restart');
  const playPause = control('game.play', '▶', () => (timer === undefined ? play() : pause()), 'run-play');
  const step = control('game.step', '→', () => (pause(), go(index + 1)), 'run-step');
  const toEnd = control('game.end', '⇥', () => (pause(), go(Infinity)), 'run-end');
  const vars = h('p', { class: 'vars', 'data-testid': 'vars' });

  let code = program(level, state.solved ? level.choices[level.answerIndex]!.code : undefined);
  const codeSlot = h('div', { class: 'program-slot' }, code.root);

  // ---------------------------------------------------------------- choices
  const choiceButtons = state.order.map((choice, slot) =>
    h(
      'button',
      { class: 'choice', 'data-slot': slot, onclick: () => choose(slot) },
      h('span', { class: 'key', 'aria-hidden': 'true' }, String(slot + 1)),
      h('code', { class: 'text' }, level.choices[choice]!.code),
      h('span', { class: 'mark' }),
    ),
  );
  const feedback = h('section', {
    class: 'feedback',
    'aria-live': 'polite',
    tabindex: -1,
    'data-testid': 'feedback',
  });
  // Until a run has ended, the feedback slot shows the task, so no extra line is needed for it.
  feedback.dataset.task = t('game.task');

  const heading = h('h2', { class: 'level-title', tabindex: -1 }, `${t('game.level', { n: levelIndex + 1 })}: ${level.title[lang]}`);
  const root = h(
    'main',
    { class: 'screen game' },
    h('div', { class: 'game-bar' }, subpageHeader(app, t('lesson.game.title')), strip),
    h(
      'div',
      { class: 'stage', 'data-testid': 'stage' },
      h(
        'div',
        {
          class: 'arena-box',
          style: `--ratio: ${(world.width * 10 + 2) / (world.height * 10 + 2)}`,
        },
        pool.root,
        h(
          'details',
          { class: 'info' },
          h('summary', {}, heading),
          h(
            'div',
            { class: 'info-body' },
            h('div', { class: 'intro' }, ...richText(level.intro[lang])),
            h('p', { class: 'info-commands' }, t('game.commands')),
            h('dl', {}, ...COMMANDS.flatMap(([name, key]) => [h('dt', {}, h('code', {}, name)), h('dd', {}, ...richText(t(key)))])),
          ),
        ),
      ),
      h(
        'div',
        { class: 'run' },
        position,
        h(
          'div',
          {
            class: 'run-controls',
            role: 'group',
            'aria-label': t('game.controls'),
          },
          restart,
          playPause,
          step,
          toEnd,
        ),
      ),
      codeSlot,
      vars,
    ),
    h('p', { class: 'prompt sr-only', id: 'game-task' }, t('game.task')),
    h('div', { class: 'choices', role: 'group', 'aria-labelledby': 'game-task' }, ...choiceButtons),
    feedback,
  );

  // ---------------------------------------------------------------- the run
  let trace: Trace = simulate(world, '');
  let index = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  /** Whether the outcome of the current run is showing. */
  let finishedShown = false;
  /** The choice whose run is showing, if any. */
  let running: number | undefined;
  /** Whether the run showing is of a choice the player had not seen the outcome of: its verdict waits for the end. */
  let suspense = false;
  /** Milliseconds the hydra takes to glide to the next step. */
  let glide = 0;

  function render() {
    const snap = trace.steps[index]!;
    const last = index === trace.steps.length - 1;
    pool.show(snap, last && running !== undefined ? trace.outcome : undefined, glide);
    for (const [i, line] of code.lines.entries()) line.classList.toggle('focus', running !== undefined && snap.line === i + 1);
    const focused = code.lines[(snap.line ?? 0) - 1];
    // Keep the running line visible inside a scrolling program, without moving the page.
    if (running !== undefined && focused) {
      const box = code.root;
      if (focused.offsetTop < box.scrollTop) box.scrollTop = focused.offsetTop;
      else if (focused.offsetTop + focused.offsetHeight > box.scrollTop + box.clientHeight) {
        box.scrollTop = focused.offsetTop + focused.offsetHeight - box.clientHeight;
      }
    }
    const counter = { n: index + 1, total: trace.steps.length };
    position.textContent =
      running === undefined
        ? t('game.idle')
        : snap.line === null
          ? t('game.finished', counter)
          : t('game.position', { ...counter, line: snap.line });
    vars.replaceChildren(
      h('span', { class: 'vars-label' }, `${t('game.vars')}: `),
      ...(snap.vars.length === 0
        ? [h('span', { class: 'vars-none' }, t('game.noVars'))]
        : snap.vars.flatMap(([name, value], i) => [i > 0 ? ' ' : '', h('code', {}, `${name} = ${value}`)])),
    );
    const disabled = running === undefined;
    restart.disabled = disabled;
    playPause.disabled = disabled || last;
    step.disabled = disabled || last;
    toEnd.disabled = disabled || last;
    const label = timer === undefined ? t('game.play') : t('game.pause');
    playPause.textContent = timer === undefined ? '▶' : '❚❚';
    playPause.setAttribute('aria-label', label);
    playPause.title = label;
  }

  function go(to: number, resume = false) {
    glide = timer !== undefined ? STEP_MS[app.services.storage.gameSpeed()] * 0.8 : to === index + 1 ? 300 : 0;
    index = Math.max(0, Math.min(to, trace.steps.length - 1));
    const atEnd = index === trace.steps.length - 1;
    if (atEnd) {
      pause();
      if (!finishedShown) finish();
    } else if (resume) play();
    render();
  }

  function play() {
    if (timer !== undefined || running === undefined) return;
    timer = setInterval(() => go(index + 1), STEP_MS[app.services.storage.gameSpeed()]);
    render();
  }

  function pause() {
    if (timer === undefined) return;
    clearInterval(timer);
    timer = undefined;
    render();
  }

  /** Starts the run of a choice from the first step. */
  function run(choice: number, autoplay: boolean, hidden = false) {
    pause();
    running = choice;
    suspense = hidden;
    glide = 0;
    finishedShown = false;
    trace = simulate(world, fill(level, choice));
    code = program(level, level.choices[choice]!.code);
    codeSlot.replaceChildren(code.root);
    lockChoices();
    feedback.replaceChildren();
    index = 0;
    render();
    if (autoplay) play();
    else go(Infinity);
  }

  // ---------------------------------------------------------------- feedback

  function outcomeText(outcome: Outcome): string {
    switch (outcome.kind) {
      case 'success':
        return t('game.outcome.success');
      case 'crash':
        return t('game.outcome.crash', { line: outcome.line });
      case 'loop':
        return t('game.outcome.loop');
      case 'missed':
        return t(outcome.left === 1 ? 'game.outcome.missed.one' : 'game.outcome.missed.other', { left: outcome.left });
      case 'error':
        return t('game.outcome.error', {
          line: outcome.line,
          message: outcome.message,
        });
    }
  }

  function lockChoices() {
    const states = choiceStates(level, state);
    for (const [slot, button] of choiceButtons.entries()) {
      // The choice whose run is playing shows its verdict only once the run ends.
      const playing = suspense && !finishedShown && state.order[slot] === running;
      const s = playing ? 'open' : states[slot]!;
      button.classList.toggle('wrong', s === 'wrong');
      button.classList.toggle('correct', s === 'right');
      button.classList.toggle('running', playing);
      const mark = button.querySelector('.mark')!;
      if (s === 'wrong') mark.replaceChildren(svg(CROSS), h('span', { class: 'sr-only' }, t('quiz.yourWrongAnswer')));
      else if (s === 'right') mark.replaceChildren(svg(CHECK), h('span', { class: 'sr-only' }, t('quiz.correctAnswer')));
      else mark.replaceChildren();
    }
  }

  /** The run reached its last step: tell what happened and unlock the remaining choices. */
  function finish() {
    if (running === undefined) return;
    finishedShown = true;
    const choice = level.choices[running]!;
    const right = running === level.answerIndex;
    const verdict = h(
      'p',
      {
        class: `verdict ${right ? 'correct' : 'wrong'}`,
        'data-testid': 'outcome',
      },
      outcomeText(trace.outcome),
    );
    const parts: Node[] = [verdict, h('div', { class: 'explanation' }, ...richText(choice.note[lang]))];
    if (!right && !state.solved) parts.push(h('p', { class: 'try-again' }, t('game.tryAgain')));
    if (state.solved) parts.push(h('p', { class: 'compare' }, t('game.compare')));
    if (state.solved && levelIndex < game.levels.length - 1) {
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
    } else if (state.solved) {
      parts.push(
        h('p', { class: 'all-done' }, t('game.allDone')),
        h('button', { class: 'primary next', onclick: () => app.navigate('home') }, t('summary.home')),
      );
    }
    feedback.replaceChildren(...parts);
    lockChoices();
  }

  function choose(slot: number) {
    const choice = state.order[slot];
    if (choice === undefined) return;
    // Any answer can be run at any time, also while another one runs; the outcome
    // of one the player has not seen yet stays hidden until its run ends.
    const seen = choiceStates(level, state)[slot] !== 'open';
    state = game.pick(slot) ?? state;
    if (state.solved) strip.querySelector('[aria-current]')?.classList.add('solved');
    run(choice, true, !seen);
    // The level info is a drop-down over the arena: close it so the run can be watched.
    root.querySelector('.info')?.removeAttribute('open');
  }

  function onKey(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(TEXT_INPUTS)) return;
    const slot = Number(event.key) - 1;
    const button = choiceButtons[slot];
    if (Number.isInteger(slot) && button && !button.disabled) {
      event.preventDefault();
      choose(slot);
    }
  }

  document.addEventListener('keydown', onKey);
  lockChoices();
  // A solved level shows its finished run again, without replaying it.
  if (state.solved) run(level.answerIndex, false);
  else render();

  // Level buttons stay on one line; scroll the current one into view.
  const current = strip.querySelector<HTMLElement>('[aria-current]');
  requestAnimationFrame(() => {
    if (current) strip.scrollLeft = current.offsetLeft - (strip.clientWidth - current.offsetWidth) / 2;
  });

  return {
    root,
    focus: heading,
    dispose: () => {
      pause();
      document.removeEventListener('keydown', onKey);
    },
  };
}
