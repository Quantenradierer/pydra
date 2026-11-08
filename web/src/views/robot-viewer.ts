import { h } from '../dom.ts';
import type { MessageKey, Params } from '../i18n.ts';
import type { BattleResult } from '../robot/battle.ts';
import { describeMotion, narrateEvents } from '../robot/narration.ts';
import { describeFrame, drawFrame, type Callout } from '../robot/replay.ts';
import { buildBeats, nextBeat, prevBeat, stackNames, stateAt, type Beat, type LineHint } from '../robot/stepper.ts';

type T = (key: MessageKey, params?: Params) => string;

/** Milliseconds per step at each speed level (1 = very slow, the default). */
export const SPEED_MS = [0, 1800, 1100, 600, 250, 60] as const;
export const MAX_SPEED = SPEED_MS.length - 1;

/** The speed lives outside the viewer so that it stays when the next fight of the queue loads. */
export interface Speed {
  level: number;
}

export interface ViewerOptions {
  t: T;
  speed: Speed;
  trail?: ReadonlySet<string>;
  /** The viewer reached its last step; `byPlay` is true when playing got there by itself. */
  onEnd?: (byPlay: boolean) => void;
  /** The user pressed one of the controls. */
  onUser?: () => void;
}

export interface Viewer {
  el: HTMLElement;
  atEnd(): boolean;
  play(): void;
  pause(): void;
  playing(): boolean;
  dispose(): void;
}

/** A hint for the end of a code line: `distance() → 3 · d = 3`, `✓ wahr`, ... */
function hintText(hint: LineHint, t: T): { text: string; branch?: 'true' | 'false' } {
  const parts: string[] = [];
  let branch: 'true' | 'false' | undefined;
  if (hint.call) parts.push(hint.call);
  const b = hint.branch;
  if (b) {
    branch = b.taken ? 'true' : 'false';
    const word = t(b.taken ? 'robot.hint.true' : 'robot.hint.false');
    parts.push(b.kind === 'for' ? (b.taken ? `#${b.n} = ${b.value}` : '✓') : `${b.taken ? '✓' : '✗'} ${word}${b.kind === 'while' && b.taken ? ` #${b.n}` : ''}`);
  }
  if (hint.set) parts.push(hint.set);
  return { text: parts.join(' · '), ...(branch ? { branch } : {}) };
}

/**
 * The line-by-line viewer: the script with the running line and value hints,
 * the arena with the calls and their effect, variables, call stack, what the
 * line does in words, and the controls (play, step a line, step a tick, speed).
 */
export function createViewer(battle: BattleResult, script: string, o: ViewerOptions): Viewer {
  const { t, speed } = o;
  const frames = battle.frames;
  const beats = buildBeats(frames);
  const lastBeat = beats.length - 1;
  const lastTick = frames.length - 1;
  const source = script.split('\n');
  let index = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let playedToEnd = false;

  const canvas = h('canvas', { class: 'robot-canvas', role: 'img', 'aria-label': t('robot.canvas'), 'data-testid': 'robot-canvas' }) as HTMLCanvasElement;
  const position = h('p', { class: 'run-position', 'data-testid': 'robot-position', 'aria-live': 'off' });
  const where = h('p', { class: 'robot-where', 'data-testid': 'robot-where', 'aria-live': 'off' });
  const listing = h('ol', { class: 'robot-listing', 'data-testid': 'robot-listing' }, ...source.map((l, i) => h('li', { 'data-line': String(i + 1) }, h('code', {}, l || ' '), h('span', { class: 'robot-hint' }))));
  const narration = h('ul', { class: 'robot-narration', 'data-testid': 'robot-narration', 'aria-live': 'polite' });
  const vars = h('ul', { class: 'robot-vars', 'data-testid': 'robot-vars' });
  const stack = h('ol', { class: 'robot-stack', 'data-testid': 'robot-stack' });
  const sensors = h('ul', { class: 'robot-sensors', 'data-testid': 'robot-sensors' });
  const log = h('ul', { class: 'robot-log', 'data-testid': 'robot-log' });
  const slider = h('input', { type: 'range', min: 0, max: lastBeat, value: 0, 'aria-label': t('robot.replay'), 'data-testid': 'robot-slider' }) as HTMLInputElement;
  const playBtn = h('button', { class: 'run-control robot-play', 'data-testid': 'robot-play' }, t('robot.play'));
  const speedLabel = h('span', { class: 'robot-speed-label', 'data-testid': 'robot-speed-label' });
  const speedSlider = h('input', { type: 'range', min: 1, max: MAX_SPEED, value: speed.level, 'aria-label': t('robot.speed'), 'data-testid': 'robot-speed' }) as HTMLInputElement;

  /** The calls to put on the arena: the ones of this line, or the tick's command once it plays out. */
  function calloutsOf(beat: Beat): Callout[] {
    const calls = (beat.kind === 'resolve' ? (frames[beat.tick]?.trace ?? []).filter((e) => e.k === 'call' && e.kind === 'action').slice(-1) : beat.events).filter((e) => e.k === 'call');
    return calls.flatMap((e) => (e.k === 'call' ? [{ kind: e.kind, text: e.result !== undefined && e.kind === 'sensor' ? `${e.fn}(${e.args.join(', ')}) → ${e.result}` : `${e.fn}(${e.args.join(', ')})` }] : [])).slice(-3);
  }

  function render() {
    const beat = beats[index]!;
    const state = stateAt(beats, index);
    const before = index > 0 ? stateAt(beats, index - 1) : state;

    // The arena: a line shows the world as it was when the tick began; the resolve beat plays the action out.
    const resolved = beat.kind === 'resolve' || beat.after === true || beat.kind === 'start';
    const frameIndex = beat.kind === 'line' && !beat.after ? beat.tick - 1 : beat.tick;
    drawFrame(canvas, battle, frameIndex, o.trail, { callouts: calloutsOf(beat), ...(beat.kind === 'resolve' ? { prev: frames[beat.tick - 1]! } : {}), ...(resolved ? {} : { quiet: true }) });

    position.textContent = t('robot.tick', { n: beat.tick, total: lastTick });
    where.textContent = beat.kind === 'start' ? t('robot.where.start', { total: lastBeat }) : beat.kind === 'resolve' ? t('robot.where.arena', { tick: beat.tick, n: index, total: lastBeat }) : t('robot.where', { line: beat.line ?? 0, n: index, total: lastBeat });
    slider.value = String(index);

    // The code: the running line, and what each line that ran produced.
    const active = beat.line;
    for (const li of listing.children) {
      const n = Number(li.getAttribute('data-line'));
      const hint = state.hints.get(n);
      const shown = hint ? hintText(hint, t) : { text: '' };
      li.classList.toggle('active', active != null && n === active);
      li.classList.toggle('branch-true', shown.branch === 'true');
      li.classList.toggle('branch-false', shown.branch === 'false');
      li.classList.toggle('seen', hint !== undefined);
      li.querySelector('.robot-hint')!.textContent = shown.text;
    }
    listing.dataset.active = active == null ? '' : String(active);

    // In words: what this line did.
    const sentences = beat.kind === 'start' ? [t('robot.narr.start')] : beat.kind === 'resolve' ? [t('robot.narr.resolve'), ...describeMotion(frames[beat.tick - 1], frames[beat.tick]!, t)] : narrateEvents(beat.events, t);
    narration.replaceChildren(
      ...(beat.kind === 'line' && active != null ? [h('li', { class: 'robot-narration-line' }, h('code', {}, `${t('robot.line', { line: active })}: ${(source[active - 1] ?? '').trim()}`))] : []),
      ...sentences.map((s) => h('li', {}, s)),
    );

    // Variables (the changed ones stand out) and the call stack.
    const was = new Map(before.globals.concat(...before.stack.map((f) => f.vars)));
    const chip = ([name, value]: [string, string]) => h('li', { class: was.get(name) !== value ? 'changed' : '' }, h('code', {}, `${name} = ${value}`));
    const shownVars = [...state.globals, ...(state.stack.at(-1)?.vars ?? [])];
    vars.replaceChildren(...(shownVars.length > 0 ? shownVars.map(chip) : [h('li', { class: 'robot-none' }, t('robot.vars.none'))]));
    const names = stackNames(state);
    stack.replaceChildren(...[t('robot.stack.main'), ...names].map((n, i, all) => h('li', { class: i === all.length - 1 ? 'top' : '' }, h('code', {}, n))));

    // Sensors and say() of this tick so far, and the outcome of the tick once it resolved.
    const calls = beats.filter((b, i) => i <= index && b.tick === beat.tick && b.kind === 'line').flatMap((b) => b.events).filter((e) => e.k === 'call' && e.kind !== 'action');
    sensors.replaceChildren(...calls.map((e) => h('li', {}, h('code', {}, e.k === 'call' ? `${e.fn}(${e.args.join(', ')}) → ${e.result}` : ''))));
    log.replaceChildren(...(resolved && beat.kind !== 'start' ? describeFrame(frames[beat.tick]!, t) : []).map((s) => h('li', {}, s)));
    speedLabel.textContent = t(`robot.speed.${speed.level}` as MessageKey);
  }

  function ended(byPlay: boolean) {
    if (!playedToEnd) {
      playedToEnd = true;
      o.onEnd?.(byPlay);
    }
  }
  function go(i: number) {
    index = Math.max(0, Math.min(lastBeat, i));
    if (index < lastBeat) playedToEnd = false;
    render();
    if (index >= lastBeat) ended(false);
  }
  function pause() {
    if (timer) clearTimeout(timer);
    timer = undefined;
    playBtn.textContent = t('robot.play');
  }
  function tickOn() {
    timer = setTimeout(() => {
      timer = undefined;
      if (index >= lastBeat) {
        pause();
        return;
      }
      index = nextBeat(beats, index, 'line');
      if (index >= lastBeat) {
        pause();
        playedToEnd = false;
        render();
        ended(true);
        return;
      }
      render();
      tickOn();
    }, SPEED_MS[speed.level]);
  }
  function play() {
    if (timer) return;
    if (index >= lastBeat) go(0);
    playBtn.textContent = t('robot.pause');
    tickOn();
  }

  playBtn.addEventListener('click', () => (o.onUser?.(), timer ? pause() : play()));
  slider.addEventListener('input', () => (o.onUser?.(), pause(), go(Number(slider.value))));
  speedSlider.addEventListener('input', () => {
    speed.level = Number(speedSlider.value);
    speedLabel.textContent = t(`robot.speed.${speed.level}` as MessageKey);
  });
  const btn = (label: MessageKey, id: string, fn: () => void) => h('button', { class: 'run-control', 'data-testid': id, onclick: () => (pause(), fn()) }, t(label));
  render();
  playedToEnd = index >= lastBeat;

  const el = h(
    'section',
    { class: 'robot-replay', 'aria-label': t('robot.replay') },
    h('div', { class: 'robot-stage' }, h('div', { class: 'robot-arena' }, canvas, h('div', { class: 'robot-counter' }, position, where)), h('div', { class: 'robot-side-panel' }, h('h3', {}, t('robot.code')), listing)),
    h(
      'div',
      { class: 'run-controls robot-controls' },
      btn('robot.restart', 'robot-restart', () => go(0)),
      btn('robot.step.lineBack', 'robot-line-back', () => go(prevBeat(beats, index, 'line'))),
      btn('robot.back', 'robot-back', () => go(prevBeat(beats, index, 'tick'))),
      playBtn,
      btn('robot.step.line', 'robot-line-forward', () => go(nextBeat(beats, index, 'line'))),
      btn('robot.forward', 'robot-forward', () => go(nextBeat(beats, index, 'tick'))),
      btn('robot.end', 'robot-end', () => go(lastBeat)),
    ),
    h('label', { class: 'robot-speed' }, h('span', {}, `${t('robot.speed')}: `), speedSlider, speedLabel),
    slider,
    h('div', { class: 'robot-explain' }, h('h3', {}, t('robot.narr.title')), narration),
    h('div', { class: 'robot-cols' }, h('div', {}, h('h3', {}, t('robot.vars')), vars), h('div', {}, h('h3', {}, t('robot.stack')), stack)),
    h('div', { class: 'robot-cols' }, h('div', {}, h('h3', {}, t('robot.sensors')), sensors), h('div', {}, h('h3', {}, t('robot.log')), log)),
  );
  return { el, atEnd: () => index >= lastBeat, play, pause, playing: () => timer !== undefined, dispose: pause };
}
