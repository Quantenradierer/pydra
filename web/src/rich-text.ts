import { h } from './dom.ts';

/** A run of plain text or inline code within a paragraph. */
export interface Span {
  code: boolean;
  text: string;
}

/**
 * Splits authored text into paragraphs (separated by a blank line) made of
 * spans, where `backticks` mark inline code.
 */
export function parseRichText(text: string): Span[][] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '')
    .map((paragraph) =>
      paragraph
        .split('`')
        .map((part, i) => ({ code: i % 2 === 1, text: part }))
        .filter((span) => span.text !== ''),
    );
}

/** Renders text as `<p>` elements with `<code>` spans, without parsing HTML. */
export function richText(text: string): HTMLParagraphElement[] {
  return parseRichText(text).map((spans) =>
    h('p', {}, ...spans.map((span) => (span.code ? h('code', {}, span.text) : span.text))),
  );
}
