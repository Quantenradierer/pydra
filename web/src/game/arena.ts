import { svg } from '../dom.ts';
import { logoArt } from '../hydra/view.ts';
import type { Outcome, Point, Snapshot, World } from './world.ts';

/** Size of one grid cell in viewBox units. */
const CELL = 10;
/** Distance from the middle of the head to where the body joins it. */
const NECK = 3.5;
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

export interface Arena {
  root: SVGSVGElement;
  /**
   * Draws one step of a run; `outcome` is set on the last step, to show a
   * crash. With `ms` > 0 the head and every body segment glide to their new
   * places together, otherwise they jump.
   */
  show(step: Snapshot, outcome?: Outcome, ms?: number): void;
}

const centre = (p: Point) => ({ x: p.x * CELL + CELL / 2, y: p.y * CELL + CELL / 2 });

/** A small fish facing left, centred on the origin. */
const FISH = 'M-3.4 0C-1.8-2.4 1-2.4 2.2-.4L3.8-1.8V1.8L2.2.4C1 2.4-1.8 2.4-3.4 0Z';

/**
 * The pool the hydra swims in, seen from above: rocks, fish and the hydra,
 * whose body grows with every fish. Decorative: the screen describes each
 * run in text.
 */
export function arena(world: World): Arena {
  const width = world.width * CELL;
  const height = world.height * CELL;
  const rocks: string[] = [];
  let checker = '';
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
  const fish = world.fish
    .map((f, i) => {
      const c = centre(f);
      return `<path class="arena-fish" data-index="${i}" d="${FISH}" transform="translate(${c.x} ${c.y})"/>`;
    })
    .join('');

  const root = svg(`<svg class="arena" viewBox="-1 -1 ${width + 2} ${height + 2}" aria-hidden="true" focusable="false" data-testid="arena">
  <rect class="arena-water" x="-1" y="-1" width="${width + 2}" height="${height + 2}" rx="3"/>
  <path class="arena-checker" d="${checker}"/>
  <path class="arena-grid" d="${lines}"/>
  ${rocks.join('')}
  ${fish}
  <path class="arena-body"/>
  <path class="arena-scales"/>
  <g class="arena-hydra"><g class="arena-head-turn"><g class="arena-head-pulse"><g transform="scale(0.11) translate(-38 3)"><use href="#hydra-head" class="arena-skull"/><use href="#hydra-eye" class="arena-eye"/></g></g></g></g>
  <g class="arena-fx"></g>
  <g class="arena-bump"><path d="M0-3.2 1-1 3.2-1.4 1.6.4 2.4 2.8 0 1.4-2.4 2.8-1.6.4-3.2-1.4-1-1Z"/></g>
</svg>`);
  root.prepend(logoArt().querySelector('defs')!);

  const body = root.querySelector<SVGPathElement>('.arena-body')!;
  const scales = root.querySelector<SVGPathElement>('.arena-scales')!;
  const hydra = root.querySelector<SVGGElement>('.arena-hydra')!;
  const turn = root.querySelector<SVGGElement>('.arena-head-turn')!;
  const pulse = root.querySelector<SVGGElement>('.arena-head-pulse')!;
  const fx = root.querySelector<SVGGElement>('.arena-fx')!;
  const bump = root.querySelector<SVGGElement>('.arena-bump')!;
  const fishes = [...root.querySelectorAll<SVGPathElement>('.arena-fish')];
  /** Rotation of the head in degrees, kept continuous so a turn never spins the long way round. */
  let angle: number | undefined;
  /** Direction the hydra faced before the current step. */
  let dir: number | undefined;
  /** Where the head and body are drawn now, in viewBox units. */
  let drawn: Point[] = [];
  let frame = 0;
  let lastStep: Snapshot | undefined;
  let lastOutcome: Outcome | undefined;
  let lastLength = 0;

  /** Draws the snake through these points; the first one is the head. */
  function draw(points: Point[], deg: number) {
    drawn = points;
    // The body ends at the back of the head (its neck), not in the middle of it.
    const rad = (deg * Math.PI) / 180;
    const neck = { x: points[0]!.x - Math.cos(rad) * NECK, y: points[0]!.y - Math.sin(rad) * NECK };
    const d = `M${[neck, ...points.slice(1)].map((p) => `${p.x} ${p.y}`).join('L')}`;
    body.setAttribute('d', d);
    scales.setAttribute('d', d);
    hydra.setAttribute('transform', `translate(${points[0]!.x} ${points[0]!.y})`);
    turn.setAttribute('transform', `rotate(${deg})`);
  }

  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** Plays a one-shot effect; skipped for people who asked for less motion. */
  function play(el: Element, frames: Keyframe[], duration: number, delay = 0) {
    if (calm() || !el.animate) return;
    el.animate(frames, { duration, delay, easing: 'ease-out', fill: 'backwards' });
  }
  /** A burst of small bubbles that pop outwards from a point and fade. */
  function burst(at: Point, count: number, reach: number, duration: number, delay: number, colour: string) {
    if (calm()) return;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + at.x;
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('r', '0.9');
      c.setAttribute('fill', colour);
      c.setAttribute('cx', String(at.x));
      c.setAttribute('cy', String(at.y));
      fx.append(c);
      const anim = c.animate(
        [
          { transform: 'translate(0,0) scale(0.4)', opacity: 0.9 },
          { transform: `translate(${Math.cos(a) * reach}px,${Math.sin(a) * reach}px) scale(1.1)`, opacity: 0 },
        ],
        { duration, delay, easing: 'ease-out', fill: 'backwards' },
      );
      anim.onfinish = () => c.remove();
    }
  }

  const ease = (k: number) => 0.5 * k + 0.5 * (k * k * (3 - 2 * k));

  return {
    root,
    show(step, outcome, ms = 0) {
      cancelAnimationFrame(frame);
      const to = [step, ...step.body].map(centre);
      const from = drawn;
      const animated = ms > 0 && from.length > 0 && !calm();
      // The head artwork faces east (dir 1).
      const target = (step.dir - 1) * 90;
      const fromAngle = angle ?? target;
      const toAngle = angle === undefined ? target : angle + ((((target - angle) % 360) + 540) % 360) - 180;
      const fromDir = dir ?? step.dir;
      angle = toAngle;
      dir = step.dir;
      if (!animated) draw(to, toAngle);
      else {
        // Every point glides from where it was to where it goes (a segment takes the
        // place of the one in front of it), so the body never lags behind the head.
        // The head is not glided but swings round its neck, which glides like the body.
        const neckFrom = { x: from[0]!.x - DX[fromDir]! * CELL, y: from[0]!.y - DY[fromDir]! * CELL };
        const neckTo = { x: to[0]!.x - DX[step.dir]! * CELL, y: to[0]!.y - DY[step.dir]! * CELL };
        const start = performance.now();
        const tick = (now: number) => {
          const k = ease(Math.min(1, (now - start) / ms));
          const deg = fromAngle + (toAngle - fromAngle) * k;
          const rad = (deg * Math.PI) / 180;
          const nx = neckFrom.x + (neckTo.x - neckFrom.x) * k;
          const ny = neckFrom.y + (neckTo.y - neckFrom.y) * k;
          const points = to.map((p, i) => {
            const q = from[Math.min(i, from.length - 1)]!;
            return { x: q.x + (p.x - q.x) * k, y: q.y + (p.y - q.y) * k };
          });
          points[0] = { x: nx + Math.cos(rad) * CELL, y: ny + Math.sin(rad) * CELL };
          draw(points, deg);
          if (now - start < ms) frame = requestAnimationFrame(tick);
        };
        tick(start);
      }
      const head = to[0]!;
      const changed = step !== lastStep;
      const dur = Math.max(300, Math.min(900, ms * 0.8));
      for (const [i, el] of fishes.entries()) {
        const eaten = step.eaten[i]!;
        if (eaten && !el.classList.contains('eaten') && changed && animated) {
          burst(centre(world.fish[i]!), 6, 9, dur, ms * 0.6, '#cfe8ff');
        }
        el.classList.toggle('eaten', eaten);
      }
      if (changed && animated) {
        const length = step.body.length;
        if (length > lastLength && lastLength > 0) {
          // Eating: the head swells a little and a ripple runs down the body.
          play(pulse, [{ transform: 'scale(1)' }, { transform: 'scale(1.35)', offset: 0.4 }, { transform: 'scale(1)' }], dur, ms * 0.7);
          play(body, [{ strokeWidth: 4 }, { strokeWidth: 5.2, offset: 0.4 }, { strokeWidth: 4 }], dur * 1.2, ms * 0.7);
        }
      }
      lastLength = step.body.length;

      const crashed = outcome?.kind === 'crash';
      root.classList.toggle('crashed', crashed);
      root.classList.toggle('stuck', outcome !== undefined && outcome.kind !== 'success' && !crashed);
      root.classList.toggle('fed', outcome?.kind === 'success');
      if (crashed) {
        // The star sits on the edge between the hydra and the rock it bumped into.
        bump.setAttribute('transform', `translate(${head.x + (DX[step.dir]! * CELL) / 2} ${head.y + (DY[step.dir]! * CELL) / 2})`);
      }
      if (outcome !== undefined && (outcome !== lastOutcome || changed) && animated) {
        const jolt = [{ translate: '0 0' }, { translate: '-1.2px 0', offset: 0.2 }, { translate: '1.2px 0', offset: 0.4 }, { translate: '-0.8px 0', offset: 0.6 }, { translate: '0.5px 0', offset: 0.8 }, { translate: '0 0' }];
        if (outcome.kind === 'success') {
          burst(head, 10, 14, 1000, ms * 0.8, '#ffd43b');
          play(pulse, [{ transform: 'scale(1)' }, { transform: 'scale(1.4)', offset: 0.35 }, { transform: 'scale(1)' }], 700, ms * 0.8);
        } else if (crashed) {
          play(root, jolt, 450, ms * 0.8);
          play(turn, [{ translate: '0 0' }, { translate: `${-DX[step.dir]! * 1.5}px ${-DY[step.dir]! * 1.5}px`, offset: 0.3 }, { translate: '0 0' }], 450, ms * 0.8);
        } else play(root, jolt, 450, ms * 0.8);
      }
      lastStep = step;
      lastOutcome = outcome;
    },
  };
}
