import type { App, Screen } from '../app.ts';
import { h } from '../dom.ts';
import { huntArena } from '../game/hunt-arena.ts';
import { parseHuntMap, simulateHunt, type HuntSnapshot, type HuntTrace } from '../game/hunt.ts';
import { unlockedOrder } from '../game/order.ts';
import { arrange } from '../game/order-levels.ts';
import { STEP_MS } from '../game/speed.ts';
import { highlight } from '../highlight.ts';
import type { MessageKey } from '../i18n.ts';
import { richText } from '../rich-text.ts';
import { subpageHeader } from './header.ts';
import { huntInfo, huntOutcomeText } from './hunt.ts';

/**
 * "Code puzzle": the warrior's program is all there but shuffled. The
 * player moves its lines up and down, then runs it; the run plays step by
 * step like in the other games.
 */
export function orderScreen(app: App): Screen {
  const { t, lang } = app;
  const { order: game } = app.services;
  const opened = game.open();
  const level = opened.level;
  let order = opened.order;
  const levelIndex = game.levels.indexOf(level);
  const world = parseHuntMap(level.map);
  const pool = huntArena(world);
  const start: HuntSnapshot = simulateHunt(world, '').steps[0]!;

  // ---------------------------------------------------------------- level strip
  const progress = game.progress();
  const open = unlockedOrder(progress, game.levels);
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
  const position = h('p', { class: 'run-position', 'data-testid': 'run-position' }, t('order.idle'));
  const control = (label: MessageKey, glyph: string, onclick: () => void, testId: string) =>
    h('button', { class: 'run-control', 'data-testid': testId, disabled: true, onclick, 'aria-label': t(label), title: t(label) }, glyph);
  const restart = control('game.restart', '↺', () => go(0, true), 'run-restart');
  const playPause = control('game.play', '▶', () => (timer === undefined ? play() : pause()), 'run-play');
  const step = control('game.step', '→', () => (pause(), go(index + 1)), 'run-step');
  const toEnd = control('game.end', '⇥', () => (pause(), go(Infinity)), 'run-end');
  const vars = h('p', { class: 'vars', 'data-testid': 'vars' });

  // ---------------------------------------------------------------- the lines
  const list = h('ol', { class: 'order-lines code', 'aria-label': t('order.lines'), 'data-testid': 'lines' });
  /** The row of each line, in the order shown. */
  let rows: HTMLElement[] = [];

  function drawLines(focusMoved?: { line: number; dir: 'up' | 'down' }) {
    rows = order.map((lineIndex, at) => {
      const text = level.lines[lineIndex]!;
      const code = h('code', { class: 'hljs language-python order-code' });
      // highlight.js escapes the source, so its HTML output is safe to insert.
      code.innerHTML = highlight(text);
      const move = (dir: 'up' | 'down') =>
        h(
          'button',
          {
            class: `order-move ${dir}`,
            'data-testid': `line-${at + 1}-${dir}`,
            'aria-label': t(dir === 'up' ? 'order.up' : 'order.down', { n: at + 1 }),
            title: t(dir === 'up' ? 'order.up' : 'order.down', { n: at + 1 }),
            disabled: dir === 'up' ? at === 0 : at === order.length - 1,
            onclick: () => moveLine(at, dir),
          },
          dir === 'up' ? '▲' : '▼',
        );
      return h('li', { class: 'order-line', 'data-testid': `line-${at + 1}` }, h('span', { class: 'order-number', 'aria-hidden': 'true' }, String(at + 1)), code, move('up'), move('down'));
    });
    list.replaceChildren(...rows);
    if (focusMoved) {
      // Keep the focus on the line that moved, so it can be moved again at once.
      const button = list.querySelector<HTMLButtonElement>(`[data-testid="line-${focusMoved.line}-${focusMoved.dir}"]`);
      (button && !button.disabled ? button : list.querySelector<HTMLButtonElement>(`[data-testid="line-${focusMoved.line}-${focusMoved.dir === 'up' ? 'down' : 'up'}"]`))?.focus();
    }
  }

  function moveLine(at: number, dir: 'up' | 'down') {
    const to = dir === 'up' ? at - 1 : at + 1;
    if (to < 0 || to >= order.length) return;
    [order[at], order[to]] = [order[to]!, order[at]!];
    order = [...order];
    game.arrange(order);
    stopRun();
    drawLines({ line: to + 1, dir });
  }

  const runButton = h('button', { class: 'primary order-run', 'data-testid': 'run', onclick: () => runProgram() }, `▶ ${t('order.run')}`);
  const feedback = h('section', { class: 'feedback', 'aria-live': 'polite', tabindex: -1, 'data-testid': 'feedback' });
  feedback.dataset.task = t('order.task');

  const heading = h('h2', { class: 'level-title', tabindex: -1 }, `${t('game.level', { n: levelIndex + 1 })}: ${level.title[lang]}`);
  const root = h(
    'main',
    { class: 'screen game order' },
    h('div', { class: 'game-bar' }, subpageHeader(app, t('lesson.order.title')), strip),
    h(
      'div',
      { class: 'stage', 'data-testid': 'stage' },
      h(
        'div',
        { class: 'arena-box', style: `--ratio: ${pool.ratio}` },
        pool.root,
        h(
          'details',
          { class: 'info' },
          h('summary', {}, heading),
          h('div', { class: 'info-body' }, h('div', { class: 'intro' }, ...richText(level.intro[lang])), ...huntInfo(t)),
        ),
      ),
      h(
        'div',
        { class: 'run' },
        position,
        h('div', { class: 'run-controls', role: 'group', 'aria-label': t('game.controls') }, restart, playPause, step, toEnd),
      ),
      vars,
    ),
    h('div', { class: 'order-slot' }, list),
    runButton,
    feedback,
  );

  // ---------------------------------------------------------------- the run
  let trace: HuntTrace | undefined;
  let index = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  let finishedShown = false;
  let glide = 0;

  function render() {
    const steps = trace?.steps ?? [start];
    const snap = steps[index]!;
    const last = index === steps.length - 1;
    pool.show(snap, last && trace ? trace.outcome : undefined, glide);
    for (const [i, row] of rows.entries()) row.classList.toggle('focus', trace !== undefined && snap.line === i + 1);
    const counter = { n: index + 1, total: steps.length };
    position.textContent = !trace
      ? t('order.idle')
      : snap.line === null
        ? t('game.finished', counter)
        : t('game.position', { ...counter, line: snap.line });
    vars.replaceChildren(
      h('span', { class: 'vars-label' }, `${t('game.vars')}: `),
      ...(snap.vars.length === 0
        ? [h('span', { class: 'vars-none' }, t('game.noVars'))]
        : snap.vars.flatMap(([name, value], i) => [i > 0 ? ' ' : '', h('code', {}, `${name} = ${value}`)])),
    );
    const disabled = trace === undefined;
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
    if (!trace) return;
    glide = timer !== undefined ? STEP_MS[app.services.storage.gameSpeed()] * 0.8 : to === index + 1 ? 300 : 0;
    index = Math.max(0, Math.min(to, trace.steps.length - 1));
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

  /** Back to the level as it starts, e.g. after a line moved. */
  function stopRun() {
    pause();
    trace = undefined;
    index = 0;
    glide = 0;
    finishedShown = false;
    feedback.replaceChildren();
    render();
  }

  function runProgram() {
    pause();
    trace = simulateHunt(world, arrange(level, order));
    game.ran(trace.outcome.kind === 'success');
    index = 0;
    glide = 0;
    finishedShown = false;
    feedback.replaceChildren();
    root.querySelector('.info')?.removeAttribute('open');
    // Plays the run; one that stops at once (e.g. a Python error) shows its outcome straight away.
    go(0, true);
  }

  function finish() {
    if (!trace) return;
    finishedShown = true;
    const won = trace.outcome.kind === 'success';
    const parts: Node[] = [
      h('p', { class: `verdict ${won ? 'correct' : 'wrong'}`, 'data-testid': 'outcome' }, huntOutcomeText(trace.outcome, t)),
    ];
    if (won) {
      strip.querySelector('[aria-current]')?.classList.add('solved');
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
      parts.push(h('div', { class: 'explanation' }, ...richText(`${t('order.hint')} ${level.hint[lang]}`)));
    }
    feedback.replaceChildren(...parts);
  }

  drawLines();
  render();

  const current = strip.querySelector<HTMLElement>('[aria-current]');
  requestAnimationFrame(() => {
    if (current) strip.scrollLeft = current.offsetLeft - (strip.clientWidth - current.offsetWidth) / 2;
  });

  return { root, focus: heading, dispose: () => pause() };
}
