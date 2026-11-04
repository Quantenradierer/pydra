/**
 * The hero of "Hydra hunt": the warrior's artwork and his moves. Drawn in
 * viewBox units of the hunt arena, where one grid cell is 10 units wide,
 * centred on the origin (the middle of his cell). The arena moves the
 * outer group; everything inside is the hero's own. Styles: the "Hero"
 * section of style.css.
 *
 * Structure: `.hunt-warrior-art` (scaled/faded by the arena) > `.hunt-hero-pose`
 * (lunges, hops and bobs) > the parts. Legs and the sword arm sit in
 * `.hunt-pivot` groups whose origin is their joint (hip, shoulder), so they
 * rotate about it.
 */

/** The warrior, centred on the origin, facing right: helmet with plume, red tunic, a round shield and a sword in the right hand. */
export const HERO_SVG = `<g class="hunt-warrior-art">
  <ellipse class="hunt-hero-shadow" cx="0.2" cy="3.75" rx="2.6" ry="0.55"/>
  <g class="hunt-hero-pose">
    <g transform="translate(-0.7 1.7)"><g class="hunt-pivot hunt-leg hunt-leg-back">
      <path class="hunt-shin" d="M0 0 -0.1 1.6"/><path class="hunt-boot" d="M-0.55 1.85h1.2"/>
    </g></g>
    <g transform="translate(0.8 1.7)"><g class="hunt-pivot hunt-leg hunt-leg-front">
      <path class="hunt-shin" d="M0 0 0.1 1.6"/><path class="hunt-boot" d="M-0.35 1.85h1.2"/>
    </g></g>
    <path class="hunt-tunic" d="M-1.5-0.7H1.7L2.2 2.1H-2z"/>
    <path class="hunt-belt" d="M-1.75 1H1.95"/>
    <rect class="hunt-buckle" x="0.45" y="0.68" width="0.65" height="0.65" rx="0.12"/>
    <path class="hunt-plume" d="M0.1-3.6C-0.3-4.6-1.6-4.7-2.5-3.9C-1.7-4-1.2-3.6-0.9-3.1Z"/>
    <circle class="hunt-face" cx="0.25" cy="-2.1" r="1.55"/>
    <path class="hunt-helmet" d="M-1.45-2.15A1.75 1.75 0 0 1 1.95-2.15Z"/>
    <path class="hunt-helmet-rim" d="M-1.6-2.15H2.1"/>
    <circle class="hunt-eye" cx="0.95" cy="-1.65" r="0.32"/>
    <circle class="hunt-eye-shine" cx="1.05" cy="-1.76" r="0.1"/>
    <path class="hunt-smile" d="M0.55-0.95Q1.05-0.7 1.5-1.1"/>
    <g class="hunt-shield">
      <circle class="hunt-shield-plate" cx="-1.75" cy="0.55" r="1.45"/>
      <circle class="hunt-shield-boss" cx="-1.75" cy="0.55" r="0.5"/>
    </g>
    <g transform="translate(1.2 -0.4)"><g class="hunt-pivot hunt-sword">
      <path class="hunt-blade-edge" d="M1.25 0.24 2.9-2.63"/>
      <path class="hunt-blade" d="M1.25 0.24 2.9-2.63"/>
      <path class="hunt-arm" d="M-0.1 0 1.1 0.5"/>
      <path class="hunt-grip" d="M1.25 0.24 0.85 0.95"/>
      <path class="hunt-hilt" d="M0.55-0.16 1.95 0.64"/>
      <circle class="hunt-pommel" cx="0.8" cy="1.05" r="0.3"/>
      <circle class="hunt-fist" cx="1.05" cy="0.6" r="0.42"/>
    </g></g>
    <path class="hunt-swoosh" d="M0.4-4.3Q6.2-2.6 2.6 3.4"/>
    <g class="hunt-dizzy" transform="translate(0.25 -4.1)"><g class="hunt-star"><path d="M0-0.75 0.22-0.3 0.71-0.23 0.36 0.11 0.44 0.6 0 0.37-0.44 0.6-0.36 0.11-0.71-0.23-0.22-0.3z"/></g><g class="hunt-star"><path d="M0-0.75 0.22-0.3 0.71-0.23 0.36 0.11 0.44 0.6 0 0.37-0.44 0.6-0.36 0.11-0.71-0.23-0.22-0.3z"/></g></g>
    <text class="hunt-puzzled" x="2.6" y="-3.1">?</text>
  </g>
</g>`;

type Frames = Keyframe[];

function run(el: Element | null | undefined, frames: Frames, ms: number, easing = 'ease-in-out') {
  el?.animate?.(frames, { duration: ms, easing });
}

/**
 * Swings the sword once (an attack): he pulls the sword back over his head,
 * then lunges and slashes down in front of him with a white swoosh.
 * `root` is the group that holds HERO_SVG.
 */
export function heroStrike(root: Element, ms: number) {
  run(
    root.querySelector('.hunt-sword'),
    [
      { rotate: '0deg' },
      { rotate: '-80deg', offset: 0.35, easing: 'ease-in' },
      { rotate: '105deg', offset: 0.55, easing: 'ease-out' },
      { rotate: '95deg', offset: 0.75 },
      { rotate: '0deg' },
    ],
    ms,
  );
  run(
    root.querySelector('.hunt-hero-pose'),
    [
      { translate: '0 0', rotate: '0deg' },
      { translate: '-0.5px 0', rotate: '-6deg', offset: 0.35, easing: 'ease-in' },
      { translate: '1.1px 0.2px', rotate: '8deg', offset: 0.55 },
      { translate: '1.1px 0.2px', rotate: '8deg', offset: 0.75 },
      { translate: '0 0', rotate: '0deg' },
    ],
    ms,
  );
  run(
    root.querySelector('.hunt-swoosh'),
    [
      { opacity: 0, strokeDashoffset: 11 },
      { opacity: 0, strokeDashoffset: 11, offset: 0.38 },
      { opacity: 0.95, strokeDashoffset: 0, offset: 0.56 },
      { opacity: 0, strokeDashoffset: 0, offset: 0.85 },
      { opacity: 0, strokeDashoffset: 0 },
    ],
    ms,
    'linear',
  );
}

/** Walking from one cell to the next: two hopping steps with swinging legs. Call with the same `ms` as the move. */
export function heroWalk(root: Element, ms: number) {
  run(
    root.querySelector('.hunt-hero-pose'),
    [{ translate: '0 0' }, { translate: '0 -0.6px' }, { translate: '0 0' }, { translate: '0 -0.6px' }, { translate: '0 0' }],
    ms,
    'linear',
  );
  const swing = (a: number): Frames => [{ rotate: '0deg' }, { rotate: `${a}deg` }, { rotate: `${-a}deg` }, { rotate: `${a}deg` }, { rotate: '0deg' }];
  run(root.querySelector('.hunt-leg-front'), swing(-28), ms, 'linear');
  run(root.querySelector('.hunt-leg-back'), swing(28), ms, 'linear');
}

/** A victory hop with the sword thrust up into the air. */
export function heroCheer(root: Element, ms: number) {
  run(
    root.querySelector('.hunt-hero-pose'),
    [
      { translate: '0 0' },
      { translate: '0 0.3px', offset: 0.15 },
      { translate: '0 -1.8px', offset: 0.45, easing: 'ease-in' },
      { translate: '0 0', offset: 0.75 },
      { translate: '0 -0.6px', offset: 0.87 },
      { translate: '0 0' },
    ],
    ms,
    'ease-out',
  );
  run(root.querySelector('.hunt-sword'), [{ rotate: '0deg' }, { rotate: '-40deg', offset: 0.4 }, { rotate: '-28deg', offset: 0.7 }, { rotate: '-35deg' }], ms);
}

/** Walking into a rock or the edge: he bumps forward and staggers back. */
export function heroBump(root: Element, ms: number) {
  run(
    root.querySelector('.hunt-hero-pose'),
    [
      { translate: '0 0', rotate: '0deg' },
      { translate: '1.2px 0', rotate: '4deg', offset: 0.25, easing: 'ease-in' },
      { translate: '-0.8px 0', rotate: '-12deg', offset: 0.5 },
      { translate: '-0.3px 0', rotate: '6deg', offset: 0.72 },
      { translate: '0 0', rotate: '0deg' },
    ],
    ms,
    'ease-out',
  );
}

/** Grabbed by a hydra head: he flails and spins as he is gulped (play together with the arena's shrink/fade of the art). */
export function heroEaten(root: Element, ms: number) {
  run(
    root.querySelector('.hunt-hero-pose'),
    [
      { translate: '0 0', rotate: '0deg' },
      { translate: '0 -1.2px', rotate: '-20deg', offset: 0.3 },
      { translate: '0 -0.6px', rotate: '200deg', offset: 0.8 },
      { translate: '0 0', rotate: '360deg' },
    ],
    ms,
    'ease-in',
  );
  const kick = (a: number): Frames => [{ rotate: '0deg' }, { rotate: `${a}deg` }, { rotate: `${-a}deg` }, { rotate: `${a}deg` }, { rotate: '0deg' }];
  run(root.querySelector('.hunt-leg-front'), kick(-35), ms, 'linear');
  run(root.querySelector('.hunt-leg-back'), kick(35), ms, 'linear');
}
