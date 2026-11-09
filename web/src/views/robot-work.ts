import { h } from '../dom.ts';
import type { MessageKey, Params } from '../i18n.ts';

type T = (key: MessageKey, params?: Params) => string;

export type ZoneId = 'task' | 'robot' | 'code' | 'fight';
export type Phase = 'build' | 'code' | 'fight' | 'improve';
export const ZONES: readonly ZoneId[] = ['task', 'robot', 'code', 'fight'];
export const PHASES: readonly Phase[] = ['build', 'code', 'fight', 'improve'];

export interface Zone {
  id: ZoneId;
  /** The body (scrolls inside the zone). */
  body: HTMLElement;
  /** Sticky buttons at the bottom of the zone. */
  actions: HTMLElement;
  /** Extra buttons next to the zone title. */
  tools: HTMLElement;
  head: HTMLElement;
  el: HTMLElement;
}

export interface Drawer {
  open(): void;
  close(): void;
  isOpen(): boolean;
  /** Replace the content. */
  set(...nodes: Node[]): void;
}

/**
 * The zoned work screen of a battle: Task | Robot | Code | Fight. On a desktop all four sit on the screen
 * (task and robot stacked on the left); on a phone one zone fills the screen and a bottom bar switches.
 * A step indicator (Build, Code, Fight, Improve) says where the player is in the loop.
 */
export function createWork(t: T, header: HTMLElement) {
  const steps = h(
    'ol',
    { class: 'rb-steps', 'aria-label': t('work.steps'), 'data-testid': 'robot-steps' },
    ...PHASES.map((p, i) => h('li', { 'data-phase': p, 'data-testid': `robot-phase-${p}` }, h('span', { class: 'rb-step-n', 'aria-hidden': 'true' }, String(i + 1)), h('span', {}, t(`work.phase.${p}` as MessageKey)))),
  );
  const zones = {} as Record<ZoneId, Zone>;
  const tabs: Partial<Record<ZoneId, HTMLButtonElement>> = {};
  let active: ZoneId = 'task';

  for (const id of ZONES) {
    const title = h('h2', { id: `rb-zone-title-${id}`, tabindex: -1 }, t(`work.zone.${id}` as MessageKey));
    const tools = h('div', { class: 'rb-zone-tools' });
    const head = h('header', { class: 'rb-zone-head' }, h('div', { class: 'rb-zone-titles' }, title, h('p', {}, t(`work.zone.${id}.purpose` as MessageKey))), tools);
    const body = h('div', { class: 'rb-zone-body' });
    const actions = h('div', { class: 'rb-zone-actions' });
    const el = h('section', { class: 'rb-zone', 'data-zone': id, 'aria-labelledby': `rb-zone-title-${id}`, 'data-testid': `zone-${id}` }, head, body, actions);
    zones[id] = { id, body, actions, tools, head, el };
  }
  const tabBar = h(
    'nav',
    { class: 'rb-tabs', 'aria-label': t('work.tabs'), 'data-testid': 'zone-tabs' },
    ...ZONES.map((id) => (tabs[id] = h('button', { class: 'rb-tab', 'data-testid': `zone-tab-${id}`, onclick: () => show(id, true) }, h('span', { class: 'rb-tab-icon', 'aria-hidden': 'true' }), h('span', {}, t(`work.zone.${id}` as MessageKey))) as HTMLButtonElement)),
  );
  const top = h('div', { class: 'rb-top' }, header, steps);
  const el = h('div', { class: 'rb-work', 'data-testid': 'robot-work', 'data-active': active }, top, h('div', { class: 'rb-zones' }, ...ZONES.map((id) => zones[id].el)), tabBar);

  const listeners: ((z: ZoneId) => void)[] = [];
  /** Shows a zone (the one that fills a phone) and moves focus to its title. */
  function show(id: ZoneId, focus = false) {
    active = id;
    el.dataset.active = id;
    for (const z of ZONES) {
      tabs[z]!.setAttribute('aria-current', z === id ? 'true' : 'false');
    }
    if (focus) zones[id].el.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
    for (const l of listeners) l(id);
  }
  function phase(p: Phase) {
    for (const li of steps.children) {
      const on = li.getAttribute('data-phase') === p;
      li.classList.toggle('current', on);
      if (on) li.setAttribute('aria-current', 'step');
      else li.removeAttribute('aria-current');
    }
    el.dataset.phase = p;
  }

  /** A panel that replaces the zone's body until it is closed; focus goes in and comes back to the opener. */
  function drawer(zone: ZoneId, title: string, opener: HTMLElement): Drawer {
    const z = zones[zone];
    const heading = h('h3', { tabindex: -1 }, title);
    const content = h('div', { class: 'rb-drawer-body' });
    const closeBtn = h('button', { class: 'run-control rb-drawer-close', 'data-testid': 'drawer-close', onclick: () => close() }, t('work.close'));
    const box = h('aside', { class: 'rb-drawer', hidden: true, 'aria-label': title }, h('header', {}, heading, closeBtn), content);
    box.addEventListener('keydown', (e) => (e as KeyboardEvent).key === 'Escape' && (e.stopPropagation(), close()));
    z.el.insertBefore(box, z.actions);
    opener.setAttribute('aria-expanded', 'false');
    opener.addEventListener('click', () => (box.hidden ? open() : close()));
    function open() {
      for (const other of z.el.querySelectorAll<HTMLElement>('.rb-drawer')) if (other !== box && !other.hidden) other.querySelector<HTMLButtonElement>('.rb-drawer-close')?.click();
      box.hidden = false;
      z.body.hidden = true;
      opener.setAttribute('aria-expanded', 'true');
      heading.focus({ preventScroll: true });
    }
    function close() {
      if (box.hidden) return;
      box.hidden = true;
      z.body.hidden = false;
      opener.setAttribute('aria-expanded', 'false');
      opener.focus({ preventScroll: true });
    }
    return { open, close, isOpen: () => !box.hidden, set: (...nodes) => content.replaceChildren(...nodes) };
  }

  show('task');
  return { el, zones, show, active: () => active, phase, drawer, onZone: (l: (z: ZoneId) => void) => listeners.push(l) };
}
