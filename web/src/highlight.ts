import hljs from 'highlight.js/lib/core';
import python from 'highlight.js/lib/languages/python';
import { h } from './dom.ts';

hljs.registerLanguage('python', python);

/** Python source as highlighted HTML (escaped, safe to insert). */
export const highlight = (code: string) => hljs.highlight(code, { language: 'python' }).value;

export interface CodeBlockOptions {
  /** Show line numbers; each line is highlighted on its own, fine for the short walkthrough functions. */
  numbered?: boolean;
  /** 1-based line to mark (implies numbered). */
  focusLine?: number;
  /** 1-based lines to tint as "changed" (spot the difference); no line numbers. */
  changedLines?: readonly number[];
  /** 1-based lines to tint as "added" (daily challenge); can be combined with changedLines. */
  addedLines?: readonly number[];
}

/** A highlighted Python snippet. Colours come from CSS variables in style.css. */
export function codeBlock(code: string, { numbered = false, focusLine, changedLines, addedLines }: CodeBlockOptions = {}): HTMLPreElement {
  const el = h('code', { class: 'hljs language-python' });
  // highlight.js escapes the source, so its HTML output is safe to insert.
  if (numbered || focusLine !== undefined) {
    el.innerHTML = code
      .split('\n')
      .map((line, i) => `<span class="line${i + 1 === focusLine ? ' focus' : ''}">${highlight(line)}</span>`)
      .join('\n');
    return h('pre', { class: 'code numbered' }, el);
  }
  if (changedLines !== undefined || addedLines !== undefined) {
    el.innerHTML = code
      .split('\n')
      .map((line, i) => `<span class="line${changedLines?.includes(i + 1) ? ' changed' : ''}${addedLines?.includes(i + 1) ? ' added' : ''}">${highlight(line)}</span>`)
      .join('\n');
    return h('pre', { class: 'code marked' }, el);
  }
  el.innerHTML = highlight(code);
  return h('pre', { class: 'code' }, el);
}
