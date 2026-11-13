import type { App, Screen } from '../app.ts';
import { h, svg } from '../dom.ts';
import { BACK } from '../icons.ts';
import type { MessageKey, Params } from '../i18n.ts';
import { BUILDING_NAMES, BUILDINGS, numberOf, type Challenge, type ChallengeId } from '../elevator/challenges.ts';
import { goalText, problemText, seconds, verdictText } from '../elevator/friendly.ts';
import { startState, type JudgeResult } from '../elevator/game.ts';
import { lineRef, problemLine, type Call } from '../elevator/run.ts';
import { createScene, DOOR_TICKS, type LiftScene } from '../elevator/scene.ts';
import { TICKS_PER_SECOND, type BuildingSnapshot } from '../elevator/sim.ts';
import { liftSuggestions } from '../elevator/suggest.ts';
import { createEditor } from './robot-editor.ts';
import { subpageHeader } from './header.ts';

type T = (key: MessageKey, params?: Params) => string;

/** Playback speeds: simulated seconds per real second. */
const SPEEDS = [1, 2, 5, 10] as const;
const DEFAULT_SPEED = 1;

/** A small outline of each building type for the list's headings (drawn in the heading's text colour). */
const BUILDING_ICONS: Record<string, string> = {
  house: '<path d="M3 11 12 3l9 8"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-5h4v5"/><path d="M16 6V3.5h2.5V8"/>',
  school: '<path d="M2 11l3-4h14l3 4"/><path d="M10 7V4l2-2 2 2v3"/><path d="M4 11v10h16V11"/><circle cx="12" cy="13" r="2"/><path d="M7 21v-3M17 21v-3"/>',
  highrise: '<path d="M7 21V6h10v15"/><path d="M9 6V3h4v3"/><path d="M10 9h1M13 9h1M10 12h1M13 12h1M10 15h1M13 15h1M10 18h1M13 18h1"/><path d="M3 21h18"/>',
};
const buildingIcon = (b: string) =>
  svg(`<svg class="lift-group-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${BUILDING_ICONS[b] ?? ''}</svg>`);

const STAT_KEYS = ['transported', 'elapsed', 'rate', 'avgWait', 'maxWait', 'moves'] as const;

/** Fills a code listing: one item per line, numbered like the editor. */
function fillListing(ol: HTMLElement, text: string) {
  ol.replaceChildren(...text.split('\n').map((l, i) => h('li', { 'data-line': String(i + 1) }, h('code', {}, l || ' '), h('span', { class: 'robot-note-inline' }))));
}

interface ViewerParts {
  scene: LiftScene;
  listing: HTMLElement;
  stats: Record<(typeof STAT_KEYS)[number], HTMLElement>;
  caption: HTMLElement;
  position: HTMLElement;
  controls: HTMLElement;
  goal: HTMLElement;
}

interface LiftViewer {
  play(): void;
  toEnd(): void;
  dispose(): void;
}

/** The stats panel for a snapshot, Elevator Saga's six numbers; a number turns red once its limit is broken. */
function paintStats(stats: ViewerParts['stats'], s: BuildingSnapshot, lang: App['lang'], over: Partial<Record<(typeof STAT_KEYS)[number], boolean>> = {}) {
  const st = s.stats;
  stats.transported.textContent = String(st.transported);
  stats.elapsed.textContent = `${seconds(st.elapsed, lang)} s`;
  stats.rate.textContent = (st.elapsed > 0 ? st.transported / st.elapsed : 0).toFixed(2).replace('.', lang === 'de' ? ',' : '.');
  stats.avgWait.textContent = `${seconds(st.avgWait, lang)} s`;
  stats.maxWait.textContent = `${seconds(st.maxWait, lang)} s`;
  stats.moves.textContent = String(st.moves);
  for (const k of STAT_KEYS) stats[k].classList.toggle('over', !!over[k]);
}

/** How long the crash takes on screen (whatever the speed). */
const CRASH_MS = 2200;
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Plays a judged run back in time: the building moves at the chosen speed. Whenever the learner's code ran (a run for an
 * idle car, or a handler), the building waits and the code is stepped through line by line: the running line marked,
 * the floors `go_to_floor` got and how each `if` went noted as they happen, the caption saying what ran and what it told
 * the cars so far. A run that crashed is stepped up to the line that crashes, then the crash plays.
 */
function createLiftViewer(t: T, lang: App['lang'], r: JudgeResult, goal: Challenge['goal'], text: string, parts: ViewerParts, speed: { level: number }, onEnd: () => void): LiftViewer {
  const frames = r.frames;
  const last = frames.length - 1;
  const crashed = r.crashed && r.crashed.length > 0 ? r.crashed : undefined;
  const multi = (frames[0]?.cars.length ?? 1) > 1;
  const where = r.problem?.kind === 'no-floor' ? r.problem.where : 'fall';
  const look = { passengers: r.passengers, ...(goal.maxWait !== undefined ? { lateAfter: goal.maxWait * TICKS_PER_SECOND } : {}) };
  const calls = r.calls;
  const lines = [...parts.listing.children] as HTMLElement[];
  const defLine = (handler: string) => text.split('\n').findIndex((l) => new RegExp(`^def\\s+${handler}\\b`).test(l)) + 1;
  // Where each car's stops start and end (per tick), so its doors can slide open and shut.
  const stopRuns = (frames[0]?.cars ?? []).map((_, i) => {
    const n = frames.length;
    const from = new Int32Array(n).fill(-1);
    const to = new Int32Array(n).fill(-1);
    const stopped = (k: number) => frames[k]!.cars[i]!.state === 'stopped';
    for (let k = 0; k < n; k++) if (stopped(k)) from[k] = k > 0 && stopped(k - 1) ? from[k - 1]! : k;
    for (let k = n - 1; k >= 0; k--) if (stopped(k)) to[k] = k < n - 1 && stopped(k + 1) ? to[k + 1]! : k;
    return { from, to };
  });
  const doorsAt = (tick: number, p: number) =>
    stopRuns.map(({ from, to }) => {
      if (from[tick]! < 0) return 0;
      // A stop that lasts to the end of the run keeps its doors open.
      const closing = to[tick] === last ? Infinity : to[tick]! + 1 - p;
      return Math.max(0, Math.min(1, Math.min(p - from[tick]!, closing) / DOOR_TICKS));
    });
  /** The lines a call ran, in order (the learner's own lines; the fixed line is not stepped through). */
  const steps = calls.map((c) => {
    const out: { line: number; upTo: number }[] = [];
    (c.trace ?? []).forEach((ev, i) => {
      if (ev.k === 'line' && lineRef(ev.line).part === 'own') out.push({ line: ev.line, upTo: i });
    });
    // Each step also shows what its line did (the calls and branches until the next line).
    return out.map((st, k) => ({ line: st.line, upTo: k + 1 < out.length ? out[k + 1]!.upTo : (c.trace ?? []).length }));
  });
  /** Real milliseconds per line at 1×. */
  const STEP_MS = 450;
  let pos = 0;
  /** The next call to step through (all calls before it are done), and the line within it. */
  let ci = 0;
  let si = 0;
  let stepClock = 0;
  let crashP = 0;
  let raf: number | undefined;
  let lastTime = 0;
  let ended = false;
  let shown = '';

  /** Skips calls that ran no line of the learner's own (nothing to show). */
  const settle = () => {
    while (ci < calls.length && steps[ci]!.length === 0 && calls[ci]!.tick <= pos) (ci++, (si = 0));
  };
  const stepping = () => ci < calls.length && calls[ci]!.tick <= pos;
  /** All calls stepped through and the building at its last moment. */
  const atEndNow = () => pos >= last && ci >= calls.length;

  function paintListing(call: Call | undefined, upTo: number, active: number[], atEnd: boolean) {
    const notes = new Map<number, string[]>();
    const seen = new Set<number>();
    const branch = new Map<number, boolean>();
    /** The value a `for` line gave its loop variable last (`floor = 3`). */
    const loopValue = new Map<number, string>();
    // A run that waited at a stop goes on in a later call: its loops keep the values from its earlier parts.
    if (call && call.handler === null && call.after !== undefined) {
      const earlier: Call[] = [];
      for (let i = calls.indexOf(call) - 1; i >= 0; i--) {
        const c = calls[i]!;
        if (c.handler !== null || c.car !== call.car) continue;
        earlier.unshift(c);
        if (c.after === undefined) break;
      }
      for (const c of earlier)
        for (const ev of c.trace ?? []) if (ev.k === 'branch' && ev.kind === 'for' && ev.taken && ev.value !== undefined && lineRef(ev.line).part === 'own') loopValue.set(ev.line, ev.value);
    }
    (call?.trace ?? []).slice(0, upTo).forEach((ev) => {
      if (ev.k === 'line' && lineRef(ev.line).part === 'own') seen.add(ev.line);
      if (ev.k === 'call' && ev.fn.endsWith('go_to_floor') && lineRef(ev.line).part === 'own') notes.set(ev.line, [...(notes.get(ev.line) ?? []), ev.args[0] ?? '']);
      if (ev.k === 'branch' && ev.kind === 'if' && lineRef(ev.line).part === 'own') branch.set(ev.line, ev.taken);
      if (ev.k === 'branch' && ev.kind === 'for' && ev.taken && ev.value !== undefined && lineRef(ev.line).part === 'own') loopValue.set(ev.line, ev.value);
    });
    const def = call?.handler ? defLine(call.handler) : 0;
    const errorLine = atEnd && r.problem ? problemLine(r.problem) : undefined;
    for (const li of lines) {
      const n = Number(li.dataset.line);
      const b = branch.get(n);
      li.classList.toggle('seen', seen.has(n));
      li.classList.toggle('active', active.includes(n));
      li.classList.toggle('fw-calling', n === def && !active.includes(n));
      li.classList.toggle('error', errorLine !== undefined && lineRef(errorLine).part === 'own' && lineRef(errorLine).line === n);
      li.classList.toggle('branch-true', b === true);
      li.classList.toggle('branch-false', b === false);
      const note = notes.get(n);
      const value = loopValue.get(n);
      const loopVar = value !== undefined ? /^\s*for\s+([A-Za-z_]\w*)\s+in\b/.exec(li.textContent ?? '')?.[1] : undefined;
      li.querySelector('.robot-note-inline')!.textContent =
        n === def && call && call.args.length > 0
          ? `← ${call.args.join(', ')}`
          : note
            ? `→ ${note.join(', ')}`
            : b !== undefined
              ? b ? 'True' : 'False'
              : loopVar
                ? `${loopVar} = ${value}`
                : '';
    }
    lines.find((li) => li.classList.contains('active'))?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  /** Where each car is driving to or stopped at, and the line (of the latest call before `tick`) that put that floor on its list. */
  function targetsAt(s: BuildingSnapshot, tick: number): { car: number; floor: number; state: 'moving' | 'stopped'; line: number; call: Call }[] {
    const out: { car: number; floor: number; state: 'moving' | 'stopped'; line: number; call: Call }[] = [];
    s.cars.forEach((c, i) => {
      // A car standing with a floor on its list is about to set off: it counts as on its way.
      const leaving = c.state === 'idle' && c.queue.length > 0;
      if (c.state !== 'moving' && c.state !== 'stopped' && !leaving) return;
      const floor = c.state === 'stopped' ? Math.round(c.pos) : c.queue[0];
      if (floor === undefined) return;
      for (let k = calls.length - 1; k >= 0; k--) {
        const call = calls[k]!;
        if (call.tick > tick) continue;
        const sent = call.sent?.findLast((x) => x.car === i && x.floor === floor);
        if (sent && lineRef(sent.line).part === 'own') {
          out.push({ car: i, floor, state: c.state === 'stopped' ? 'stopped' : 'moving', line: sent.line, call });
          return;
        }
      }
    });
    return out;
  }
  const targetText = (x: { car: number; floor: number; state: 'moving' | 'stopped'; line: number }) =>
    t(x.state === 'moving' ? 'elevator.cap.driving' : 'elevator.cap.stopped', { car: carName(x.car), floor: x.floor, line: lineRef(x.line).line });

  /** The snapshot with every car's list as it was after the lines of `call` up to a point of its trace. */
  const listsAt = (call: Call, upTo: number, s: BuildingSnapshot): BuildingSnapshot => {
    if (!call.before || !call.sent) return s;
    const queues = call.before.map((q) => [...q]);
    for (const x of call.sent) if (x.at < upTo && !queues[x.car]!.includes(x.floor)) queues[x.car]!.push(x.floor);
    return { ...s, cars: s.cars.map((c, i) => ({ ...c, queue: queues[i] ?? c.queue })) };
  };

  /** The car commands a call gave up to a point of its trace. */
  const commandsUpTo = (call: Call, upTo: number) =>
    (call.trace ?? []).slice(0, upTo).flatMap((ev) => (ev.k === 'call' && ev.fn.endsWith('go_to_floor') ? [`${multi ? ev.fn : 'elevator.go_to_floor'}(${ev.args.join(', ')})`] : []));
  const carName = (i: number) => (multi ? `elevators[${i}]` : 'elevator');

  /** The caption shows what ran; mistakes and the verdict are shown once, in the result box. */
  function caption(call: Call | undefined, commands: string[], site: boolean): { text: string; error?: boolean } {
    if (site) return { text: t('elevator.cap.site'), error: true };
    if (!call) return { text: t('elevator.cap.begin') };
    const at = seconds(call.tick / TICKS_PER_SECOND, lang);
    const head = call.handler
      ? t('elevator.cap.call', { time: at, call: `${call.handler}(${call.args.join(', ')})` })
      : call.after !== undefined
        ? t('elevator.cap.resume', { time: at, car: carName(call.car ?? 0), floor: call.after })
        : t('elevator.cap.run', { time: at, car: carName(call.car ?? 0) });
    const what = commands.length > 0 ? t('elevator.cap.commands', { list: commands.join(', ') }) : '';
    return { text: what ? `${head} ${what}` : head };
  }

  function render() {
    settle();
    const tick = Math.min(last, Math.floor(pos));
    const frac = stepping() ? 0 : pos - tick;
    const atEnd = atEndNow();
    // While a call is stepped through, the lists under the shafts show what the lines so far put on them.
    const inCall = stepping() && si < steps[ci]!.length;
    const frame = inCall ? listsAt(calls[ci]!, steps[ci]![si]!.upTo, frames[tick]!) : frames[tick]!;
    if (crashed && atEnd) parts.scene.crash(frame, look, crashed, where, crashP);
    else parts.scene.show(frame, look, tick < last ? frames[tick + 1] : undefined, frac, doorsAt(tick, Math.min(pos, last + 1)));
    const missed = (m: string) => atEnd && r.misses.includes(m as never);
    paintStats(parts.stats, frame, lang, {
      moves: r.broken.moves !== undefined && tick >= r.broken.moves,
      maxWait: r.broken.wait !== undefined && tick >= r.broken.wait,
      transported: missed('time'),
      elapsed: missed('time'),
    });
    // The code: while a call is stepped through, its running line. Otherwise the line that sent each car where it is
    // driving to (or stopped at), so the code stays in step with the building; with no car on its way, the last call.
    const targets = inCall ? [] : targetsAt(frame, tick);
    const call = inCall ? calls[ci] : (targets[0]?.call ?? calls[ci - 1]);
    const step = inCall ? steps[ci]![si]! : undefined;
    const upTo = step ? step.upTo : (call?.trace?.length ?? 0);
    const site = frame.cars.some((c) => c.site) && !!goal.noSiteStops;
    const key = `${inCall ? ci : ci - 1}|${inCall ? si : -1}|${targets.map((x) => `${x.car}:${x.floor}:${x.state}:${x.line}`).join(',')}|${atEnd}|${site}`;
    if (key !== shown) {
      shown = key;
      const active = step ? [step.line] : targets.filter((x) => x.call === call).map((x) => x.line);
      paintListing(call, upTo, active, atEnd);
      const cap = targets.length > 0 && !atEnd && !site ? { text: targets.map(targetText).join(' · ') } : caption(call, call ? (step ? commandsUpTo(call, upTo) : call.commands) : [], site);
      parts.caption.textContent = cap.text;
      parts.caption.classList.toggle('error', !!cap.error);
    }
    const finished = atEnd && (!crashed || crashP >= 1);
    parts.goal.classList.toggle('met', finished && r.passed);

    parts.position.textContent = t('elevator.position', { time: seconds(tick / TICKS_PER_SECOND, lang), total: seconds(last / TICKS_PER_SECOND, lang) });
    for (const b of back) b.disabled = pos <= 0 && ci === 0 && si === 0;
    for (const b of forward) b.disabled = atEnd;
    if (finished && !ended) {
      ended = true;
      onEnd();
    }
  }

  /** One line further in the call being stepped through; past its last line the call is done. */
  function advanceStep() {
    si++;
    if (si >= steps[ci]!.length) {
      ci++;
      si = 0;
    }
  }

  function loop(now: number) {
    const dt = lastTime ? Math.min(100, now - lastTime) : 0;
    lastTime = now;
    const factor = SPEEDS[speed.level]!;
    settle();
    if (stepping()) {
      // The building waits while the code runs, line by line.
      stepClock += dt * factor;
      while (stepClock >= STEP_MS && stepping()) {
        stepClock -= STEP_MS;
        advanceStep();
        settle();
      }
    } else if (pos < last) {
      stepClock = 0;
      const next = ci < calls.length ? calls[ci]!.tick : last;
      pos = Math.min(next, last, pos + (dt / 1000) * TICKS_PER_SECOND * factor);
    } else if (crashed) {
      // The crash plays in real time, whatever the speed.
      crashP = reducedMotion() ? 1 : Math.min(1, crashP + dt / CRASH_MS);
    }
    render();
    if (atEndNow() && (!crashed || crashP >= 1)) return pause();
    raf = requestAnimationFrame(loop);
  }
  function pause() {
    if (raf !== undefined) cancelAnimationFrame(raf);
    raf = undefined;
    playBtn.textContent = '▶';
    playBtn.setAttribute('aria-label', t('robot.play'));
    playBtn.title = t('robot.play');
  }
  function play() {
    if (raf !== undefined) return;
    if (atEndNow() && (!crashed || crashP >= 1)) go(0);
    playBtn.textContent = '⏸';
    playBtn.setAttribute('aria-label', t('robot.pause'));
    playBtn.title = t('robot.pause');
    lastTime = 0;
    raf = requestAnimationFrame(loop);
  }
  /** Jumps to a moment: the calls from there on are stepped through again; at the end everything is done. */
  function go(p: number) {
    pos = Math.max(0, Math.min(last, p));
    const toEnd = p >= last;
    ci = toEnd ? calls.length : calls.findIndex((c) => c.tick >= pos);
    if (ci < 0) ci = calls.length;
    si = 0;
    stepClock = 0;
    crashP = toEnd ? 1 : 0;
    render();
  }
  /** One step of the code: the next line of the call being run, or the first line of the next call; after the last, the end (or the crash). */
  function nextStep() {
    settle();
    if (stepping()) advanceStep();
    else if (ci < calls.length) pos = calls[ci]!.tick;
    else if (crashed && pos < last) pos = last;
    else if (crashed) {
      crashP = 0;
      pos = last;
      render();
      return play();
    } else pos = last;
    settle();
    // A step that finished the last call of a crashed run goes on to the crash.
    if (crashed && ci >= calls.length && pos >= last && crashP < 1) {
      render();
      return play();
    }
    render();
  }

  const playBtn = h('button', { type: 'button', class: 'run-control', 'data-testid': 'lift-play', 'aria-label': t('robot.play'), title: t('robot.play') }, '▶') as HTMLButtonElement;
  playBtn.addEventListener('click', () => (raf !== undefined ? pause() : play()));
  const back: HTMLButtonElement[] = [];
  const forward: HTMLButtonElement[] = [];
  const btn = (label: MessageKey, glyph: string, id: string, fn: () => void, side: 'back' | 'forward') => {
    const b = h('button', { type: 'button', class: 'run-control', 'data-testid': id, 'aria-label': t(label), title: t(label), onclick: () => (pause(), fn()) }, glyph) as HTMLButtonElement;
    (side === 'back' ? back : forward).push(b);
    return b;
  };
  const speedBtn = h('button', { type: 'button', class: 'run-control lift-speed', 'data-testid': 'lift-speed' }) as HTMLButtonElement;
  const paintSpeed = () => {
    const word = `${SPEEDS[speed.level]}×`;
    speedBtn.textContent = `⏱ ${word}`;
    speedBtn.setAttribute('aria-label', t('elevator.speed', { speed: word }));
    speedBtn.title = t('elevator.speed', { speed: word });
  };
  speedBtn.addEventListener('click', () => {
    speed.level = (speed.level + 1) % SPEEDS.length;
    paintSpeed();
  });
  paintSpeed();
  parts.controls.replaceChildren(
    h(
      'div',
      { class: 'run-controls lift-controls' },
      btn('robot.restart', '↺', 'lift-restart', () => go(0), 'back'),
      playBtn,
      btn('elevator.nextCall', '⏭', 'lift-next-call', nextStep, 'forward'),
      btn('robot.end', '⇥', 'lift-end', () => go(last), 'forward'),
      speedBtn,
    ),
  );
  // A program that could not start: nothing to play, the end is now.
  if (r.precheck) go(last);
  else render();
  return { play, toEnd: () => (pause(), go(last)), dispose: () => pause() };
}

/** Hydra Lift: the list of challenges and the challenge page. */
export function elevatorScreen(app: App): Screen {
  const { t, lang } = app;
  const game = app.services.elevator;
  const root = h('main', { class: 'screen game lift' });
  const speed = { level: DEFAULT_SPEED };
  let cleanup: (() => void) | undefined;
  const stop = () => {
    cleanup?.();
    cleanup = undefined;
  };
  const titleOf = (c: Challenge) => `${numberOf(c.id)} · ${c.title[lang]}`;

  function show(...children: Node[]) {
    stop();
    root.replaceChildren(...children);
    window.scrollTo(0, 0);
  }

  const nextOpen = (): Challenge | undefined => game.challenges.find((c) => game.status(c.id) === 'open');

  // ---------------------------------------------------------------- the list

  function showList() {
    const item = (c: Challenge) => {
      const status = game.status(c.id);
      const best = game.best(c.id);
      const stateText = status === 'solved' ? `✓ ${t('elevator.list.solved')}${best ? ` · ${t('elevator.list.best', { time: seconds(best.elapsed, lang) })}` : ''}` : status === 'open' ? t('elevator.list.open') : t('elevator.list.locked');
      return h(
        'li',
        {},
        h(
          'button',
          {
            type: 'button',
            class: `lift-item ${status}`,
            'data-testid': `lift-challenge-${numberOf(c.id)}`,
            'data-status': status,
            disabled: status === 'locked',
            'aria-label': `${titleOf(c)}, ${stateText}`,
            onclick: () => showChallenge(c.id),
          },
          h('span', { class: 'lift-item-id' }, String(numberOf(c.id))),
          h('span', { class: 'lift-item-title' }, c.title[lang]),
          h('span', { class: 'lift-item-goal' }, `${t(c.cars === 1 ? 'elevator.list.building.one' : 'elevator.list.building.other', { floors: c.floors, cars: c.cars })} · ${goalText(c.goal, lang)}`),
          h('span', { class: 'lift-item-state', 'data-testid': `lift-state-${numberOf(c.id)}` }, stateText),
        ),
      );
    };
    const p = game.progress();
    const cur = p.current ? game.challenge(p.current) : undefined;
    const target = cur && game.status(cur.id) === 'open' ? cur : nextOpen();
    const resume = target
      ? h('button', { type: 'button', class: 'primary lift-continue', 'data-testid': 'lift-continue', onclick: () => showChallenge(target.id) }, h('small', {}, t(p.solved.length === 0 ? 'elevator.list.start' : 'elevator.list.continue')), h('span', {}, titleOf(target)))
      : null;
    // One group per building, with how many of its challenges are solved.
    const groups = BUILDINGS.map((b) => {
      const list = game.challenges.filter((c) => c.building === b);
      const done = list.filter((c) => game.status(c.id) === 'solved').length;
      return h(
        'section',
        { class: `lift-group lift-theme-${b}`, 'data-testid': `lift-building-${b}` },
        h('h2', { class: 'lift-group-title' }, buildingIcon(b), h('span', {}, BUILDING_NAMES[b][lang]), h('small', { 'data-testid': `lift-building-progress-${b}` }, t('elevator.list.progress', { done, total: list.length }))),
        h('ol', { class: 'lift-list' }, ...list.map(item)),
      );
    });
    show(
      subpageHeader(app, t('elevator.title')),
      h('p', { class: 'lift-intro' }, t('elevator.list.intro')),
      ...(resume ? [resume] : []),
      h('div', { class: 'lift-groups', 'data-testid': 'lift-list', 'aria-label': t('elevator.list.label') }, ...groups),
    );
  }

  // ---------------------------------------------------------------- a challenge

  function showChallenge(id: ChallengeId) {
    const c = game.challenge(id)!;
    if (game.status(id) === 'locked') return showList();
    game.setCurrent(id);
    const prelude = c.cars === 1;
    let state: 'idle' | 'playing' | 'passed' | 'failed' = 'idle';
    let viewer: LiftViewer | undefined;
    let next: Challenge | undefined;

    const scene = createScene({
      floors: c.floors,
      cars: c.cars,
      ...(c.closed ? { closed: c.closed } : {}),
      theme: c.building,
      name: BUILDING_NAMES[c.building][lang],
      carName: (i) => (prelude ? 'elevator' : `elevators[${i}]`),
      label: t('elevator.scene', { name: BUILDING_NAMES[c.building][lang], floors: c.floors }),
    });
    const goal = h('p', { class: 'lift-goal', 'data-testid': 'lift-goal' }, goalText(c.goal, lang));
    const task = h(
      'div',
      { class: 'lift-task' },
      h('p', { class: 'lift-task-text', 'data-testid': 'lift-task' }, c.task[lang]),
      c.newWord ? h('p', { class: 'lift-meta' }, h('span', { class: 'lift-new' }, t('elevator.new', { word: '' }).trim(), h('code', {}, c.newWord))) : null,
      goal,
    );
    const statEls = Object.fromEntries(STAT_KEYS.map((k) => [k, h('dd', { 'data-testid': `lift-stat-${k}` })])) as ViewerParts['stats'];
    const stats = h('dl', { class: 'lift-stats', 'data-testid': 'lift-stats' }, ...STAT_KEYS.flatMap((k) => [h('div', {}, h('dt', {}, t(`elevator.stat.${k}`)), statEls[k])]));
    const controls = h('div', { class: 'lift-controlrow' });
    const position = h('p', { class: 'run-position lift-position', 'data-testid': 'lift-position' });
    const caption = h('p', { class: 'lift-caption', 'data-testid': 'lift-caption', 'aria-live': 'polite' });

    // ---- the fixed first line while there is one car

    // ---- the code: the editor, or the listing while a run is shown
    const help = () =>
      c.toolbox.map((sig) => {
        const word = /(go_to_floor|current_floor|pressed_floors|waiting|on_idle|on_floor_button|on_call)/.exec(sig)?.[1] ?? 'go_to_floor';
        return { sig, desc: t(`elevator.help.${word}` as MessageKey) };
      });
    const ed = createEditor(t as (key: MessageKey) => string, game.startText(id), liftSuggestions(c, t('elevator.tools'), t('elevator.shapes')), (text) => (game.setText(id, text), toIdle()), 'lift-code', help);
    ed.area.setAttribute('aria-label', t('elevator.code'));
    ed.area.addEventListener('focus', () => toIdle());
    const listing = h('ol', { class: 'robot-listing', 'data-testid': 'lift-listing' });
    const listingHolder = h('div', { class: 'robot-listing-holder lift-listing-holder', hidden: true, role: 'button', tabindex: 0, 'aria-label': t('elevator.edit'), title: t('elevator.edit'), 'data-testid': 'lift-view-toggle' }, listing);
    const edit = () => showEditor(true);
    listingHolder.addEventListener('click', edit);
    listingHolder.addEventListener('keydown', (e) => ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') && (e.preventDefault(), edit()));
    function showEditor(on: boolean) {
      ed.el.hidden = !on;
      listingHolder.hidden = on;
      if (on) ed.area.focus();
    }

    const result = h('div', { class: 'robot-result lift-result', 'data-testid': 'lift-result', hidden: true });
    const primary = h('button', { type: 'button', class: 'primary rb-primary lift-primary' }) as HTMLButtonElement;
    function paintPrimary() {
      const [label, testId] =
        state === 'idle'
          ? [t('elevator.run'), 'lift-run']
          : state === 'playing'
            ? [t('elevator.skip'), 'lift-skip']
            : state === 'failed'
              ? [t('elevator.improve'), 'lift-improve']
              : [next ? t('elevator.next', { title: titleOf(next) }) : t('elevator.toList'), 'lift-next'];
      primary.textContent = label;
      primary.setAttribute('data-testid', testId);
      primary.dataset.state = state;
    }
    primary.addEventListener('click', () => {
      if (state === 'idle') return run();
      if (state === 'playing') return viewer?.toEnd();
      if (state === 'failed') return showEditor(true);
      if (next) showChallenge(next.id);
      else showList();
    });

    function drawStart() {
      const s = startState(c);
      scene.show(s, { passengers: [] });
      paintStats(statEls, s, lang);
      caption.textContent = '';
      caption.classList.remove('error');
      position.textContent = '';
      controls.replaceChildren();
      goal.classList.remove('met', 'missed');
    }
    /** Editing starts the next try: the run stops, the verdict goes. */
    function toIdle() {
      if (state === 'idle') return;
      viewer?.dispose();
      viewer = undefined;
      state = 'idle';
      result.hidden = true;
      paintPrimary();
      drawStart();
    }

    function verdict(r: JudgeResult): Node[] {
      const v = verdictText(r, c.goal, lang);
      return [
        h('p', { class: `verdict ${r.passed ? 'correct' : 'wrong'}`, 'data-testid': 'lift-outcome', 'data-state': r.passed ? 'passed' : 'failed' }, v.text),
        ...(v.hint ? [h('p', { class: 'lift-note', 'data-testid': 'lift-hint' }, v.hint)] : []),
      ];
    }

    function run() {
      const text = ed.area.value;
      game.setText(id, text);
      const report = game.submit(id, text, true);
      if (!report) return;
      const r = report.result;
      fillListing(listing, text);
      viewer?.dispose();
      state = 'playing';
      result.hidden = true;
      let revealed = false;
      const reveal = () => {
        if (revealed) return;
        revealed = true;
        report.award?.();
        state = r.passed ? 'passed' : 'failed';
        next = r.passed ? nextOpen() : undefined;
        result.replaceChildren(...verdict(r));
        result.hidden = false;
        paintPrimary();
        requestAnimationFrame(() => primary.scrollIntoView({ block: 'nearest' }));
      };
      viewer = createLiftViewer(t, lang, r, c.goal, text, { scene, listing, stats: statEls, caption, position, controls, goal }, speed, reveal);
      paintPrimary();
      showEditor(false);
      if (!r.precheck) viewer.play();
      requestAnimationFrame(() => scene.el.scrollIntoView({ block: 'nearest' }));
    }

    const header = h(
      'header',
      { class: 'subpage-header lift-header' },
      h('button', { type: 'button', class: 'icon-button', 'aria-label': t('nav.back'), title: t('nav.back'), 'data-testid': 'lift-back', onclick: () => showList() }, svg(BACK)),
      h('h1', { tabindex: -1, 'data-testid': 'lift-title' }, titleOf(c)),
    );
    const left = h('div', { class: 'lift-main' }, task, h('div', { class: 'lift-scene-wrap' }, scene.el), stats, h('div', { class: 'lift-controlbar' }, controls, position), caption);
    const right = h('div', { class: 'lift-code' }, ed.el, listingHolder, result, primary);
    paintPrimary();
    drawStart();
    show(h('div', { class: 'lift-work', 'data-testid': 'lift-work', 'data-challenge': id }, header, h('div', { class: 'lift-page' }, left, right)));
    cleanup = () => {
      viewer?.dispose();
      ed.dispose();
    };
    root.querySelector<HTMLElement>('[data-testid="lift-title"]')?.focus({ preventScroll: true });
  }

  showList();
  return { root, dispose: stop };
}
