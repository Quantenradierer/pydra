import { h } from '../dom.ts';
import type { MessageKey } from '../i18n.ts';
import type { Build } from '../robot/build.ts';
import { applySuggestion, completionAt, insertSnippet, snippetGroups, type Completion, type Suggestion } from '../robot/suggest.ts';

export interface Editor {
  /** The whole editor (line numbers, text, popup, insert bar): put this on the page. */
  el: HTMLElement;
  area: HTMLTextAreaElement;
  /** Replaces the text from outside (restoring a version) and redraws the line numbers. */
  set(text: string): void;
}

let barOpen = false;
let barGroup = 'flow';

/**
 * The script editor: a text area with line numbers, a suggestion popup while typing (arrows, Tab / Enter accept, Esc closes,
 * tap on a phone) and an insert bar of templates organised by the gear of the build. The suggestions come from
 * robot/suggest.ts; this file is only the DOM around them.
 */
export function createEditor(t: (key: MessageKey) => string, initial: string, build: () => Build, onInput: (text: string) => void, testId = 'robot-code'): Editor {
  const area = h('textarea', {
    class: 'robot-code',
    rows: 4,
    wrap: 'off',
    spellcheck: false,
    autocapitalize: 'off',
    autocomplete: 'off',
    'aria-label': t('robot.code'),
    'aria-autocomplete': 'list',
    'data-testid': testId,
  }) as HTMLTextAreaElement;
  const gutter = h('div', { class: 'robot-gutter', 'aria-hidden': 'true', 'data-testid': `${testId}-lines` });
  const popup = h('ul', { class: 'robot-suggest', role: 'listbox', 'aria-label': t('robot.sug.list'), 'data-testid': `${testId}-suggest`, hidden: true });
  popup.id = `${testId}-suggest`;
  area.setAttribute('aria-controls', popup.id);
  const box = h('div', { class: 'robot-editor-box' }, gutter, area, popup);
  const el = h('div', { class: 'robot-editor' }, box);

  let current: Completion | null = null;
  let active = 0;

  const fit = () => (area.rows = Math.max(5, Math.min(16, area.value.split('\n').length + 1)));
  const lines = () => {
    const n = area.value.split('\n').length;
    gutter.textContent = Array.from({ length: n + 1 }, (_, i) => (i < n ? String(i + 1) : '')).join('\n');
    gutter.scrollTop = area.scrollTop;
  };
  const changed = () => (fit(), lines(), onInput(area.value));

  // ---- the popup
  function close() {
    current = null;
    popup.hidden = true;
    area.removeAttribute('aria-activedescendant');
  }
  function describe(s: Suggestion): string {
    if (s.desc === null) return t('robot.sug.var');
    const d = t(s.desc as MessageKey);
    return s.equipped ? d : `${t('robot.sug.off')} · ${d}`;
  }
  function paint() {
    if (!current) return close();
    popup.replaceChildren(
      ...current.items.map((s, i) => {
        const li = h('li', { class: `robot-suggest-item${i === active ? ' active' : ''}${s.equipped ? '' : ' off'}`, role: 'option', id: `${popup.id}-${i}`, 'aria-selected': String(i === active), 'data-kind': s.kind }, h('code', {}, s.label), h('span', {}, describe(s)));
        // pointerdown, not click: the text area must keep the focus (and the phone keyboard its place).
        li.addEventListener('pointerdown', (e) => (e.preventDefault(), accept(i)));
        return li;
      }),
    );
    popup.hidden = false;
    area.setAttribute('aria-activedescendant', `${popup.id}-${active}`);
    popup.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
    place();
  }
  /** Puts the popup under the caret's line (above it in the lower half), at the caret's column. */
  function place() {
    const before = area.value.slice(0, area.selectionStart);
    const row = before.split('\n').length - 1;
    const col = before.length - (before.lastIndexOf('\n') + 1);
    const lh = parseFloat(getComputedStyle(area).lineHeight) || 22;
    const pad = parseFloat(getComputedStyle(area).paddingTop) || 0;
    const y = pad + (row + 1) * lh - area.scrollTop;
    const above = y > area.clientHeight / 2 && area.clientHeight > 0;
    popup.style.top = above ? '' : `${Math.max(0, y)}px`;
    popup.style.bottom = above ? `${Math.max(0, box.clientHeight - (y - lh))}px` : '';
    const room = box.clientWidth - popup.offsetWidth;
    popup.style.left = `${Math.max(0, Math.min(gutter.offsetWidth + col * 8.8 + 8, room))}px`;
  }
  function refresh(manual = false) {
    current = area.selectionStart === area.selectionEnd ? completionAt(area.value, area.selectionStart, build(), { manual }) : null;
    active = 0;
    paint();
  }
  function accept(i: number) {
    if (!current) return;
    const r = applySuggestion(area.value, current, current.items[i]!);
    area.value = r.text;
    area.setSelectionRange(r.caret, r.caret);
    close();
    changed();
    area.focus({ preventScroll: true });
  }

  area.value = initial;
  fit();
  lines();
  area.addEventListener('input', () => (changed(), refresh()));
  area.addEventListener('scroll', () => ((gutter.scrollTop = area.scrollTop), current && place()));
  area.addEventListener('blur', close);
  area.addEventListener('click', close);
  area.addEventListener('keydown', (e) => {
    if (current && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const n = current.items.length;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        active = (active + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
        return paint();
      }
      if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        return accept(active);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        return close();
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') close();
    }
    if (e.key === ' ' && e.ctrlKey) {
      e.preventDefault();
      return refresh(true);
    }
    if (e.key !== 'Tab' || e.shiftKey) return;
    e.preventDefault();
    area.setRangeText('    ', area.selectionStart, area.selectionEnd, 'end');
    changed();
  });

  // ---- the insert bar
  const groups = () => snippetGroups(build());
  const bar = h('details', { class: 'robot-snippets', 'data-testid': `${testId}-bar` }, h('summary', {}, t('robot.sug.bar')));
  bar.open = barOpen;
  const tabs = h('div', { class: 'robot-snippet-tabs', role: 'group', 'aria-label': t('robot.sug.bar') });
  const row = h('div', { class: 'robot-snippet-row' });
  const keepFocus = (b: HTMLElement) => b.addEventListener('pointerdown', (e) => e.preventDefault());
  function drawBar() {
    const gs = groups();
    if (!gs.some((g) => g.id === barGroup)) barGroup = gs[0]!.id;
    tabs.replaceChildren(
      ...gs.map((g) => {
        const b = h('button', { type: 'button', class: 'robot-snippet-tab', 'aria-pressed': String(g.id === barGroup), 'data-testid': `snippet-group-${g.id}`, onclick: () => ((barGroup = g.id), drawBar()) }, t(`robot.sug.group.${g.id}` as MessageKey));
        keepFocus(b);
        return b;
      }),
    );
    row.replaceChildren(
      ...gs
        .find((g) => g.id === barGroup)!
        .snippets.map((s) => {
          const b = h('button', {
            type: 'button',
            class: 'robot-snippet',
            'data-testid': 'snippet',
            onclick: () => {
              const r = insertSnippet(area.value, area.selectionStart, area.selectionEnd, s);
              area.value = r.text;
              area.setSelectionRange(r.caret, r.caret);
              close();
              changed();
              area.focus({ preventScroll: true });
            },
          }, s.label);
          keepFocus(b);
          return b;
        }),
    );
  }
  bar.append(tabs, row);
  bar.addEventListener('toggle', () => (barOpen = bar.open));
  drawBar();
  // The build can change while the editor stays (the Robot zone): redraw the bar when it is opened.
  bar.addEventListener('toggle', () => bar.open && drawBar());
  el.append(bar);

  return {
    el,
    area,
    set(text) {
      area.value = text;
      close();
      fit();
      lines();
      drawBar();
    },
  };
}
