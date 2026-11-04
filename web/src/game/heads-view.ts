import { h, svg } from '../dom.ts';
import { logoArt } from '../hydra/view.ts';
import type { MessageKey, Params } from '../i18n.ts';
import type { HeadsLevel, HeadsOutcome, HeadsSnapshot } from './heads.ts';

/** Most heads drawn at once; with more, the lowest ones fold into a "+N" row. */
export const MAX_HEADS_SHOWN = 4;

/** Most output lines shown; older ones scroll away above. */
const MAX_OUTPUT_LINES = 6;

/** A neck rising from below and a head facing right (the logo's head); the trunk leads on to the heads above. */
const HEAD_ART = `<svg class="head-art" viewBox="0 0 60 40" aria-hidden="true" focusable="false">
  <path class="head-neck head-trunk" d="M14 0V40"/>
  <path class="head-neck" d="M14 40C14 30 14 25 20 22"/>
  <g transform="translate(20 22) scale(0.3)"><use href="#hydra-head" class="head-skull"/><use href="#hydra-eye" class="head-eye"/></g>
</svg>`;

/** The hydra's body, with a neck stub that shows while heads are up. */
const BODY_ART = `<svg class="body-art" viewBox="0 0 60 40" aria-hidden="true" focusable="false">
  <path class="head-neck body-neck" d="M14 0V30"/>
  <ellipse class="body-blob" cx="22" cy="31" rx="20" ry="8"/>
  <path class="body-tail" d="M40 31Q52 30 56 22"/>
</svg>`;

const vars = (pairs: [string, string][]) => pairs.map(([name, value]) => h('code', {}, `${name} = ${value}`));

export interface HeadsStage {
  root: HTMLElement;
  ratio: number;
  show(step: HeadsSnapshot, outcome: HeadsOutcome | undefined, ms: number): void;
}

/**
 * The heads game's stage: the hydra's body at the bottom holds the main
 * program's variables, and every running function call is a head on top,
 * labelled with the call and holding its local variables. A finished call
 * pulls its head back and hands its value down. The goal sits beside it.
 */
export function headsStage(level: HeadsLevel, t: (key: MessageKey, params?: Params) => string): HeadsStage {
  const stack = h('div', { class: 'heads-stack' });
  const more = h('div', { class: 'heads-more', 'data-testid': 'heads-more' });
  const mainVars = h('span', { class: 'head-vars' });
  const mainCard = h('div', { class: 'head-card main' }, h('span', { class: 'head-label' }, t('heads.main')), mainVars);
  const body = svg(BODY_ART);
  // The head and eye shapes the heads use come from the logo.
  body.prepend(logoArt().querySelector('defs')!);
  const base = h('div', { class: 'heads-base' }, body, mainCard);
  const output = h('pre', { class: 'heads-output-lines', 'data-testid': 'heads-output' });
  const outputBox = h('div', { class: 'heads-output' }, h('span', { class: 'heads-caption' }, t('heads.output')), output);
  const goalLines = [
    ...Object.entries(level.goal.vars ?? {}).map(([name, value]) => `${name} = ${value}`),
    ...(level.goal.output ?? []),
  ];
  const goal = h(
    'div',
    { class: 'heads-goal', 'data-testid': 'heads-goal' },
    h('span', { class: 'heads-caption' }, level.goal.output ? t('heads.goalOutput') : t('heads.goal')),
    h('pre', {}, goalLines.join('\n')),
  );
  const root = h(
    'div',
    { class: 'heads-board', role: 'group', 'aria-label': t('heads.board'), 'data-testid': 'heads-board' },
    h('div', { class: 'heads-inner' }, h('div', { class: 'heads-hydra' }, stack, base), h('div', { class: 'heads-side' }, goal, outputBox)),
  );

  /** The head of each running call, by its depth (0 = the first call). */
  const shown = new Map<number, HTMLElement>();
  let count = 0;
  let lastStep: HeadsSnapshot | undefined;

  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function play(el: Element, frames: Keyframe[], duration: number) {
    if (calm() || !el.animate) return undefined;
    return el.animate(frames, { duration, easing: 'ease-out' });
  }

  function headElement(): HTMLElement {
    return h(
      'div',
      { class: 'head-frame', 'data-testid': 'head' },
      svg(HEAD_ART),
      h('div', { class: 'head-card' }, h('code', { class: 'head-label' }), h('span', { class: 'head-vars' })),
    );
  }

  return {
    root,
    ratio: 1.45,
    show(step, outcome, ms) {
      const animated = ms > 0 && step !== lastStep && lastStep !== undefined;
      const heads = step.heads;
      const hidden = heads.length > MAX_HEADS_SHOWN ? heads.length - (MAX_HEADS_SHOWN - 1) : 0;
      const duration = Math.max(250, Math.min(600, ms * 0.7));

      for (const [depth, el] of shown) {
        if (depth < heads.length && depth >= hidden) continue;
        shown.delete(depth);
        // A finished call pulls its head back down; one that only folded into "+N" just goes.
        const anim = animated && depth >= heads.length ? play(el, [{ transform: 'none', opacity: 1 }, { transform: 'translateY(60%) scale(0.3)', opacity: 0 }], duration) : undefined;
        if (anim) {
          el.classList.add('leaving');
          el.removeAttribute('data-testid');
          el.setAttribute('aria-hidden', 'true');
          anim.onfinish = () => el.remove();
        } else el.remove();
      }
      for (let depth = hidden; depth < heads.length; depth++) {
        let el = shown.get(depth);
        if (!el) {
          el = headElement();
          shown.set(depth, el);
          if (animated && depth >= count) {
            play(el, [{ transform: 'translateY(60%) scale(0.3)', opacity: 0 }, { transform: 'none', opacity: 1 }], duration);
          }
        }
        const head = heads[depth]!;
        el.querySelector('.head-label')!.textContent = head.label;
        el.querySelector('.head-vars')!.replaceChildren(...vars(head.vars));
        el.classList.toggle('top', depth === heads.length - 1);
        el.classList.remove('head-error');
      }
      more.textContent = hidden > 0 ? t('heads.more', { n: hidden }) : '';
      // Bottom to top: the folded heads, then the heads drawn; leaving heads stay on top while they go.
      const leaving = [...stack.querySelectorAll('.leaving')];
      stack.replaceChildren(...(hidden > 0 ? [more] : []), ...[...shown.entries()].sort(([a], [b]) => a - b).map(([, el]) => el), ...leaving);
      count = heads.length;

      mainVars.replaceChildren(...vars(step.globals));
      base.classList.toggle('busy', heads.length > 0);
      mainCard.classList.toggle('top', heads.length === 0);

      // The value a finished call handed back lands on the card that called it.
      root.querySelector('.head-return')?.remove();
      if (step.returned) {
        const target = heads.length > 0 ? shown.get(heads.length - 1)?.querySelector('.head-card') : mainCard;
        const pill = h('span', { class: 'head-return', 'data-testid': 'head-return' }, `${step.returned.name} → ${step.returned.value}`);
        target?.append(pill);
        if (animated) play(pill, [{ transform: 'translateY(-120%)', opacity: 0 }, { transform: 'none', opacity: 1 }], duration);
      }

      const lines = step.output.length > MAX_OUTPUT_LINES ? ['…', ...step.output.slice(-(MAX_OUTPUT_LINES - 1))] : step.output;
      output.textContent = lines.join('\n');
      outputBox.hidden = step.output.length === 0 && !level.goal.output;

      root.classList.toggle('solved', outcome?.kind === 'success');
      root.classList.toggle('failed', outcome !== undefined && outcome.kind !== 'success');
      if (outcome?.kind === 'error') shown.get(heads.length - 1)?.classList.add('head-error');
      if (outcome && animated) {
        if (outcome.kind === 'success') play(goal, [{ transform: 'scale(1)' }, { transform: 'scale(1.08)', offset: 0.4 }, { transform: 'scale(1)' }], 600);
        else play(root, [{ translate: '0 0' }, { translate: '-4px 0', offset: 0.25 }, { translate: '4px 0', offset: 0.5 }, { translate: '-2px 0', offset: 0.75 }, { translate: '0 0' }], 400);
      }
      lastStep = step;
    },
  };
}
