import { h } from '../dom.ts';
import { parseRichText, type Span } from '../rich-text.ts';

export type Block = { kind: 'text'; paragraphs: Span[][] } | { kind: 'code'; code: string };

/** Splits a tutor answer into text and ``` fenced code blocks (an unclosed fence while streaming works too). */
export function parseChat(text: string): Block[] {
  return text.split('```').flatMap((part, i): Block[] => {
    if (i % 2 === 0) return [{ kind: 'text', paragraphs: parseRichText(part) }];
    const code = part.replace(/^[^\n]*\n/, '').replace(/\n$/, '');
    return code === '' ? [] : [{ kind: 'code', code }];
  });
}

/** Renders a tutor answer without ever parsing HTML. */
export function chatText(text: string): HTMLElement[] {
  const blocks: HTMLElement[] = [];
  for (const block of parseChat(text)) {
    if (block.kind === 'code') {
      blocks.push(h('pre', { class: 'chat-code' }, h('code', {}, block.code)));
      continue;
    }
    for (const spans of block.paragraphs) {
      blocks.push(h('p', {}, ...spans.map((span) => (span.code ? h('code', {}, span.text) : span.text))));
    }
  }
  return blocks;
}
