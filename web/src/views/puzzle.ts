import type { App, Screen } from '../app.ts';
import { h, svg } from '../dom.ts';
import type { Game } from '../game/game.ts';
import { choiceStates, unlocked, type LevelState } from '../game/progress.ts';
import { GAP, type PuzzleLevel } from '../game/puzzle.ts';
import { STEP_MS } from '../game/speed.ts';
import { highlight } from '../highlight.ts';
import { CHECK, CROSS } from '../icons.ts';
import type { MessageKey } from '../i18n.ts';
import { richText } from '../rich-text.ts';
import { subpageHeader } from './header.ts';
import { levelStrip } from './level-strip.ts';

const TEXT_INPUTS = 'input, textarea, select, dialog';

/** One step of a run, as the screen needs it; a mode's snapshots carry more for its stage. */
export interface PuzzleStep {
  /** The line about to run, highlighted; null once the program has ended. */
  line: number | null;
  /** Variables in scope as [name, Python repr]. */
  vars: [string, string][];
}

export interface PuzzleTrace<S extends PuzzleStep, O> {
  steps: S[];
  outcome: O;
}

/** The picture of a level that a run is drawn on. */
export interface PuzzleStage<S, O> {
  root: Element;
  /** Width / height of the stage, so the layout can size it. */
  ratio: number;
  /** Draws one step; `outcome` is set on the last step of a run. With `ms` > 0 changes are animated. */
  show(step: S, outcome: O | undefined, ms: number): void;
}

/**
 * A hydra game mode: its levels and progress, how an answer runs, and how a
 * run is drawn and told. The screen around it (level strip, code with the
 * gap, run controls, answers, feedback) is the same for every mode.
 */
export interface PuzzleMode<L extends PuzzleLevel, S extends PuzzleStep, O extends { kind: string }> {
  game: Game<L>;
  /** The screen's (hidden) title. */
  title: MessageKey;
  /** The task, shown until a run has ended. */
  task: MessageKey;
  /** The run position before any answer was picked. */
  idle: MessageKey;
  /** Extra class on the screen, for the mode's styles. */
  className: string;
  stage(level: L): PuzzleStage<S, O>;
  /** The picture before any answer runs. */
  initial(level: L): S;
  run(level: L, choice: number): PuzzleTrace<S, O>;
  /** What a run's outcome means, as one sentence. */
  outcomeText(outcome: O): string;
  /** Extra parts of the level info under the intro, e.g. the list of commands. */
  info?(level: L): Node[];
}

/** The level's code with line numbers; the gap is empty, or filled with a choice's code. */
function program(level: PuzzleLevel, filled?: string): { root: HTMLPreElement; lines: HTMLElement[] } {
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

export function puzzleScreen<L extends PuzzleLevel, S extends PuzzleStep, O extends { kind: string }>(
  app: App,
  mode: PuzzleMode<L, S, O>,
): Screen {
  const { t, lang } = app;
  const { game } = mode;
  const opened = game.open();
  const level = opened.level;
  let state = opened.state;
  const levelIndex = game.levels.indexOf(level);
  const pool = mode.stage(level);

  // ---------------------------------------------------------------- level strip
  const progress = game.progress();
  const open = unlocked(progress, game.levels);
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

  // ---------------------------------------------------------------- run controls
  const position = h('p', { class: 'run-position', 'data-testid': 'run-position' }, t(mode.idle));
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
  feedback.dataset.task = t(mode.task);

  const heading = h('h2', { class: 'level-title', tabindex: -1 }, `${t('game.level', { n: levelIndex + 1 })}: ${level.title[lang]}`);
  const root = h(
    'main',
    { class: `screen game ${mode.className}` },
    h('div', { class: 'game-bar' }, subpageHeader(app, t(mode.title)), strip),
    h(
      'div',
      { class: 'stage', 'data-testid': 'stage' },
      h(
        'div',
        {
          class: 'arena-box',
          style: `--ratio: ${pool.ratio}`,
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
            ...(mode.info?.(level) ?? []),
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
    h('p', { class: 'prompt sr-only', id: 'game-task' }, t(mode.task)),
    h('div', { class: 'choices', role: 'group', 'aria-labelledby': 'game-task' }, ...choiceButtons),
    feedback,
  );

  // ---------------------------------------------------------------- the run
  // Before any pick, the stage shows the level as it starts.
  let trace: { steps: S[]; outcome?: O } = { steps: [mode.initial(level)] };
  let index = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  /** Whether the outcome of the current run is showing. */
  let finishedShown = false;
  /** The choice whose run is showing, if any. */
  let running: number | undefined;
  /** Milliseconds the hydra takes to swim back to the start before a new run. */
  const REWIND_MS = 350;
  /** Whether the run showing is of a choice the player had not seen the outcome of: its verdict waits for the end. */
  let suspense = false;
  /** Milliseconds the hydra takes to glide to the next step. */
  let glide = 0;

  /** While the arena swims back to the start picture before a new run, it is not told about steps. */
  let rewinding: ReturnType<typeof setTimeout> | undefined;

  function render() {
    const snap = trace.steps[index]!;
    const last = index === trace.steps.length - 1;
    if (rewinding === undefined) pool.show(snap, last && running !== undefined ? trace.outcome : undefined, glide);
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
        ? t(mode.idle)
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
    const hadRun = running !== undefined;
    running = choice;
    suspense = hidden;
    finishedShown = false;
    trace = mode.run(level, choice);
    code = program(level, level.choices[choice]!.code);
    codeSlot.replaceChildren(code.root);
    lockChoices();
    feedback.replaceChildren();
    index = 0;
    // A step shows the world after its line, so a run starts from the start picture and the first line acts at once.
    clearTimeout(rewinding);
    rewinding = undefined;
    if (hadRun) {
      // Back to the start picture by gliding, not by jumping, and only then the first line acts.
      pool.show(mode.initial(level), undefined, REWIND_MS);
      rewinding = setTimeout(() => {
        rewinding = undefined;
        render();
      }, REWIND_MS);
    } else pool.show(mode.initial(level), undefined, 0);
    glide = autoplay ? STEP_MS[app.services.storage.gameSpeed()] * 0.8 : 300;
    render();
    if (autoplay) play();
    else go(Infinity);
  }

  // ---------------------------------------------------------------- feedback

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
      mode.outcomeText(trace.outcome!),
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
