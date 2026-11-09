import { h } from '../dom.ts';
import type { MessageKey } from '../i18n.ts';
import type { Build } from '../robot/build.ts';
import { applySuggestion, completionAt, insertSnippet, nextSnippets, snippetGroups, type Completion, type Snippet } from '../robot/suggest.ts';

export interface Editor {
  /** The whole editor (line numbers, text, suggestion strip, help sheet): put this on the page. */
  el: HTMLElement;
  area: HTMLTextAreaElement;
  /** Replaces the text from outside (restoring a version) and redraws the line numbers. */
  set(text: string): void;
  /** Redraws the strip and the help sheet after the build changed. */
  refresh(): void;
}

/** One line of the command help (in the sheet). */
export interface HelpEntry {
  sig: string;
  desc: string;
}

/** How many completions the strip shows. */
const STRIP_MAX = 14;

let sheetGroup = 'flow';

/**
 * The script editor: a text area of fixed height with line numbers, and under it ONE single-row suggestion strip (like the
 * suggestion bar of a phone keyboard): completions while a word is typed, otherwise the most useful next templates for the gear.
 * Nothing floats over the text and focusing opens nothing but the strip. The command list and the full template palette live
 * in a bottom sheet behind the "Befehle" button. The suggestions come from robot/suggest.ts; this file is only the DOM around them.
 */
export function createEditor(t: (key: MessageKey) => string, initial: string, build: () => Build, onInput: (text: string) => void, testId = 'robot-code', help: () => HelpEntry[] = () => []): Editor {
  const area = h('textarea', {
    class: 'robot-code',
    rows: 4,
    wrap: 'off',
    spellcheck: false,
    autocapitalize: 'off',
    autocomplete: 'off',
    'aria-label': t('robot.code'),
    'data-testid': testId,
  }) as HTMLTextAreaElement;
  const gutter = h('div', { class: 'robot-gutter', 'aria-hidden': 'true', 'data-testid': `${testId}-lines` });
  const box = h('div', { class: 'robot-editor-box' }, gutter, area);
  const strip = h('div', { class: 'robot-strip-chips', role: 'listbox', 'aria-label': t('robot.sug.list'), 'data-testid': `${testId}-strip` });
  strip.id = `${testId}-strip`;
  area.setAttribute('aria-controls', strip.id);
  const more = h('button', { type: 'button', class: 'robot-strip-more', 'aria-haspopup': 'dialog', 'data-testid': `${testId}-more` }, t('robot.sug.more'));
  const stripRow = h('div', { class: 'robot-strip' }, strip, more);
  const sheet = h('dialog', { class: 'robot-sheet', 'aria-label': t('robot.sug.help'), 'data-testid': `${testId}-sheet` }) as HTMLDialogElement;
  const el = h('div', { class: 'robot-editor' }, box, stripRow, sheet);

  let current: Completion | null = null;
  let active = 0;
  /** The caret as it was when the help sheet opened (closing the sheet gives the focus back, and some browsers reset the caret). */
  let sheetSel: [number, number] = [0, 0];

  const lines = () => {
    const n = area.value.split('\n').length;
    gutter.textContent = Array.from({ length: n + 1 }, (_, i) => (i < n ? String(i + 1) : '')).join('\n');
    gutter.scrollTop = area.scrollTop;
  };
  const changed = () => (lines(), onInput(area.value));
  /** Keeps the text field and its strip together in view (phone keyboards cover the lower part of the page). */
  const reveal = () => requestAnimationFrame(() => el.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
  const keepFocus = (b: HTMLElement) => b.addEventListener('pointerdown', (e) => e.preventDefault());
  const chip = (cls: string, label: string, on: () => void, extra: Record<string, string> = {}) => {
    const b = h('button', { type: 'button', class: cls, tabindex: -1, ...extra }, label);
    // pointerdown, not click: the text area must keep the focus (and the phone keyboard its place).
    keepFocus(b);
    b.addEventListener('click', on);
    return b;
  };

  // ---- the strip
  function put(s: Snippet) {
    const r = insertSnippet(area.value, area.selectionStart, area.selectionEnd, s);
    area.value = r.text;
    area.setSelectionRange(r.caret, r.caret);
    changed();
    refresh();
    area.focus({ preventScroll: true });
  }
  function drawStrip() {
    strip.replaceChildren();
    if (current) {
      const c = current;
      c.items.slice(0, STRIP_MAX).forEach((s, i) => {
        strip.append(
          chip(`robot-chip${i === active ? ' active' : ''}${s.equipped ? '' : ' off'}`, s.label, () => accept(i), { role: 'option', 'aria-selected': String(i === active), 'data-testid': 'strip-chip', 'data-kind': s.kind, ...(s.equipped ? {} : { title: t('robot.sug.off') }) }),
        );
      });
      strip.querySelector('.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      strip.dataset.mode = 'complete';
    } else {
      for (const s of nextSnippets(build())) strip.append(chip('robot-chip', s.label, () => put(s), { 'data-testid': 'strip-chip' }));
      strip.dataset.mode = 'next';
      strip.scrollLeft = 0;
    }
  }
  function refresh(manual = false) {
    const c = area.selectionStart === area.selectionEnd ? completionAt(area.value, area.selectionStart, build(), { manual }) : null;
    // A blank line is not "typing a word": the strip then shows the next templates.
    current = c && !c.fresh ? c : null;
    active = 0;
    drawStrip();
  }
  function accept(i: number) {
    if (!current) return;
    const r = applySuggestion(area.value, current, current.items[i]!);
    area.value = r.text;
    area.setSelectionRange(r.caret, r.caret);
    changed();
    refresh();
    area.focus({ preventScroll: true });
  }

  area.value = initial;
  lines();
  area.addEventListener('input', () => (changed(), refresh()));
  area.addEventListener('scroll', () => (gutter.scrollTop = area.scrollTop));
  area.addEventListener('click', () => refresh());
  area.addEventListener('focus', () => (refresh(), reveal()));
  window.visualViewport?.addEventListener('resize', () => document.activeElement === area && reveal());
  area.addEventListener('keydown', (e) => {
    if (current && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const n = Math.min(current.items.length, STRIP_MAX);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        active = (active + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
        return drawStrip();
      }
      if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        return accept(active);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        current = null;
        return drawStrip();
      }
    }
    if (e.key === ' ' && e.ctrlKey) {
      e.preventDefault();
      return refresh(true);
    }
    if (e.key !== 'Tab' || e.shiftKey) return;
    e.preventDefault();
    area.setRangeText('    ', area.selectionStart, area.selectionEnd, 'end');
    changed();
    refresh();
  });

  // ---- the sheet: all templates by group, and the command list; a tap inserts and closes
  const tabs = h('div', { class: 'robot-snippet-tabs', role: 'group', 'aria-label': t('robot.sug.bar') });
  const row = h('div', { class: 'robot-snippet-row' });
  const cmds = h('dl', { class: 'robot-sheet-cmds', 'data-testid': `${testId}-help` });
  const body = h('div', { class: 'robot-sheet-body' }, tabs, row, h('h3', {}, t('robot.sug.help')), cmds);
  const closeBtn = h('button', { type: 'button', class: 'robot-sheet-close', 'aria-label': t('robot.sug.close'), 'data-testid': `${testId}-sheet-close`, onclick: () => sheet.close() }, '×');
  sheet.append(h('header', {}, h('h2', {}, t('robot.sug.help')), closeBtn), h('p', { class: 'robot-sheet-hint' }, t('robot.sug.hint')), body);
  const insertFromSheet = (s: Snippet) => {
    sheet.close();
    area.setSelectionRange(...sheetSel);
    put(s);
  };
  function drawSheet() {
    const gs = snippetGroups(build());
    if (!gs.some((g) => g.id === sheetGroup)) sheetGroup = gs[0]!.id;
    tabs.replaceChildren(
      ...gs.map((g) => h('button', { type: 'button', class: 'robot-snippet-tab', 'aria-pressed': String(g.id === sheetGroup), 'data-testid': `snippet-group-${g.id}`, onclick: () => ((sheetGroup = g.id), drawSheet()) }, t(`robot.sug.group.${g.id}` as MessageKey))),
    );
    row.replaceChildren(...gs.find((g) => g.id === sheetGroup)!.snippets.map((s) => h('button', { type: 'button', class: 'robot-snippet', 'data-testid': 'snippet', onclick: () => insertFromSheet(s) }, s.label)));
    cmds.replaceChildren(
      ...help().map((e) => {
        const call = /^([\w.]+)\((.*)\)$/.exec(e.sig);
        const text = call ? `${call[1]}(${call[2] ? '$0' : ''})${call[2] ? '' : '$0'}` : `${e.sig}$0`;
        return h('button', { type: 'button', class: 'robot-cmd', 'data-testid': 'cmd', onclick: () => insertFromSheet({ label: e.sig, text }) }, h('code', {}, e.sig), h('span', {}, e.desc));
      }),
    );
  }
  more.addEventListener('pointerdown', (e) => e.preventDefault());
  more.addEventListener('click', () => {
    sheetSel = [area.selectionStart, area.selectionEnd];
    drawSheet();
    sheet.showModal();
  });
  // A tap on the dimmed area closes the sheet.
  sheet.addEventListener('click', (e) => e.target === sheet && sheet.close());

  drawStrip();

  return {
    el,
    area,
    set(text) {
      area.value = text;
      lines();
      refresh();
    },
    refresh() {
      drawStrip();
      if (sheet.open) drawSheet();
    },
  };
}
