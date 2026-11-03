import logo from '../../icons/hydra.svg?raw';
import { svg } from '../dom.ts';
import { HEIGHT, WIDTH, necks, type NeckShape } from './geometry.ts';
import type { HeadState } from './heads.ts';

/** The logo artwork, inline; its <defs> hold the head and eye shapes the quiz hydra reuses. */
export function logoArt(): SVGSVGElement {
  const art = svg(logo);
  art.setAttribute('class', 'logo');
  art.setAttribute('aria-hidden', 'true');
  art.setAttribute('focusable', 'false');
  return art;
}

export interface Hydra {
  root: SVGSVGElement;
  /** Shows a fresh answer: the head is slashed off (right) or regrows (wrong), animated. */
  strike(index: number, correct: boolean): void;
}

/** Wavy swamp surface, wide enough to fill a panel wider than the drawing. */
function water(): string {
  const surface = HEIGHT - 7;
  let d = `M${-2 * WIDTH} ${surface}q5 -3 10 0`;
  for (let x = -2 * WIDTH + 10; x < 3 * WIDTH; x += 10) d += 't10 0';
  return `${d}V${HEIGHT + 1}H${-2 * WIDTH}Z`;
}

function headMarkup(shape: NeckShape, state: HeadState, index: number): string {
  const { base, cut } = shape;
  // Each neck sways at its own phase.
  const style = `--facing: ${shape.facing}; --delay: ${-((index * 1.37) % 4).toFixed(2)}s; transform-origin: ${base.x}px ${base.y}px`;
  return `<g class="hydra-head" data-index="${index}" data-state="${state}" style="${style}">
  <path class="hydra-stump" d="${shape.stump}"/>
  <circle class="hydra-wound" cx="${cut.x}" cy="${cut.y}" r="1.6"/>
  <g class="hydra-upper" style="transform-origin: ${cut.x}px ${cut.y}px">
    <path class="hydra-neck" d="${shape.neck}"/>
    <g transform="${shape.head}"><use href="#hydra-head" class="hydra-skull"/><use href="#hydra-eye" class="hydra-eye"/></g>
  </g>
  <path class="hydra-slash" d="${shape.slash}" pathLength="1"/>
  <circle class="hydra-spark" cx="${cut.x}" cy="${cut.y}" r="5"/>
</g>`;
}

/**
 * The quiz hydra, one head per question. Decorative: progress and answers
 * are announced as text elsewhere. The state of each head is in its
 * data-state attribute; strike() adds the animation for a fresh answer.
 */
export function hydra(states: readonly HeadState[]): Hydra {
  const shapes = necks(states.length);
  const order = [...shapes.keys()].sort((a, b) => Number(shapes[b]!.high) - Number(shapes[a]!.high));
  const root = svg(`<svg class="hydra" viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
  <filter id="hydra-glow" x="-50%" y="-50%" width="200%" height="200%">
    <feDropShadow dx="0" dy="0" stdDeviation="1.5" flood-color="#ffd43b" flood-opacity="0.8"/>
  </filter>
  <path class="hydra-body" d="M8 50C20 36 60 35 100 35S180 36 192 50Z"/>
  ${order.map((i) => headMarkup(shapes[i]!, states[i]!, i)).join('\n')}
  <path class="hydra-tail" d="M186 49C190 42 197 42 195 34C199 40 200 46 195 50Z"/>
  <path class="hydra-water" d="${water()}"/>
</svg>`);
  root.prepend(logoArt().querySelector('defs')!);

  return {
    root,
    strike(index, correct) {
      const head = root.querySelector<SVGGElement>(`.hydra-head[data-index="${index}"]`)!;
      head.dataset.state = correct ? 'slashed' : 'regrown';
      head.classList.add('hydra-strike');
    },
  };
}
