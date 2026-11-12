import type { App, Screen } from '../app.ts';
import { h, svg } from '../dom.ts';
import { BACK } from '../icons.ts';
import type { MessageKey, Params } from '../i18n.ts';
import { buildFactoryBeats, factoryStateAt, frameIndexOf, tidyBeats } from '../factory/beats.ts';
import { idleText, itemText, orderHint, orderText, problemText } from '../factory/friendly.ts';
import { startState, type JudgeResult } from '../factory/game.ts';
import { lessonsAbove, type Lesson, type LessonId } from '../factory/lessons.ts';
import { lineRef, MACHINES_LINE_BASE, type Frame } from '../factory/run.ts';
import { createScene, machineOf, type Scene } from '../factory/scene.ts';
import { factorySuggestions } from '../factory/suggest.ts';
import { DEFAULT_SPEED, hintText, MAX_SPEED, SLOW_STEPS, SPEED_MS, type Speed } from './robot-viewer.ts';
import { createEditor, type Editor } from './robot-editor.ts';
import { subpageHeader } from './header.ts';

type T = (key: MessageKey, params?: Params) => string;

/** The lesson graph, top row first (docs/factory.md, "The lesson graph"); a pair is grabber | smelter. */
const GRAPH_ROWS: readonly (readonly LessonId[])[] = [['B3'], ['B2'], ['B1'], ['G4', 'S4'], ['G3', 'S3'], ['G2', 'S2'], ['G1', 'S1']];
/** The lessons whose first pass gives a machine its name plate. */
const REWARDS = new Set<LessonId>(['G4', 'S4', 'B3']);

/** Fills a code listing: one item per line, numbered like the editor. */
function fillListing(ol: HTMLElement, text: string) {
  ol.replaceChildren(...text.split('\n').map((l, i) => h('li', { 'data-line': String(i + 1) }, h('code', {}, l || ' '), h('span', { class: 'robot-note-inline' }))));
}

/**
 * Scrolls the listing's own box (the holder or the machines listing) so the line shows. The page itself does not
 * move: on a phone the block stays on screen while the program runs.
 */
function keepInBox(li: HTMLElement) {
  const box = li.closest<HTMLElement>('.robot-listing-holder, .robot-listing');
  if (!box) return;
  const b = box.getBoundingClientRect();
  const r = li.getBoundingClientRect();
  if (r.top < b.top) box.scrollTop -= b.top - r.top;
  else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom;
}

interface ViewerParts {
  /** The learner's code with the running line. */
  listing: HTMLElement;
  /** "Your machines" (block lessons). */
  machines?: { details: HTMLDetailsElement; listing: HTMLElement };
  scene: Scene;
  caption: HTMLElement;
  position: HTMLElement;
  controls: HTMLElement;
}

interface ViewerOptions {
  perStart: boolean;
  /** The run passed: the order sign may be green at the very end (it is never green next to an error). */
  passed: boolean;
  /** The last step is reached: the verdict comes. */
  onEnd: () => void;
  /** ↺ on the first step: back to the code. */
  onReset: () => void;
}

interface FactoryViewer {
  pause(): void;
  toEnd(): void;
  dispose(): void;
}

/**
 * Plays one belt of a judged run step by step, in the style of Robot Battler's viewer: one step per line the
 * program runs and per command; the block on the scene, the running line in the listing (or in "Your machines"),
 * the value hints, a caption for what happened, play / pause / step / to the end / speed. It starts paused on the
 * block before the start.
 */
function createFactoryViewer(t: T, lang: App['lang'], frames: readonly Frame[], parts: ViewerParts, speed: Speed, opts: ViewerOptions): FactoryViewer {
  const { perStart, passed, onEnd, onReset } = opts;
  const ownLines = [...parts.listing.children] as HTMLElement[];
  const machineLines = parts.machines ? ([...parts.machines.listing.children] as HTMLElement[]) : [];
  const textOf = (line: number) => {
    const ref = lineRef(line);
    return (ref.part === 'own' ? ownLines : machineLines).find((li) => Number(li.dataset.line) === ref.line)?.textContent ?? '';
  };
  const beats = tidyBeats(buildFactoryBeats(frames), textOf);
  const last = beats.length - 1;
  let index = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let ended = false;

  function caption(frame: Frame, beatKind: string, isLast: boolean): { text: string; error?: boolean } {
    if (beatKind === 'start') return { text: t('factory.cap.begin') };
    if (beatKind === 'line') return { text: '' };
    const ev = frame.event;
    switch (ev.kind) {
      case 'begin':
        return { text: t('factory.cap.begin') };
      case 'start':
        return { text: t(ev.by === 'belt' ? 'factory.cap.start.belt' : 'factory.cap.start.factory', { n: frame.start, item: itemText(ev.item.kind, lang) }) };
      case 'end':
        return { text: perStart && !isLast ? t('factory.cap.endStart', { n: frame.start }) : t('factory.cap.end') };
      // The reason is the verdict's sentence (shown once); here only that the run stops at this line.
      case 'error':
        return { text: t('factory.cap.error'), error: true };
      case 'act':
        if (ev.idle) return { text: idleText(ev.idle, lang) };
        if (ev.command === 'turn') return { text: t('factory.cap.turn', { dir: t(`factory.dir.${frame.state.facing}`) }) };
        if (ev.command === 'grab') return { text: t('factory.cap.grab', { item: itemText(ev.item ?? 'ore', lang) }) };
        if (ev.command === 'drop') return { text: t(ev.place === 'bunker' ? 'factory.cap.drop.bunker' : 'factory.cap.drop.ore-hatch', { item: itemText(ev.item ?? 'ore', lang) }) };
        return { text: t('factory.cap.smelt') };
    }
  }

  const wait = () => (index >= SLOW_STEPS ? Math.min(SPEED_MS[speed.level]!, SPEED_MS[MAX_SPEED]!) : SPEED_MS[speed.level]!);

  function render(animate: boolean) {
    const beat = beats[index]!;
    const fi = frameIndexOf(beat);
    const frame = frames[fi]!;
    const isError = beat.kind === 'resolve' && frame.event.kind === 'error';
    // The order sign is never green next to an error, and at the end only when the run passed.
    const green = frame.orderMet && !isError && (index < last || passed);
    const look = { orderMet: green, ...(isError && frame.event.kind === 'error' ? { error: machineOf(frame.event.problem) } : {}) };
    if (animate && beat.kind === 'resolve' && beat.tick > 0) parts.scene.play(frames[beat.tick - 1]!.state, frame, wait() * 0.85, look);
    else parts.scene.show(frame.state, look);

    // The running line, in the learner's code or in "Your machines".
    const ref = beat.line !== null ? lineRef(beat.line) : undefined;
    const state = factoryStateAt(beats, frames, index);
    const paint = (lis: HTMLElement[], part: 'own' | 'machines') => {
      for (const li of lis) {
        const n = Number(li.dataset.line);
        const hint = state.hints.get(part === 'own' ? n : n + MACHINES_LINE_BASE);
        const shown = hint ? hintText(hint, t, li.textContent ?? '') : { text: '' };
        const active = ref?.part === part && ref.line === n;
        li.classList.toggle('active', active);
        li.classList.toggle('error', active && isError);
        li.classList.toggle('branch-true', shown.branch === 'true');
        li.classList.toggle('branch-false', shown.branch === 'false');
        li.classList.toggle('seen', hint !== undefined);
        li.querySelector('.robot-note-inline')!.textContent = shown.text;
      }
    };
    paint(ownLines, 'own');
    // Inside a machine: the own line that called it stays marked.
    const calling = ref?.part === 'machines' ? lineRef(state.stack[0]?.callLine ?? 0) : undefined;
    for (const li of ownLines) li.classList.toggle('fw-calling', calling?.part === 'own' && calling.line === Number(li.dataset.line));
    paint(machineLines, 'machines');
    parts.listing.dataset.active = ref?.part === 'own' ? String(ref.line) : '';
    if (parts.machines) {
      parts.machines.listing.dataset.active = ref?.part === 'machines' ? String(ref.line) : '';
      if (ref?.part === 'machines') parts.machines.details.open = true;
    }
    const activeLi = (ref?.part === 'machines' ? machineLines : ownLines).find((li) => li.classList.contains('active'));
    if (activeLi) keepInBox(activeLi);

    // A new start of the program: the listing shows it starts from the top again.
    const restart = beat.kind === 'resolve' && frame.event.kind === 'start';
    parts.listing.classList.toggle('fw-restart', restart && perStart);
    const cap = caption(frame, beat.kind, index >= last);
    parts.caption.textContent = cap.text;
    parts.caption.classList.toggle('error', !!cap.error);
    parts.caption.dataset.kind = beat.kind === 'resolve' ? frame.event.kind : beat.kind;
    parts.position.textContent = [t('factory.step', { n: index, total: last }), perStart && frame.start > 0 ? t('factory.start', { n: frame.start }) : ''].filter(Boolean).join(' · ');
    paintRestart();
    for (const b of forward) b.disabled = index >= last;
    paintSpeed();
  }

  function finish() {
    if (!ended) {
      ended = true;
      onEnd();
    }
  }
  function go(i: number, animate = false) {
    index = Math.max(0, Math.min(last, i));
    render(animate);
    if (index >= last) finish();
  }
  function pause() {
    if (timer) clearTimeout(timer);
    timer = undefined;
    playBtn.textContent = '▶';
    playBtn.setAttribute('aria-label', t('robot.play'));
    playBtn.title = t('robot.play');
  }
  function tickOn() {
    timer = setTimeout(() => {
      timer = undefined;
      if (index >= last) return pause();
      go(index + 1, true);
      if (index >= last) return pause();
      tickOn();
    }, wait());
  }
  function play() {
    if (timer) return;
    if (index >= last) go(0);
    playBtn.textContent = '⏸';
    playBtn.setAttribute('aria-label', t('robot.pause'));
    playBtn.title = t('robot.pause');
    tickOn();
  }

  const playBtn = h('button', { type: 'button', class: 'run-control', 'data-testid': 'factory-play', 'aria-label': t('robot.play'), title: t('robot.play') }, '▶') as HTMLButtonElement;
  playBtn.addEventListener('click', () => (timer ? pause() : play()));
  const forward: HTMLButtonElement[] = [];
  const btn = (label: MessageKey, glyph: string, id: string, fn: () => void, isForward = false) => {
    const b = h('button', { type: 'button', class: 'run-control', 'data-testid': id, 'aria-label': t(label), title: t(label), onclick: () => (pause(), fn()) }, glyph) as HTMLButtonElement;
    if (isForward) forward.push(b);
    return b;
  };
  // ↺ is always there: from the first step it goes back to the code, later it starts the program over.
  const restartBtn = btn('robot.restart', '↺', 'factory-restart', () => (index > 0 ? go(0) : onReset()));
  const paintRestart = () => {
    const label = t(index > 0 ? 'robot.restart' : 'factory.reset');
    restartBtn.setAttribute('aria-label', label);
    restartBtn.title = label;
  };
  const speedBtn = h('button', { type: 'button', class: 'run-control fw-speed', 'data-testid': 'factory-speed' }) as HTMLButtonElement;
  const paintSpeed = () => {
    const word = t(`robot.speed.${speed.level}` as MessageKey);
    speedBtn.textContent = `⏱ ${word}`;
    speedBtn.setAttribute('aria-label', t('robot.speed.label', { speed: word }));
    speedBtn.title = t('robot.speed.label', { speed: word });
  };
  speedBtn.addEventListener('click', () => {
    speed.level = speed.level >= MAX_SPEED ? 1 : speed.level + 1;
    paintSpeed();
  });
  parts.controls.replaceChildren(
    h(
      'div',
      { class: 'run-controls fw-controls' },
      restartBtn,
      playBtn,
      btn('robot.step', '→', 'factory-step', () => go(index + 1, true), true),
      btn('robot.end', '⇥', 'factory-end', () => go(last), true),
      speedBtn,
    ),
  );
  render(false);
  return {
    pause,
    toEnd: () => (pause(), go(last)),
    dispose: () => (pause(), parts.scene.stop()),
  };
}

/** Hydra Works: the lesson map (the dependency graph) and the lesson page. */
export function factoryScreen(app: App): Screen {
  const { t, lang } = app;
  const game = app.services.factory;
  const root = h('main', { class: 'screen game factory' });
  const speed: Speed = { level: DEFAULT_SPEED };
  let cleanup: (() => void) | undefined;
  const stop = () => {
    cleanup?.();
    cleanup = undefined;
  };
  const titleOf = (l: Lesson) => `${l.id} · ${l.title[lang]}`;

  function show(...children: Node[]) {
    stop();
    root.replaceChildren(...children);
    window.scrollTo(0, 0);
  }

  /** The next lesson to play after `id`: one directly above it that is open, else the first open one. */
  function nextOpen(after?: LessonId): Lesson | undefined {
    const open = (l: Lesson) => game.status(l.id) === 'open';
    return (after ? lessonsAbove(after).find(open) : undefined) ?? game.lessons.find(open);
  }

  // ---------------------------------------------------------------- the map

  function showMap() {
    const node = (id: LessonId) => {
      const lesson = game.lesson(id)!;
      const status = game.status(id);
      // A locked node stays focusable (aria-disabled, not disabled): keyboard and screen reader users reach it and hear why.
      const stateText = status === 'solved' ? t('factory.map.solved') : status === 'open' ? t('factory.map.open') : t('factory.map.needs', { list: lesson.needs.join(' + ') });
      return h(
        'button',
        {
          type: 'button',
          class: `fw-node ${lesson.branch} ${status}`,
          'data-testid': `factory-lesson-${id}`,
          'data-status': status,
          ...(status === 'locked' ? { 'aria-disabled': 'true' } : {}),
          'aria-label': `${titleOf(lesson)}, ${stateText}`,
          onclick: () => (status === 'locked' ? undefined : showLesson(id)),
        },
        h('span', { class: 'fw-node-id' }, id),
        h('span', { class: 'fw-node-title' }, lesson.title[lang]),
        h('span', { class: 'fw-node-state', 'data-testid': `factory-state-${id}` }, stateText),
      );
    };
    const link = (cls = '') => h('span', { class: `fw-link ${cls}`, 'aria-hidden': 'true' });
    const rows: Node[] = [];
    GRAPH_ROWS.forEach((row, i) => {
      if (i > 0) {
        // B1 stands on G4 and S4: a fork; the others on the one lesson below.
        if (row.length === 2 && GRAPH_ROWS[i - 1]!.length === 1) rows.push(h('div', { class: 'fw-fork', 'aria-hidden': 'true' }, svg('<svg viewBox="0 0 100 24" preserveAspectRatio="none"><path d="M25 24V12H75V24M50 12V0" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>')));
        else rows.push(h('div', { class: `fw-links${row.length === 1 ? ' single' : ''}` }, ...row.map(() => link())));
      }
      rows.push(h('div', { class: `fw-row${row.length === 1 ? ' single' : ''}` }, ...row.map(node)));
    });
    rows.push(h('div', { class: 'fw-row fw-roots', 'aria-hidden': 'true' }, h('span', {}, t('factory.branch.grabber')), h('span', {}, t('factory.branch.smelter'))));

    const p = game.progress();
    const cur = p.current ? game.lesson(p.current) : undefined;
    const target = cur && game.status(cur.id) === 'open' ? cur : nextOpen(cur?.id);
    const resume = target
      ? h('button', { type: 'button', class: 'primary fw-continue', 'data-testid': 'factory-continue', onclick: () => showLesson(target.id) }, h('small', {}, t(p.solved.length === 0 ? 'factory.map.start' : 'factory.map.continue')), h('span', {}, titleOf(target)))
      : null;
    show(
      subpageHeader(app, t('factory.title')),
      h('p', { class: 'fw-intro' }, t('factory.map.intro')),
      ...(resume ? [resume] : []),
      h('nav', { class: 'fw-map', 'aria-label': t('factory.map.graph'), 'data-testid': 'factory-map' }, ...rows),
    );
  }

  // ---------------------------------------------------------------- a lesson

  function showLesson(id: LessonId) {
    const lesson = game.lesson(id)!;
    if (game.status(id) === 'locked') return showMap();
    game.setCurrent(id);
    const machinesText = game.machines(id);
    const perStart = lesson.mode !== 'once';
    let state: 'idle' | 'playing' | 'passed' | 'failed' = 'idle';
    let viewer: FactoryViewer | undefined;
    let nextLesson: Lesson | undefined;

    const orderFor = (n?: number) => orderText(lesson.order, lang, n ?? 0) + (lesson.order.plates === 'n' ? t('factory.order.n', { n: n ?? 0 }) : '');
    const scene = createScene({
      t,
      // The grabber lessons have no variables yet: their heaps are counted in plain words.
      labels: lesson.branch === 'grabber' ? 'count' : 'python',
      factoryGrabber: lesson.branch === 'smelter',
      // A name plate shows where it is about: the grabber's feed() in the grabber lessons, make_plate() in the smelter ones.
      names: {
        feed: game.status('G4') === 'solved' && lesson.branch !== 'smelter',
        makePlate: game.status('S4') === 'solved' && lesson.branch !== 'grabber',
        block: game.status('B3') === 'solved',
      },
      order: orderFor(lesson.belts[0]!.n),
    });

    // ---- the task
    const meta = [t(`factory.mode.${lesson.mode}`), lesson.belts.length > 1 ? t('factory.belts', { n: lesson.belts.length }) : ''].filter(Boolean).join(' ');
    const task = h(
      'div',
      { class: 'fw-task' },
      h('p', { class: 'fw-task-text', 'data-testid': 'factory-task' }, lesson.task[lang]),
      h('p', { class: 'fw-meta', 'data-testid': 'factory-mode' }, lesson.newWord ? h('span', { class: 'robot-tag fw-new' }, t('factory.new', { word: lesson.newWord })) : null, meta),
    );
    // The belt the verdict is about (only the belt number: the verdict says that it fails there).
    const otherBelt = h('p', { class: 'fw-other-belt', 'data-testid': 'factory-other-belt', hidden: true });
    const controls = h('div', { class: 'fw-controlrow' });
    const position = h('p', { class: 'run-position fw-position', 'data-testid': 'factory-position' });
    const caption = h('p', { class: 'fw-caption', 'data-testid': 'factory-caption', 'aria-live': 'polite' });

    // ---- "Your machines" (block lessons): folded, read-only
    let machines: ViewerParts['machines'];
    if (lesson.machinesFrom) {
      const listing = h('ol', { class: 'robot-listing fw-machines-listing', 'data-testid': 'factory-machines-listing' });
      fillListing(listing, machinesText);
      const details = h('details', { class: 'fw-machines', 'data-testid': 'factory-machines' }, h('summary', {}, t('factory.machines')), h('p', { class: 'fw-note' }, t('factory.machines.note')), listing) as HTMLDetailsElement;
      machines = { details, listing };
    }

    // ---- the code: the editor, or the listing with the running line while a run is shown
    const suggest = factorySuggestions(lesson, t('factory.tools'), t('factory.shapes'));
    const help = () =>
      lesson.toolbox.map((sig) => {
        const word = /^\w+/.exec(sig)![0];
        return { sig, desc: t(`factory.help.${word}` as MessageKey) };
      });
    const ed: Editor = createEditor(t as (key: MessageKey) => string, game.startText(id), suggest, (text) => (game.setText(id, text), toIdle()), 'factory-code', help);
    ed.area.setAttribute('aria-label', t('factory.code'));
    ed.area.addEventListener('focus', () => toIdle());
    const listing = h('ol', { class: 'robot-listing', 'data-testid': 'factory-listing' });
    const listingHolder = h('div', { class: 'robot-listing-holder fw-listing-holder', hidden: true, role: 'button', tabindex: 0, 'aria-label': t('factory.edit'), title: t('factory.edit'), 'data-testid': 'factory-view-toggle' }, listing);
    const edit = () => showEditor(true);
    listingHolder.addEventListener('click', edit);
    listingHolder.addEventListener('keydown', (e) => ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') && (e.preventDefault(), edit()));
    function showEditor(on: boolean) {
      ed.el.hidden = !on;
      listingHolder.hidden = on;
      if (on) ed.area.focus();
    }

    const result = h('div', { class: 'robot-result fw-result', 'data-testid': 'factory-result', hidden: true });
    const primary = h('button', { type: 'button', class: 'primary rb-primary fw-primary' }) as HTMLButtonElement;
    function paintPrimary() {
      const [label, testId] =
        state === 'idle'
          ? [t('factory.run'), 'factory-run']
          : state === 'playing'
            ? [t('factory.skip'), 'factory-skip']
            : state === 'failed'
              ? [t('factory.improve'), 'factory-improve']
              : [nextLesson ? t('factory.next', { title: titleOf(nextLesson) }) : t('factory.toMap'), 'factory-next'];
      primary.textContent = label;
      primary.dataset.testid = testId;
      primary.setAttribute('data-testid', testId);
      primary.dataset.state = state;
    }
    primary.addEventListener('click', () => {
      if (state === 'idle') return run();
      if (state === 'playing') return viewer?.toEnd();
      if (state === 'failed') return showEditor(true);
      if (nextLesson) showLesson(nextLesson.id);
      else showMap();
    });

    function drawStart() {
      scene.setOrder(orderFor(lesson.belts[0]!.n));
      scene.show(startState(lesson), { orderMet: false });
      caption.textContent = '';
      caption.classList.remove('error');
      position.textContent = '';
      controls.replaceChildren();
      otherBelt.hidden = true;
      if (machines) for (const li of machines.listing.children) li.className = '';
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

    function verdict(r: JudgeResult, firstPass: boolean): Node[] {
      if (r.passed) {
        return [
          h('p', { class: 'verdict correct', 'data-testid': 'factory-outcome', 'data-state': 'passed' }, t('factory.result.pass')),
          ...(firstPass && REWARDS.has(id) ? [h('p', { class: 'fw-reward', 'data-testid': 'factory-reward' }, t(`factory.reward.${id}` as MessageKey))] : []),
        ];
      }
      // Without a reason of the judge, the belt's block says what is short (the items left on the belt, a heap, the plates).
      const belt = r.belts[r.play]!;
      const hint = r.problem ? undefined : orderHint(lesson.order, belt.final, belt.belt.n ?? 0, lang);
      const text = r.problem ? problemText(r.problem, lang) : [t('factory.result.order'), hint].filter(Boolean).join(' ');
      return [
        h('p', { class: 'verdict wrong', 'data-testid': 'factory-outcome', 'data-state': 'failed' }, text),
        ...(r.otherBelt ? [h('p', { class: 'fw-note', 'data-testid': 'factory-other-belt-note' }, t('factory.result.otherBelt'))] : []),
      ];
    }

    function run() {
      const text = ed.area.value;
      game.setText(id, text);
      const report = game.submit(id, text, true);
      if (!report) return;
      const r = report.result;
      const belt = r.belts[r.play]!;
      fillListing(listing, text);
      viewer?.dispose();
      state = 'playing';
      result.hidden = true;
      scene.setOrder(orderFor(belt.belt.n));
      if (r.otherBelt) {
        otherBelt.hidden = false;
        otherBelt.textContent = t('factory.belt', { n: r.play + 1, total: r.belts.length });
      } else otherBelt.hidden = true;
      let revealed = false;
      const reveal = () => {
        if (revealed) return;
        revealed = true;
        report.award?.();
        state = r.passed ? 'passed' : 'failed';
        nextLesson = r.passed ? nextOpen(id) : undefined;
        result.replaceChildren(...verdict(r, report.firstPass));
        result.hidden = false;
        paintPrimary();
        requestAnimationFrame(() => primary.scrollIntoView({ block: 'nearest' }));
      };
      // The run starts paused on the block before the start: ▶ plays it, → steps, "Zum Ergebnis" skips to the verdict.
      viewer = createFactoryViewer(t, lang, belt.frames, { listing, ...(machines ? { machines } : {}), scene, caption, position, controls }, speed, {
        perStart,
        passed: r.passed,
        onEnd: reveal,
        onReset: () => (toIdle(), showEditor(true)),
      });
      paintPrimary();
      showEditor(false);
      requestAnimationFrame(() => scene.el.scrollIntoView({ block: 'nearest' }));
    }

    const header = h(
      'header',
      { class: 'subpage-header fw-header' },
      h('button', { type: 'button', class: 'icon-button', 'aria-label': t('nav.back'), title: t('nav.back'), 'data-testid': 'factory-back', onclick: () => showMap() }, svg(BACK)),
      h('h1', { tabindex: -1, 'data-testid': 'factory-title' }, titleOf(lesson)),
    );
    const left = h('div', { class: 'fw-main' }, task, otherBelt, scene.el, h('div', { class: 'fw-controlbar' }, controls, position), caption);
    const right = h('div', { class: 'fw-code' }, ...(machines ? [machines.details] : []), ed.el, listingHolder, result, primary);
    paintPrimary();
    drawStart();
    show(h('div', { class: 'fw-work', 'data-testid': 'factory-work', 'data-lesson': id }, header, h('div', { class: 'fw-page' }, left, right)));
    // Leaving the lesson (or the screen) stops the playback and drops the editor's window listeners.
    cleanup = () => {
      viewer?.dispose();
      viewer = undefined;
      ed.dispose();
    };
    root.querySelector<HTMLElement>('[data-testid="factory-title"]')?.focus({ preventScroll: true });
  }

  showMap();
  return { root, dispose: stop };
}
