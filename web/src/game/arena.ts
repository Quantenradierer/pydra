import { svg } from '../dom.ts';
import { logoArt } from '../hydra/view.ts';
import type { Outcome, Point, Snapshot, World } from './world.ts';

/** Size of one grid cell in viewBox units. */
const CELL = 10;
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

export interface Arena {
  root: SVGSVGElement;
  /** Draws one step of a run; `outcome` is set on the last step, to show a crash. */
  show(step: Snapshot, outcome?: Outcome): void;
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
  const cells: string[] = [];
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      if (world.rocks.has(`${x},${y}`)) {
        cells.push(`<rect class="arena-rock" x="${x * CELL + 0.8}" y="${y * CELL + 0.8}" width="${CELL - 1.6}" height="${CELL - 1.6}" rx="3"/>`);
      } else {
        cells.push(`<circle class="arena-dot" cx="${x * CELL + CELL / 2}" cy="${y * CELL + CELL / 2}" r="0.5"/>`);
      }
    }
  }
  const fish = world.fish
    .map((f, i) => {
      const c = centre(f);
      return `<path class="arena-fish" data-index="${i}" d="${FISH}" transform="translate(${c.x} ${c.y})"/>`;
    })
    .join('');

  const root = svg(`<svg class="arena" viewBox="-1 -1 ${width + 2} ${height + 2}" aria-hidden="true" focusable="false" data-testid="arena">
  <rect class="arena-water" x="-1" y="-1" width="${width + 2}" height="${height + 2}" rx="3"/>
  ${cells.join('')}
  ${fish}
  <path class="arena-body"/>
  <path class="arena-scales"/>
  <g class="arena-hydra"><g class="arena-head-turn"><g transform="scale(0.11) translate(-38 3)"><use href="#hydra-head" class="arena-skull"/><use href="#hydra-eye" class="arena-eye"/></g></g></g>
  <g class="arena-bump"><path d="M0-3.2 1-1 3.2-1.4 1.6.4 2.4 2.8 0 1.4-2.4 2.8-1.6.4-3.2-1.4-1-1Z"/></g>
</svg>`);
  root.prepend(logoArt().querySelector('defs')!);

  const body = root.querySelector<SVGPathElement>('.arena-body')!;
  const scales = root.querySelector<SVGPathElement>('.arena-scales')!;
  const hydra = root.querySelector<SVGGElement>('.arena-hydra')!;
  const turn = root.querySelector<SVGGElement>('.arena-head-turn')!;
  const bump = root.querySelector<SVGGElement>('.arena-bump')!;
  const fishes = [...root.querySelectorAll<SVGPathElement>('.arena-fish')];
  /** Rotation in degrees, kept continuous so a turn never spins the long way round. */
  let angle: number | undefined;

  return {
    root,
    show(step, outcome) {
      const head = centre(step);
      const points = [head, ...step.body.map(centre)];
      const d = `M${points.map((p) => `${p.x} ${p.y}`).join('L')}`;
      body.setAttribute('d', d);
      scales.setAttribute('d', d);
      // The head artwork faces east (dir 1).
      const target = (step.dir - 1) * 90;
      angle = angle === undefined ? target : angle + ((((target - angle) % 360) + 540) % 360) - 180;
      hydra.style.transform = `translate(${head.x}px, ${head.y}px)`;
      turn.style.transform = `rotate(${angle}deg)`;
      for (const [i, el] of fishes.entries()) el.classList.toggle('eaten', step.eaten[i]!);

      const crashed = outcome?.kind === 'crash';
      root.classList.toggle('crashed', crashed);
      root.classList.toggle('stuck', outcome !== undefined && outcome.kind !== 'success' && !crashed);
      root.classList.toggle('fed', outcome?.kind === 'success');
      if (crashed) {
        // The star sits on the edge between the hydra and the rock it bumped into.
        bump.setAttribute('transform', `translate(${head.x + (DX[step.dir]! * CELL) / 2} ${head.y + (DY[step.dir]! * CELL) / 2})`);
      }
    },
  };
}
