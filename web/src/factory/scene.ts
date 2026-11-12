/**
 * The block of Hydra Works as an SVG, seen from above (docs/factory.md, "The block"):
 * the belt in the west with ore (ochre pebbles) and coal (black angular lumps), the grabber in
 * the middle that faces west / north / east / south, opens, closes and carries its
 * item, the coal bunker in the north with its chute, the smelter in the east with
 * the ore hatch, the ore heap, the coal heap and the plate stack, the floor in the
 * south. Above it the order sign, which turns green when the order is met.
 *
 * `show()` draws a `WorldSnapshot`; `play()` animates the step from one frame to the
 * next (a turn, a grab, an item falling into its heap, a smelt, the grey factory
 * grabber's delivery). With `prefers-reduced-motion` every step is drawn at once.
 */
import { h } from '../dom.ts';
import type { MessageKey } from '../i18n.ts';
import type { Frame, Problem } from './run.ts';
import type { BeltItem, Facing, Item, WorldSnapshot } from './world.ts';

type T = (key: MessageKey, params?: Record<string, string | number>) => string;

/** The machine an error belongs to (it gets the red lamp and the smoke). */
export type Machine = 'grabber' | 'bunker' | 'smelter';

export function machineOf(problem: Problem | undefined): Machine | undefined {
  if (problem?.kind !== 'world') return undefined;
  switch (problem.code) {
    case 'coal-in-ore-hatch':
    case 'need-ore':
    case 'need-coal':
      return 'smelter';
    case 'ore-in-bunker':
      return 'bunker';
    case 'nothing-there':
      return 'grabber';
  }
}

export interface SceneOptions {
  t: T;
  /**
   * The heap labels: `python` ("ore = 2", the variables, from the first smelter lesson on); `count` ("Ore: 2",
   * plain words for the grabber lessons, where the variables do not exist yet).
   */
  labels: 'python' | 'count';
  /** Smelter lessons: the grabber is the grey factory grabber, it delivers by itself. */
  factoryGrabber: boolean;
  /** The name plates the learner has earned. */
  names: { feed: boolean; makePlate: boolean; block: boolean };
  /** The order sign's text. */
  order: string;
}

export interface Look {
  orderMet: boolean;
  error?: Machine;
}

export interface Scene {
  el: HTMLElement;
  /** Draws the block as it is (stops a running animation). */
  show(state: WorldSnapshot, look: Look): void;
  /** Animates from `prev` to `frame` in about `ms` milliseconds, then shows the frame. */
  play(prev: WorldSnapshot, frame: Frame, ms: number, look: Look): void;
  setOrder(text: string): void;
  stop(): void;
}

// ------------------------------------------------------------------ geometry

const NS = 'http://www.w3.org/2000/svg';
const W = 360;
const H = 252;
/** The grabber's pivot. */
const CX = 170;
const CY = 136;
const ARM = 46;
/** Where a held item sits, from the pivot. */
const TIP = 53;
/** Half the size of a lump (the belt, the heaps, the held item). */
const LUMP = 8;
const SLOT0 = 112;
const SLOT_GAP = 16;
const ORE_HEAP = { x: 256, y: 166 };
const COAL_HEAP = { x: 306, y: 124 };
const PLATES = { x: 326, y: 190 };
const FIRE = { x: 286, y: 116 };
const BUNKER = { x: 170, y: 36 };
/** The chute from the bunker to the coal heap. */
const CHUTE: readonly Pt[] = [
  { x: 196, y: 36 },
  { x: 306, y: 36 },
  { x: 306, y: 110 },
];
const ANGLE: Record<Facing, number> = { W: 180, N: 270, E: 0, S: 90 };
const OPEN = 0.75;
const HOLD = 0.12;

interface Pt {
  x: number;
  y: number;
}

const slotX = (k: number) => SLOT0 - SLOT_GAP * k;
const tipAt = (angle: number): Pt => ({ x: CX + TIP * Math.cos((angle * Math.PI) / 180), y: CY + TIP * Math.sin((angle * Math.PI) / 180) });
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
/** `t` within [from, to] as 0..1. */
const phase = (t: number, from: number, to: number) => ease((t - from) / (to - from));
const along = (pts: readonly Pt[], t: number): Pt => {
  const lens = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i]!.x, p.y - pts[i]!.y));
  let d = Math.max(0, Math.min(1, t)) * lens.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i]! || i === lens.length - 1) {
      const f = lens[i]! === 0 ? 1 : Math.min(1, d / lens[i]!);
      return { x: lerp(pts[i]!.x, pts[i + 1]!.x, f), y: lerp(pts[i]!.y, pts[i + 1]!.y, f) };
    }
    d -= lens[i]!;
  }
  return pts.at(-1)!;
};

/** Where a heap's n-th lump lies (a small mound). */
const MOUND: readonly Pt[] = [
  { x: 0, y: 0 },
  { x: -16, y: 0 },
  { x: 16, y: 0 },
  { x: -8, y: -13 },
  { x: 8, y: -13 },
  { x: 0, y: -26 },
  { x: -32, y: 0 },
  { x: 32, y: 0 },
];

/** Everything that moves, at one moment. */
interface Pose {
  angle: number;
  /** 0 closed .. 1 wide open. */
  jaw: number;
  held: Item | null;
  belt: { kind: Item; x: number }[];
  ore: number;
  coal: number;
  plates: number;
  flying: { kind: Item | 'plate'; x: number; y: number }[];
  /** The smelter's fire, 0..1. */
  glow: number;
  /** A small sideways jolt of the grabber (wasted motion). */
  jolt: number;
  /** A ring around the front item: the program starts for it. */
  ring: number;
  orderMet: boolean;
  error?: Machine | undefined;
}

function poseOf(s: WorldSnapshot, look: Look, angle = ANGLE[s.facing]): Pose {
  return {
    angle,
    jaw: s.holding ? HOLD : OPEN,
    held: s.holding?.kind ?? null,
    belt: s.belt.map((b, k) => ({ kind: b.kind, x: slotX(k) })),
    ore: s.ore,
    coal: s.coal,
    plates: s.plates,
    flying: [],
    glow: 0,
    jolt: 0,
    ring: 0,
    orderMet: look.orderMet,
    error: look.error,
  };
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ------------------------------------------------------------------ SVG helpers

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, ...children: (SVGElement | string)[]): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  for (const c of children) e.append(c);
  return e;
}

/**
 * A lump of ore or coal. Ore is a round ochre pebble with a dark fleck; coal is a black angular lump with a
 * light glint. The shapes and the fills differ, and each has an outline that stands out on the dark belt too.
 */
function lump(kind: Item | 'plate', x: number, y: number): SVGElement {
  if (kind === 'plate') return el('rect', { class: 'fw-plate', x: x - 12, y: y - 3.5, width: 24, height: 7, rx: 1.5 });
  if (kind === 'coal')
    return el(
      'g',
      { class: 'fw-coal', 'data-item': 'coal' },
      el('path', { d: `M${x - 8} ${y + 2}L${x - 5} ${y - 6}L${x + 2} ${y - 8}L${x + 8} ${y - 2}L${x + 5} ${y + 6}L${x - 3} ${y + 8}Z` }),
      el('circle', { class: 'fw-shine', cx: x - 2.5, cy: y - 3, r: 1.6 }),
    );
  return el(
    'g',
    { class: 'fw-ore', 'data-item': 'ore' },
    el('circle', { cx: x, cy: y, r: 7.5 }),
    el('circle', { class: 'fw-fleck', cx: x + 2.5, cy: y - 2.5, r: 1.6 }),
  );
}

// ------------------------------------------------------------------ the scene

export function createScene(o: SceneOptions): Scene {
  const { t } = o;
  const svg = el('svg', { class: `fw-scene${o.factoryGrabber ? ' fw-factory' : ''}`, viewBox: `0 0 ${W} ${H}`, role: 'img', 'data-testid': 'factory-scene' });
  const title = el('title');
  svg.append(title);

  // ---- the fixed parts
  const fixed = el('g');
  // floor (south)
  fixed.append(
    el('rect', { class: 'fw-floor', x: 132, y: 182, width: 76, height: 62, rx: 4 }),
    el('text', { class: 'fw-label', x: 170, y: 238, 'text-anchor': 'middle' }, t('factory.scene.floor')),
  );
  // belt (west)
  const rollers = Array.from({ length: 9 }, (_, i) => el('line', { class: 'fw-roller', x1: 6 + i * 13, y1: CY - 11, x2: 6 + i * 13, y2: CY + 11 }));
  fixed.append(
    el('rect', { class: 'fw-belt', x: 0, y: CY - 12, width: 116, height: 24, rx: 3 }),
    ...rollers,
    el('path', { class: 'fw-arrow', d: `M40 ${CY + 20} h30 l-5 -4 m5 4 l-5 4` }),
    el('text', { class: 'fw-label', x: 8, y: CY - 18 }, t('factory.scene.belt')),
  );
  // bunker (north) and its chute to the coal heap
  fixed.append(
    el('polyline', { class: 'fw-chute', points: CHUTE.map((p) => `${p.x},${p.y}`).join(' ') }),
    el('rect', { class: 'fw-bunker', 'data-machine': 'bunker', x: 142, y: 10, width: 56, height: 48, rx: 4 }),
    el('rect', { class: 'fw-bunker-mouth', x: 156, y: 50, width: 28, height: 8, rx: 2 }),
    el('text', { class: 'fw-label', x: 140, y: 72, 'text-anchor': 'end' }, t('factory.scene.bunker')),
  );
  // smelter (east): body, ore hatch, fire
  fixed.append(
    el('rect', { class: 'fw-smelter', 'data-machine': 'smelter', x: 228, y: 88, width: 124, height: 120, rx: 6 }),
    el('rect', { class: 'fw-hatch', x: 222, y: CY - 10, width: 9, height: 20, rx: 2 }),
    el('text', { class: 'fw-label', x: 290, y: 222, 'text-anchor': 'middle' }, t('factory.scene.smelter')),
  );
  svg.append(fixed);

  const fire = el('circle', { class: 'fw-fire', cx: FIRE.x, cy: FIRE.y, r: 12 });
  const heaps = el('g', { 'data-testid': 'factory-heaps' });
  const labels = el('g', { class: 'fw-vars' });
  const beltItems = el('g', { 'data-testid': 'factory-belt' });
  const ring = el('circle', { class: 'fw-ring', cx: SLOT0, cy: CY, r: 9 });
  const flying = el('g');
  const lamps = el('g');
  const smoke = el('g', { class: 'fw-smoke' });
  const plates = el('g');

  // ---- the grabber
  const jawA = el('rect', { class: 'fw-jaw', x: ARM - 2, width: 14, height: 3, rx: 1 });
  const jawB = el('rect', { class: 'fw-jaw', x: ARM - 2, width: 14, height: 3, rx: 1 });
  const heldG = el('g');
  // The arrow on the arm points where the grabber faces (the arm turns with it).
  const armRot = el('g', {}, el('rect', { class: 'fw-arm', x: 0, y: -4, width: ARM, height: 8, rx: 3 }), el('path', { class: 'fw-facing', d: 'M24 -5 L35 0 L24 5 Z' }), el('rect', { class: 'fw-wrist', x: ARM - 4, y: -8, width: 6, height: 16, rx: 2 }), jawA, jawB, heldG);
  const base = el('circle', { class: 'fw-base', 'data-machine': 'grabber', r: 15 });
  const grabberLamp = el('circle', { class: 'fw-lamp', r: 4 });
  const grabber = el('g', { 'data-testid': 'factory-grabber' }, base, armRot, grabberLamp);
  const grabberName = o.factoryGrabber ? el('text', { class: 'fw-label fw-grey', x: CX, y: CY + 30, 'text-anchor': 'middle' }, t('factory.scene.factoryGrabber')) : null;

  svg.append(fire, heaps, labels, plates, beltItems, ring, grabber, flying, lamps, smoke);
  if (grabberName) svg.append(grabberName);

  // ---- name plates
  const namePlate = (x: number, y: number, text: string, id: string) => {
    const w = 8 + text.length * 7.2;
    return el('g', { class: 'fw-name', 'data-testid': `factory-name-${id}` }, el('rect', { x: x - w / 2, y: y - 9, width: w, height: 16, rx: 3 }), el('text', { x, y: y + 3, 'text-anchor': 'middle' }, text));
  };
  if (o.names.feed) svg.append(namePlate(68, 182, 'feed()', 'feed'));
  if (o.names.makePlate) svg.append(namePlate(290, 80, 'make_plate()', 'make_plate'));
  if (o.names.block) svg.append(namePlate(58, 20, 'make_plates(n)', 'block'));

  const sign = h('p', { class: 'fw-order', 'data-testid': 'factory-order', 'aria-live': 'polite' }, o.order);
  const elWrap = h('div', { class: 'fw-scene-wrap' }, sign);
  elWrap.append(svg);

  // ---- drawing a pose
  let shownHeaps = '';
  /** The heap label: the Python variable, or plain words where the learner has no variables yet. */
  const labelText = (item: 'ore' | 'coal', n: number) => (o.labels === 'python' ? `${item} = ${n}` : t(item === 'ore' ? 'factory.scene.count.ore' : 'factory.scene.count.coal', { n }));
  function draw(p: Pose) {
    // grabber
    const jolt = p.jolt ? Math.sin(p.jolt * Math.PI * 4) * 2.5 : 0;
    grabber.setAttribute('transform', `translate(${CX + jolt} ${CY})`);
    armRot.setAttribute('transform', `rotate(${p.angle})`);
    const gap = 3 + p.jaw * 8;
    jawA.setAttribute('y', String(-gap - 3));
    jawB.setAttribute('y', String(gap));
    heldG.replaceChildren(...(p.held ? [lump(p.held, TIP, 0)] : []));
    grabber.dataset.facing = (['E', 'S', 'W', 'N'] as const)[Math.round((((p.angle % 360) + 360) % 360) / 90) % 4]!;
    grabber.dataset.holding = p.held ?? '';
    // belt
    beltItems.replaceChildren(...p.belt.filter((b) => b.x > -LUMP).map((b) => lump(b.kind, b.x, CY)));
    beltItems.setAttribute('data-count', String(p.belt.length));
    ring.setAttribute('opacity', String(p.ring > 0 ? Math.sin(p.ring * Math.PI) : 0));
    ring.setAttribute('r', String(8 + p.ring * 6));
    // heaps (redrawn only when they change)
    const key = `${p.ore}/${p.coal}/${p.plates}`;
    if (key !== shownHeaps) {
      shownHeaps = key;
      heaps.replaceChildren(
        ...Array.from({ length: Math.min(p.ore, MOUND.length) }, (_, i) => lump('ore', ORE_HEAP.x + MOUND[i]!.x, ORE_HEAP.y + MOUND[i]!.y)),
        ...Array.from({ length: Math.min(p.coal, MOUND.length) }, (_, i) => lump('coal', COAL_HEAP.x + MOUND[i]!.x, COAL_HEAP.y + MOUND[i]!.y)),
      );
      heaps.dataset.ore = String(p.ore);
      heaps.dataset.coal = String(p.coal);
      plates.replaceChildren(
        ...Array.from({ length: Math.min(p.plates, 6) }, (_, i) => lump('plate', PLATES.x, PLATES.y - i * 8)),
        ...(p.plates > 6 ? [el('text', { class: 'fw-label', x: PLATES.x + 15, y: PLATES.y - 20 }, `×${p.plates}`)] : []),
      );
      plates.dataset.plates = String(p.plates);
      labels.replaceChildren(
        el('text', { class: 'fw-var', x: ORE_HEAP.x, y: ORE_HEAP.y + 24, 'text-anchor': 'middle', 'data-testid': 'factory-label-ore' }, labelText('ore', p.ore)),
        el('text', { class: 'fw-var', x: COAL_HEAP.x, y: COAL_HEAP.y + 22, 'text-anchor': 'middle', 'data-testid': 'factory-label-coal' }, labelText('coal', p.coal)),
      );
    }
    flying.replaceChildren(...p.flying.map((f) => lump(f.kind, f.x, f.y)));
    fire.setAttribute('opacity', String(0.15 + 0.85 * p.glow));
    fire.setAttribute('r', String(10 + 6 * p.glow));
    // order sign, error lamps and smoke
    sign.classList.toggle('met', p.orderMet);
    sign.dataset.met = String(p.orderMet);
    svg.dataset.error = p.error ?? '';
    grabberLamp.classList.toggle('on', p.error === 'grabber');
    lamps.replaceChildren(
      el('circle', { class: `fw-lamp${p.error === 'bunker' ? ' on' : ''}`, cx: 191, cy: 17, r: 4 }),
      el('circle', { class: `fw-lamp${p.error === 'smelter' ? ' on' : ''}`, cx: 343, cy: 97, r: 4 }),
    );
    const at = p.error === 'smelter' ? { x: 300, y: 84 } : p.error === 'bunker' ? { x: 178, y: 8 } : p.error === 'grabber' ? { x: CX, y: CY - 18 } : null;
    smoke.replaceChildren(...(at ? [0, 1, 2].map((i) => el('circle', { cx: at.x + (i - 1) * 9, cy: at.y - i * 4, r: 6 + i * 2, style: `animation-delay:${i * 0.35}s` })) : []));
    title.textContent = o.labels === 'python' ? t('factory.scene.title', { ore: p.ore, coal: p.coal, plates: p.plates, belt: p.belt.length }) : t('factory.scene.titleCount', { ore: p.ore, coal: p.coal, plates: p.plates, belt: p.belt.length });
  }

  // ---- animation
  let raf = 0;
  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
  function show(state: WorldSnapshot, look: Look) {
    stop();
    draw(poseOf(state, look));
  }

  /** The pose at `t` (0..1) of the step from `prev` to `frame`. */
  function between(prev: WorldSnapshot, frame: Frame, look: Look, a0: number): (t: number) => Pose {
    const before = poseOf(prev, { orderMet: false }, a0);
    const after = poseOf(frame.state, look, a0);
    const ev = frame.event;
    const slide = (t: number) => prev.belt.slice(1).map((b, k) => ({ kind: b.kind, x: lerp(slotX(k + 1), slotX(k), t) }));
    if (ev.kind === 'act') {
      if (ev.command === 'turn') return (t) => ({ ...after, angle: a0 + 90 * ease(t), orderMet: t >= 1 && look.orderMet });
      if (ev.idle) {
        // Wasted motion: the claw snaps shut on air (or opens empty), with a little jolt.
        const rest = before.jaw;
        return (t) => ({ ...before, jaw: ev.command === 'grab' ? lerp(rest, 0, Math.sin(t * Math.PI)) : lerp(rest, 1, Math.sin(t * Math.PI)), jolt: t, orderMet: look.orderMet });
      }
      if (ev.command === 'grab') {
        const front = prev.belt[0]!;
        const tip = tipAt(a0);
        return (t) => {
          const reach = phase(t, 0, 0.45);
          const flying = t < 0.45 ? [{ kind: front.kind, x: lerp(slotX(0), tip.x, reach), y: CY }] : [];
          return { ...before, jaw: t < 0.45 ? lerp(OPEN, 1, reach) : lerp(1, HOLD, phase(t, 0.45, 0.7)), held: t < 0.45 ? null : front.kind, belt: slide(phase(t, 0.5, 1)), flying, orderMet: t >= 1 && look.orderMet };
        };
      }
      if (ev.command === 'drop' && prev.holding) {
        const kind = prev.holding.kind;
        const tip = tipAt(a0);
        const path: Pt[] = ev.place === 'bunker' ? [tip, BUNKER, ...CHUTE, COAL_HEAP] : [tip, { x: 236, y: CY }, ORE_HEAP];
        return (t) => ({ ...before, jaw: lerp(HOLD, 1, phase(t, 0, 0.25)), held: null, flying: t < 1 ? [{ kind, ...along(path, phase(t, 0.15, 1)) }] : [], orderMet: t >= 1 && look.orderMet });
      }
      if (ev.command === 'smelt') {
        const into = (from: Pt, t: number): Pt => ({ x: lerp(from.x, FIRE.x, t), y: lerp(from.y, FIRE.y, t) });
        return (t) => {
          const go = phase(t, 0, 0.45);
          const parts = t < 0.45 ? [{ kind: 'ore' as const, ...into({ x: ORE_HEAP.x - 10, y: ORE_HEAP.y }, go) }, { kind: 'ore' as const, ...into(ORE_HEAP, go) }, { kind: 'coal' as const, ...into(COAL_HEAP, go) }] : [];
          const plate = t >= 0.55 && t < 1 ? [{ kind: 'plate' as const, x: lerp(FIRE.x, PLATES.x, phase(t, 0.55, 1)), y: lerp(FIRE.y, PLATES.y - prev.plates * 8, phase(t, 0.55, 1)) }] : [];
          return { ...after, plates: t < 1 ? prev.plates : after.plates, flying: [...parts, ...plate], glow: Math.sin(Math.min(1, t / 0.8) * Math.PI), orderMet: t >= 1 && look.orderMet };
        };
      }
    }
    if (ev.kind === 'start' && ev.by === 'factory') {
      // The grey factory grabber: takes the item from the belt, turns to the hatch (ore) or the bunker (coal), drops it, turns back.
      const kind = ev.item.kind;
      const target = kind === 'ore' ? a0 + 180 : a0 + 90;
      const path: Pt[] = kind === 'coal' ? [tipAt(target), BUNKER, ...CHUTE, COAL_HEAP] : [tipAt(target), { x: 236, y: CY }, ORE_HEAP];
      const heapsBefore = { ore: kind === 'ore' ? after.ore - 1 : after.ore, coal: kind === 'coal' ? after.coal - 1 : after.coal };
      return (t) => {
        const angleNow = t < 0.25 ? a0 : t < 0.5 ? lerp(a0, target, phase(t, 0.25, 0.5)) : t < 0.8 ? target : lerp(target, a0, phase(t, 0.8, 1));
        const held = t >= 0.15 && t < 0.55 ? kind : null;
        const fly = t < 0.15 ? [{ kind, x: lerp(slotX(0), tipAt(a0).x, phase(t, 0, 0.15)), y: CY }] : t >= 0.55 && t < 0.95 ? [{ kind, ...along(path, phase(t, 0.55, 0.95)) }] : [];
        return { ...after, ...(t < 0.95 ? heapsBefore : {}), angle: angleNow, jaw: held ? HOLD : OPEN, held, belt: slide(phase(t, 0.2, 0.6)), flying: fly, orderMet: t >= 1 && look.orderMet };
      };
    }
    if (ev.kind === 'start') return (t) => ({ ...after, ring: t });
    if (ev.kind === 'error') return (t) => ({ ...after, jolt: ev.command ? t : 0, jaw: ev.command === 'drop' ? lerp(HOLD, 0.4, Math.sin(t * Math.PI)) : after.jaw });
    return () => after;
  }

  function play(prev: WorldSnapshot, frame: Frame, ms: number, look: Look) {
    stop();
    const a0 = ANGLE[prev.facing];
    const to = frame.event.kind === 'act' && frame.event.command === 'turn' ? a0 + 90 : ANGLE[frame.state.facing];
    if (ms < 60 || reducedMotion()) return draw(poseOf(frame.state, look, to));
    const at = between(prev, frame, look, a0);
    const t0 = performance.now();
    const tick = () => {
      const tt = Math.min(1, (performance.now() - t0) / ms);
      draw(at(tt));
      raf = tt < 1 ? requestAnimationFrame(tick) : 0;
      if (tt >= 1) draw({ ...poseOf(frame.state, look, to) });
    };
    tick();
  }

  return {
    el: elWrap,
    show,
    play,
    setOrder: (text) => (sign.textContent = text),
    stop,
  };
}

/** The items on a belt as words ("ore, coal, ore"), for a short description. */
export const beltWords = (items: readonly BeltItem[] | readonly Item[], word: (i: Item) => string) => items.map((i) => word(typeof i === 'string' ? i : i.kind)).join(', ');
