import { svg } from '../dom.ts';
import { logoArt } from '../hydra/view.ts';
import { HERO_SVG, heroBump, heroCheer, heroEaten, heroStrike, heroWalk } from './hero.ts';
import type { HuntOutcome, HuntSnapshot, HuntWorld } from './hunt.ts';
import type { Point } from './world.ts';

/** Size of one grid cell in viewBox units. */
const CELL = 10;
const NS = 'http://www.w3.org/2000/svg';

export interface HuntArena {
  root: SVGSVGElement;
  /** Width / height, so the layout can size it. */
  ratio: number;
  /** Draws one step of a run; `outcome` is set on its last step. With `ms` > 0 the warrior walks there. */
  show(step: HuntSnapshot, outcome: HuntOutcome | undefined, ms: number): void;
}

const centre = (p: Point) => ({ x: p.x * CELL + CELL / 2, y: p.y * CELL + CELL / 2 });

/** A small pile of gold coins, centred on the origin. */
const GOLD = `<ellipse class="hunt-coin" cx="-1.4" cy="1.2" rx="1.9" ry="1.2"/><ellipse class="hunt-coin" cx="1.4" cy="1.4" rx="1.9" ry="1.2"/><ellipse class="hunt-coin" cx="0" cy="-0.4" rx="1.9" ry="1.2"/><path class="hunt-shine" d="M-0.8-0.8h1.2"/>`;

/**
 * One hydra: a snake whose body runs through its cells from the tail to the
 * neck, and a head on the last cell looking away from the body.
 */
function hydraMarkup(world: HuntWorld, index: number): string {
  const hydra = world.hydras[index]!;
  const head = centre(hydra.head);
  const neck = centre(hydra.body[0]!);
  const points = [...hydra.body].reverse().map(centre);
  // The body ends at the back of the head.
  const angle = Math.atan2(head.y - neck.y, head.x - neck.x);
  const back = { x: head.x - Math.cos(angle) * 2.2, y: head.y - Math.sin(angle) * 2.2 };
  const d = `M${[...points, back].map((p) => `${p.x} ${p.y}`).join('L')}`;
  const deg = Math.round((angle * 180) / Math.PI);
  // The head art is a side view facing right: one looking left is mirrored, and one looking
  // up or down only tilts that way, so it never stands on its nose.
  const turn = Math.abs(deg) > 100 ? 'scale(-1 1)' : Math.abs(deg) < 80 ? '' : `rotate(${deg > 0 ? 35 : -35})`;
  const tail = points[0]!;
  return `<g class="hunt-hydra" data-index="${index}">
  <path class="hunt-body" d="${d}"/>
  <path class="hunt-scales" d="${d}"/>
  <circle class="hunt-tail" cx="${tail.x}" cy="${tail.y}" r="1.4"/>
  <g class="hunt-head" transform="translate(${head.x} ${head.y}) ${turn}"><g class="hunt-head-bite"><g transform="scale(0.075) translate(-20 3)"><use href="#hydra-head" class="hunt-skull"/><use href="#hydra-eye" class="hunt-eye"/></g></g></g>
</g>`;
}

/**
 * The hunting ground seen from above: rocks, gold, the snake-like hydras
 * and the warrior. Decorative: the screen describes each run in text.
 */
export function huntArena(world: HuntWorld): HuntArena {
  const width = world.width * CELL;
  const height = world.height * CELL;
  let checker = '';
  const rocks: string[] = [];
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      if (world.rocks.has(`${x},${y}`)) {
        rocks.push(`<rect class="arena-rock" x="${x * CELL + 1}" y="${y * CELL + 1}" width="${CELL - 2}" height="${CELL - 2}" rx="2"/>`);
      } else if ((x + y) % 2 === 0) checker += `M${x * CELL} ${y * CELL}h${CELL}v${CELL}h${-CELL}z`;
    }
  }
  let lines = '';
  for (let x = 0; x <= world.width; x++) lines += `M${x * CELL} 0V${height}`;
  for (let y = 0; y <= world.height; y++) lines += `M0 ${y * CELL}H${width}`;
  const gold = world.gold
    .map((g, i) => {
      const c = centre(g);
      return `<g class="hunt-gold" data-index="${i}" transform="translate(${c.x} ${c.y})"><g class="hunt-gold-pile">${GOLD}</g></g>`;
    })
    .join('');

  const root = svg(`<svg class="arena hunt-arena" viewBox="-1 -1 ${width + 2} ${height + 2}" aria-hidden="true" focusable="false" data-testid="arena">
  <rect class="hunt-grass" x="-1" y="-1" width="${width + 2}" height="${height + 2}" rx="3"/>
  <path class="arena-checker" d="${checker}"/>
  <path class="hunt-grid" d="${lines}"/>
  ${rocks.join('')}
  ${gold}
  ${world.hydras.map((_, i) => hydraMarkup(world, i)).join('')}
  <g class="hunt-warrior">${HERO_SVG}</g>
  <g class="arena-fx"></g>
</svg>`);
  root.prepend(logoArt().querySelector('defs')!);

  const warrior = root.querySelector<SVGGElement>('.hunt-warrior')!;
  const art = root.querySelector<SVGGElement>('.hunt-warrior-art')!;
  const fx = root.querySelector<SVGGElement>('.arena-fx')!;
  const hydraEls = [...root.querySelectorAll<SVGGElement>('.hunt-hydra')];
  const goldEls = [...root.querySelectorAll<SVGGElement>('.hunt-gold')];
  let lastStep: HuntSnapshot | undefined;
  let lastOutcome: HuntOutcome | undefined;
  const timers: ReturnType<typeof setTimeout>[] = [];

  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function play(el: Element, frames: Keyframe[], duration: number, delay = 0) {
    if (calm() || !el.animate) return;
    el.animate(frames, { duration, delay, easing: 'ease-out', fill: 'backwards' });
  }
  function later(ms: number, fn: () => void) {
    timers.push(setTimeout(fn, ms));
  }
  /** Small sparks that fly out of a point and fade. */
  function sparks(at: Point, count: number, reach: number, colour: string, delay: number) {
    if (calm()) return;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + at.x;
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('transform', `translate(${at.x} ${at.y})`);
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('r', '0.7');
      c.setAttribute('fill', colour);
      g.append(c);
      fx.append(g);
      const anim = c.animate(
        [
          { transform: 'translate(0,0) scale(0.5)', opacity: 1 },
          { transform: `translate(${Math.cos(a) * reach}px,${Math.sin(a) * reach}px) scale(1)`, opacity: 0 },
        ],
        { duration: 700, delay, easing: 'ease-out', fill: 'backwards' },
      );
      anim.onfinish = () => g.remove();
    }
  }

  return {
    root,
    ratio: (width + 2) / (height + 2),
    show(step, outcome, ms) {
      for (const t of timers.splice(0)) clearTimeout(t);
      const animated = ms > 0 && lastStep !== undefined && !calm();
      const changed = step !== lastStep;
      const at = centre(step);
      warrior.style.transition = animated ? `transform ${Math.round(ms * 0.9)}ms ease-in-out` : 'none';
      warrior.style.transform = `translate(${at.x}px, ${at.y}px)`;

      for (const [i, el] of hydraEls.entries()) {
        const slain = step.slain[i]!;
        if (slain && !el.classList.contains('slain') && changed && animated) sparks(at, 9, 5, '#ff8a80', ms * 0.3);
        el.classList.toggle('slain', slain);
      }
      for (const [i, el] of goldEls.entries()) {
        const taken = step.taken[i]!;
        if (taken && !el.classList.contains('taken') && changed && animated) sparks(centre(world.gold[i]!), 7, 4, '#ffd43b', ms * 0.6);
        el.classList.toggle('taken', taken);
      }
      if (changed && animated && lastStep) {
        if (step.action === 'attack') heroStrike(warrior, Math.max(300, ms * 0.8));
        else if (step.x !== lastStep.x || step.y !== lastStep.y) heroWalk(warrior, Math.round(ms * 0.9));
      }

      root.classList.toggle('eaten', outcome?.kind === 'eaten');
      root.classList.toggle('crashed', outcome?.kind === 'crash');
      root.classList.toggle('stuck', outcome !== undefined && !['success', 'eaten', 'crash'].includes(outcome.kind));
      root.classList.toggle('won', outcome?.kind === 'success');
      // The head that bit.
      const biter = outcome?.kind === 'eaten' ? world.hydras.findIndex((h) => h.head.x === step.x && h.head.y === step.y) : -1;
      for (const [i, el] of hydraEls.entries()) el.classList.toggle('biting', i === biter);
      if (outcome !== undefined && (outcome !== lastOutcome || changed) && animated) {
        const delay = ms * 0.8;
        const jolt = [{ translate: '0 0' }, { translate: '-1.2px 0', offset: 0.2 }, { translate: '1.2px 0', offset: 0.4 }, { translate: '-0.8px 0', offset: 0.6 }, { translate: '0 0' }];
        if (outcome.kind === 'success') {
          sparks({ x: at.x, y: at.y - 2 }, 14, 9, '#ffd43b', delay);
          later(delay, () => heroCheer(warrior, 900));
        } else if (outcome.kind === 'eaten') {
          const bite = hydraEls[biter]?.querySelector('.hunt-head-bite');
          if (bite) play(bite, [{ scale: '1' }, { scale: '1.6', offset: 0.4 }, { scale: '1.2' }], 600, delay * 0.5);
          play(art, [{ scale: '1', opacity: 1 }, { scale: '0.4', opacity: 0.2 }], 600, delay);
          later(delay, () => heroEaten(warrior, 600));
          play(root, jolt, 450, delay);
        } else if (outcome.kind === 'crash') {
          play(root, jolt, 450, delay);
          later(delay, () => heroBump(warrior, 450));
        } else play(root, jolt, 450, delay);
      }
      lastStep = step;
      lastOutcome = outcome;
    },
  };
}
