import { h } from '../dom.ts';
import type { MessageKey, Params } from '../i18n.ts';
import type { BattleResult } from '../robot/battle.ts';
import { describeAction } from '../robot/narration.ts';
import { createRobotLayer } from '../robot/art/arena.ts';
import { drawFrame, type Callout } from '../robot/replay.ts';
import { buildBeats, idleRunEnd, isIdleBeat, nextBeat, stateAt, type Beat, type LineHint } from '../robot/stepper.ts';

type T = (key: MessageKey, params?: Params) => string;

/** Milliseconds per step at each speed level; level 2 (800 ms, about one step a second) is the default, slow enough to follow. */
export const SPEED_MS = [0, 1200, 800, 450, 150] as const;
export const DEFAULT_SPEED = 2;
export const MAX_SPEED = SPEED_MS.length - 1;
/** Long fights (a loop that goes on for 200 rounds) play at the fastest speed after this many steps; the first ones stay followable. */
export const SLOW_STEPS = 40;

/** The speed lives outside the viewer so that it stays when the next fight of the queue loads. */
export interface Speed {
  level: number;
}

export interface ViewerOptions {
  t: T;
  speed: Speed;
  /** The viewer reached its last step; `byPlay` is true when playing got there by itself. */
  onEnd?: (byPlay: boolean) => void;
  /** The user pressed one of the controls. */
  onUser?: () => void;
  /** Only the arena before the first fight: the controls stay disabled. */
  preview?: boolean;
}

export interface Viewer {
  /** The arena with the tick counter and "what happens now". */
  el: HTMLElement;
  /** What happens now, in words (under the controls). */
  explain: HTMLElement;
  /** The script with the running line (replaces the editor while the fight shows). */
  listing: HTMLElement;
  /** The four run controls, like in the other games: restart, play/pause, step, to the end. */
  controls: HTMLElement;
  atEnd(): boolean;
  /** Jumps to the last step (the result of the fight). */
  toEnd(): void;
  play(): void;
  pause(): void;
  playing(): boolean;
  dispose(): void;
}

/** A hint for the end of a code line: `distance() → 3 · d = 3`, `✓ wahr`, ... */
function hintText(hint: LineHint, t: T, line = ''): { text: string; branch?: 'true' | 'false' } {
  const parts: string[] = [];
  let branch: 'true' | 'false' | undefined;
  // A hint that only repeats the line (`forward()` under `forward()`) says nothing new.
  if (hint.call && hint.call !== line.trim()) parts.push(hint.call);
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
  const over = h('canvas', { class: 'robot-over', 'aria-hidden': 'true' }) as HTMLCanvasElement;
  const layer = createRobotLayer(battle, battle.tiles[0]?.length ?? 1, battle.tiles.length, (id) => (id === 'player' ? t('robot.you') : t('robot.enemy')));
  const position = h('p', { class: 'run-position', 'data-testid': 'robot-position', 'aria-live': 'off' });
  const listing = h('ol', { class: 'robot-listing', 'data-testid': 'robot-listing' }, ...source.map((l, i) => h('li', { 'data-line': String(i + 1) }, h('code', {}, l || ' '), h('span', { class: 'robot-note-inline' }))));
  const narration = h('p', { class: 'robot-narration', 'data-testid': 'robot-narration', 'aria-live': 'polite' });
  const playBtn = h('button', { class: 'run-control robot-play', 'data-testid': 'robot-play', 'aria-label': t('robot.play'), title: t('robot.play') }, '▶');

  /** The calls to put on the arena: the ones of this line, or the tick's command once it plays out. */
  function calloutsOf(beat: Beat): Callout[] {
    const calls = (beat.kind === 'resolve' ? (frames[beat.tick]?.trace ?? []).filter((e) => e.k === 'call' && e.kind === 'action').slice(-1) : beat.events).filter((e) => e.k === 'call');
    return calls.flatMap((e) => (e.k === 'call' ? [{ kind: e.kind, text: e.result !== undefined && e.kind === 'sensor' ? `${e.fn}(${e.args.join(', ')}) → ${e.result}` : `${e.fn}(${e.args.join(', ')})` }] : [])).slice(-3);
  }

  const backButtons: HTMLButtonElement[] = [];
  const forwardButtons: HTMLButtonElement[] = [];
  const idle = o.preview === true;
  function render() {
    const beat = beats[index]!;
    const state = stateAt(beats, index);

    // The arena: a line shows the world as it was when the tick began; the resolve beat plays the action out.
    const resolved = beat.kind === 'resolve' || beat.after === true || beat.kind === 'start';
    const frameIndex = beat.kind === 'line' && !beat.after ? beat.tick - 1 : beat.tick;
    drawFrame(canvas, battle, frameIndex, { over, callouts: calloutsOf(beat), ...(beat.kind === 'resolve' ? { prev: frames[beat.tick - 1]! } : {}), ...(resolved ? {} : { quiet: true }) });

    layer.update(frames[Math.min(frameIndex, lastTick)]!, beat.kind === 'resolve' ? frames[beat.tick - 1] : undefined, !resolved);
    position.textContent = t('robot.tick', { n: beat.tick, total: lastTick });
    // A control that cannot move any further is disabled instead of doing nothing.
    for (const b of backButtons) b.disabled = idle || index <= 0;
    for (const b of forwardButtons) b.disabled = idle || index >= lastBeat;
    playBtn.disabled = idle || (index >= lastBeat && !timer && lastBeat === 0);

    // The code: the running line, and what each line that ran produced.
    const active = beat.line;
    for (const li of listing.children) {
      const n = Number(li.getAttribute('data-line'));
      const hint = state.hints.get(n);
      const shown = hint ? hintText(hint, t, source[n - 1]) : { text: '' };
      li.classList.toggle('active', active != null && n === active);
      li.classList.toggle('branch-true', shown.branch === 'true');
      li.classList.toggle('branch-false', shown.branch === 'false');
      li.classList.toggle('seen', hint !== undefined);
      li.querySelector('.robot-note-inline')!.textContent = shown.text;
    }
    listing.dataset.active = active == null ? '' : String(active);

    // In words: what the action of this round did (one short line, only once it plays out).
    narration.textContent = beat.kind === 'resolve' ? (describeAction(frames[beat.tick - 1], frames[beat.tick]!, t) ?? '') : '';

    paintSpeed();
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
    playBtn.textContent = '▶';
    playBtn.setAttribute('aria-label', t('robot.play'));
    playBtn.title = t('robot.play');
  }
  /** The beat after `from`: a long wait with nothing happening (script over) is one step, not 200. */
  function advance(from: number): number {
    const next = nextBeat(beats, from, 'line');
    return isIdleBeat(beats, frames, from) ? idleRunEnd(beats, frames, next) : next;
  }
  function tickOn() {
    const wait = index >= SLOW_STEPS ? Math.min(SPEED_MS[speed.level]!, SPEED_MS[MAX_SPEED]!) : SPEED_MS[speed.level];
    timer = setTimeout(() => {
      timer = undefined;
      if (index >= lastBeat) {
        pause();
        return;
      }
      index = advance(index);
      if (index >= lastBeat) {
        pause();
        playedToEnd = false;
        render();
        ended(true);
        return;
      }
      render();
      tickOn();
    }, wait);
  }
  function play() {
    if (timer) return;
    if (index >= lastBeat) go(0);
    playBtn.textContent = '⏸';
    playBtn.setAttribute('aria-label', t('robot.pause'));
    playBtn.title = t('robot.pause');
    tickOn();
  }

  playBtn.addEventListener('click', () => (o.onUser?.(), timer ? pause() : play()));
  const speedBtn = h('button', { type: 'button', class: 'run-control robot-speed-btn', 'data-testid': 'robot-speed' }) as HTMLButtonElement;
  const paintSpeed = () => {
    const label = t('robot.speed.label', { speed: t(`robot.speed.${speed.level}` as MessageKey) });
    speedBtn.textContent = `⏱ ${t(`robot.speed.${speed.level}` as MessageKey)}`;
    speedBtn.setAttribute('aria-label', label);
    speedBtn.title = label;
  };
  speedBtn.addEventListener('click', () => {
    speed.level = speed.level >= MAX_SPEED ? 1 : speed.level + 1;
    paintSpeed();
  });
  const btn = (label: MessageKey, glyph: string, id: string, fn: () => void, side: 'back' | 'forward') => {
    const b = h('button', { class: 'run-control', 'data-testid': id, 'aria-label': t(label), title: t(label), onclick: () => (o.onUser?.(), pause(), fn()) }, glyph) as HTMLButtonElement;
    (side === 'back' ? backButtons : forwardButtons).push(b);
    return b;
  };
  const controlList = [
    btn('robot.restart', '↺', 'robot-restart', () => go(0), 'back'),
    playBtn,
    btn('robot.step', '→', 'robot-step', () => go(advance(index)), 'forward'),
    btn('robot.end', '⇥', 'robot-end', () => go(lastBeat), 'forward'),
    speedBtn,
  ];
  render();
  playedToEnd = index >= lastBeat;

  const board = h('div', { class: 'robot-board' }, canvas, layer.el, over);
  board.style.setProperty('--aspect', String((battle.tiles[0]?.length ?? 1) / Math.max(1, battle.tiles.length)));
  const el = h(
    'section',
    { class: 'robot-replay', 'aria-label': t('robot.replay') },
    h('div', { class: 'robot-arena' }, board, ...(idle ? [] : [h('div', { class: 'robot-counter' }, position)])),
  );
  const explain = h('div', { class: 'robot-explain' }, narration);
  const controls = h(
    'div',
    { class: 'run-controls robot-controls' },
    ...controlList,
  );
  return { el, explain, listing, controls, atEnd: () => index >= lastBeat, toEnd: () => (pause(), go(lastBeat)), play, pause, playing: () => timer !== undefined, dispose: pause };
}
