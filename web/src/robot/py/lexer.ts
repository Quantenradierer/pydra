import { RbError } from './errors.ts';

export type TokType = 'NAME' | 'INT' | 'FLOAT' | 'STR' | 'FSTR' | 'OP' | 'NEWLINE' | 'INDENT' | 'DEDENT' | 'EOF';

export interface Token {
  type: TokType;
  /** Source text for names and operators; the decoded value for strings. */
  text: string;
  line: number;
  col: number;
}

const OPS3 = ['//=', '**='];
const OPS2 = ['==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%=', '//', '**', '->', ':='];
const OPS1 = '+-*/%<>=()[]{},:.;@~&|^';
const ESCAPES: Record<string, string> = { n: '\n', t: '\t', '\\': '\\', "'": "'", '"': '"', '0': '\0' };

/** Splits source text into tokens with INDENT / DEDENT / NEWLINE, like CPython's tokenizer. */
export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const indents = [0];
  const brackets: { ch: string; line: number; col: number }[] = [];
  const lines = source.replace(/\r\n?/g, '\n').split('\n');

  for (const [n, text] of lines.entries()) {
    const line = n + 1;
    let i = 0;
    if (brackets.length === 0) {
      let width = 0;
      while (i < text.length && (text[i] === ' ' || text[i] === '\t')) {
        if (text[i] === '\t') throw new RbError('SyntaxError', 'tabs', {}, line, 'tabs are not allowed here, use spaces', i);
        width++;
        i++;
      }
      if (i >= text.length || text[i] === '#') continue;
      const top = indents.at(-1)!;
      if (width > top) {
        indents.push(width);
        tokens.push({ type: 'INDENT', text: '', line, col: 0 });
      } else if (width < top) {
        while (indents.at(-1)! > width) {
          indents.pop();
          tokens.push({ type: 'DEDENT', text: '', line, col: 0 });
        }
        if (indents.at(-1)! !== width) {
          throw new RbError('IndentationError', 'unindent-mismatch', {}, line, 'unindent does not match any outer indentation level', 0);
        }
      }
    }
    while (i < text.length) {
      const ch = text[i]!;
      if (ch === ' ' || ch === '\t') {
        i++;
        continue;
      }
      if (ch === '#') break;
      const col = i;
      const rest = text.slice(i);

      // Strings (with an optional f prefix).
      const str = /^([fF]?)(["'])/.exec(rest);
      if (str) {
        const quote = str[2]!;
        if (rest.startsWith(quote.repeat(3))) {
          throw new RbError('SyntaxError', 'unsupported', { what: 'triple-quoted strings' }, line, 'triple-quoted strings are not available', col);
        }
        let j = i + str[0].length;
        let value = '';
        let closed = false;
        const fstring = str[1] !== '';
        while (j < text.length) {
          const c = text[j]!;
          if (c === quote) {
            closed = true;
            j++;
            break;
          }
          if (c === '\\') {
            const next = text[j + 1];
            if (next === undefined) break;
            value += ESCAPES[next] ?? `\\${next}`;
            j += 2;
            continue;
          }
          value += c;
          j++;
        }
        if (!closed) throw new RbError('SyntaxError', 'unterminated-string', {}, line, 'unterminated string literal', col);
        tokens.push({ type: fstring ? 'FSTR' : 'STR', text: value, line, col });
        i = j;
        continue;
      }

      const num = /^(?:\d[\d_]*\.?[\d_]*(?:[eE][+-]?\d+)?|\.\d[\d_]*(?:[eE][+-]?\d+)?)/.exec(rest);
      if (num) {
        const after = rest[num[0].length];
        if (after !== undefined && /[A-Za-z_]/.test(after)) {
          throw new RbError('SyntaxError', 'invalid-number', { text: rest.slice(0, num[0].length + 1) }, line, 'invalid decimal literal', col);
        }
        const raw = num[0].replace(/_/g, '');
        tokens.push({ type: /[.eE]/.test(raw) ? 'FLOAT' : 'INT', text: raw, line, col });
        i += num[0].length;
        continue;
      }

      const word = /^[A-Za-z_]\w*/.exec(rest);
      if (word) {
        tokens.push({ type: 'NAME', text: word[0], line, col });
        i += word[0].length;
        continue;
      }

      const op = OPS3.find((o) => rest.startsWith(o)) ?? OPS2.find((o) => rest.startsWith(o)) ?? (OPS1.includes(ch) ? ch : undefined);
      if (!op) throw new RbError('SyntaxError', 'bad-char', { ch }, line, `invalid character '${ch}'`, col);
      if ('([{'.includes(op)) brackets.push({ ch: op, line, col });
      else if (')]}'.includes(op)) {
        const open = brackets.pop();
        if (!open || '([{'.indexOf(open.ch) !== ')]}'.indexOf(op)) {
          throw new RbError('SyntaxError', 'unmatched-bracket', { bracket: op }, line, `unmatched '${op}'`, col);
        }
      }
      tokens.push({ type: 'OP', text: op, line, col });
      i += op.length;
    }
    if (brackets.length === 0 && tokens.length > 0 && tokens.at(-1)!.type !== 'NEWLINE' && tokens.at(-1)!.line === line) {
      tokens.push({ type: 'NEWLINE', text: '', line, col: text.length });
    }
  }
  if (brackets.length > 0) {
    const open = brackets.at(-1)!;
    throw new RbError('SyntaxError', 'unclosed-bracket', { bracket: open.ch }, open.line, `'${open.ch}' was never closed`, open.col);
  }
  const last = lines.length;
  while (indents.length > 1) {
    indents.pop();
    tokens.push({ type: 'DEDENT', text: '', line: last, col: 0 });
  }
  tokens.push({ type: 'EOF', text: '', line: last, col: 0 });
  return tokens;
}
