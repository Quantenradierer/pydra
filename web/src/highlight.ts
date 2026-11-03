import hljs from 'highlight.js/lib/core';
import python from 'highlight.js/lib/languages/python';
import { h } from './dom.ts';

hljs.registerLanguage('python', python);

/** A highlighted Python snippet. Colours come from CSS variables in style.css. */
export function codeBlock(code: string): HTMLPreElement {
  const el = h('code', { class: 'hljs language-python' });
  // highlight.js escapes the source, so its HTML output is safe to insert.
  el.innerHTML = hljs.highlight(code, { language: 'python' }).value;
  return h('pre', { class: 'code' }, el);
}
