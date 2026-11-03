import type { App } from '../app.ts';
import { h, svg } from '../dom.ts';
import { BACK } from '../icons.ts';

/** Heading with a back button, for the screens opened from Home. */
export function subpageHeader(app: App, title: string): HTMLElement {
  return h(
    'header',
    { class: 'subpage-header' },
    h(
      'button',
      { class: 'icon-button', 'aria-label': app.t('nav.back'), title: app.t('nav.back'), onclick: () => app.back() },
      svg(BACK),
    ),
    h('h1', { tabindex: -1 }, title),
  );
}
