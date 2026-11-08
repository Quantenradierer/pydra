import type { CompareOp, Expr, Loc, Param, Stmt, Target } from './ast.ts';
import { RbError } from './errors.ts';
import { tokenize, type Token } from './lexer.ts';

const KEYWORDS = new Set([
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally',
  'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
]);

/** Keywords outside the teaching subset, with the name shown in the friendly message. */
const UNSUPPORTED: Record<string, string> = {
  import: 'import', from: 'import', try: 'try / except', except: 'try / except', finally: 'try / except', raise: 'raise', lambda: 'lambda', with: 'with',
  async: 'async', await: 'async', yield: 'yield', class: 'class', del: 'del', assert: 'assert', nonlocal: 'nonlocal',
};

const COMPARE_OPS = new Set(['==', '!=', '<', '>', '<=', '>=']);
const AUG_OPS = new Map([['+=', '+'], ['-=', '-'], ['*=', '*'], ['/=', '/'], ['//=', '//'], ['%=', '%'], ['**=', '**']] as const);

export function parse(source: string): Stmt[] {
  return new Parser(tokenize(source)).program();
}

/** Parses a single expression (the `{...}` inside an f-string). */
function parseExpression(src: string, at: Loc): Expr {
  const tokens = tokenize(src.trim()).map((t) => ({ ...t, line: at.line, col: at.col + t.col }));
  const p = new Parser(tokens);
  const e = p.expressionList();
  p.expectEnd();
  return e;
}

class Parser {
  private pos = 0;
  /** Loop depth and function depth of the statement being parsed. */
  private loops = 0;
  private funcs = 0;

  constructor(private tokens: Token[]) {}

  private get tok(): Token {
    return this.tokens[this.pos]!;
  }

  private fail(code: string, detail: string, params: Record<string, string | number> = {}, tok: Token = this.tok): never {
    throw new RbError('SyntaxError', code, params, tok.line, detail, tok.col);
  }

  private unexpected(tok: Token = this.tok): never {
    if (tok.type === 'NEWLINE' || tok.type === 'EOF') this.fail('unexpected-end', 'invalid syntax', {}, tok);
    if (tok.type === 'INDENT') throw new RbError('IndentationError', 'unexpected-indent', {}, tok.line, 'unexpected indent', tok.col);
    this.fail('unexpected-token', 'invalid syntax', { text: tok.type === 'STR' ? `"${tok.text}"` : tok.text }, tok);
  }

  private isOp(text: string): boolean {
    return this.tok.type === 'OP' && this.tok.text === text;
  }

  private isKw(text: string): boolean {
    return this.tok.type === 'NAME' && this.tok.text === text;
  }

  private acceptOp(text: string): boolean {
    if (!this.isOp(text)) return false;
    this.pos++;
    return true;
  }

  private acceptKw(text: string): boolean {
    if (!this.isKw(text)) return false;
    this.pos++;
    return true;
  }

  private expectOp(text: string): Token {
    if (!this.isOp(text)) this.unexpected();
    return this.tokens[this.pos++]!;
  }

  expectEnd() {
    if (this.tok.type !== 'EOF' && this.tok.type !== 'NEWLINE') this.unexpected();
  }

  private loc(t: Token = this.tok): Loc {
    return { line: t.line, col: t.col };
  }

  // ------------------------------------------------------------ statements

  program(): Stmt[] {
    const out: Stmt[] = [];
    while (this.tok.type !== 'EOF') {
      if (this.tok.type === 'INDENT') this.unexpected();
      out.push(this.statement());
    }
    return out;
  }

  private block(header: Token): Stmt[] {
    if (this.tok.type !== 'NEWLINE') {
      // One-liner `if x: y` is valid Python but a bad habit for beginners; parse it as a block of one.
      return [this.simple()];
    }
    this.pos++;
    if ((this.tok.type as string) !== 'INDENT') {
      throw new RbError('IndentationError', 'expected-indent', { kw: header.text, line: header.line }, this.tok.line, `expected an indented block after '${header.text}' statement on line ${header.line}`, this.tok.col);
    }
    this.pos++;
    const body: Stmt[] = [];
    while ((this.tok.type as string) !== 'DEDENT' && (this.tok.type as string) !== 'EOF') body.push(this.statement());
    if ((this.tok.type as string) === 'DEDENT') this.pos++;
    return body;
  }

  private colon(header: Token) {
    if (!this.acceptOp(':')) {
      if (this.isOp('=') ) this.fail('assign-in-condition', "invalid syntax. Maybe you meant '==' or ':=' instead of '='?", {});
      if (this.tok.type === 'NEWLINE' || this.tok.type === 'EOF') this.fail('expected-colon', "expected ':'", { kw: header.text }, this.tok);
      this.unexpected();
    }
  }

  private statement(): Stmt {
    const t = this.tok;
    if (t.type === 'NAME') {
      switch (t.text) {
        case 'if':
          return this.ifStatement();
        case 'while': {
          this.pos++;
          const test = this.condition();
          this.colon(t);
          this.loops++;
          const body = this.block(t);
          this.loops--;
          return { kind: 'while', ...this.loc(t), test, body };
        }
        case 'for': {
          this.pos++;
          const target = this.targetList();
          if (!this.acceptKw('in')) this.unexpected();
          const iter = this.expressionList();
          this.colon(t);
          this.loops++;
          const body = this.block(t);
          this.loops--;
          return { kind: 'for', ...this.loc(t), target, iter, body };
        }
        case 'def':
          return this.funcDef();
        case 'elif':
        case 'else':
          this.fail('else-without-if', `invalid syntax`, { kw: t.text });
      }
      if (t.text in UNSUPPORTED) this.fail('unsupported', 'not available', { what: UNSUPPORTED[t.text]! });
    }
    if (this.isOp('@')) this.fail('unsupported', 'not available', { what: 'decorators' });
    const s = this.simple();
    return s;
  }

  /** A simple statement with its NEWLINE. */
  private simple(): Stmt {
    const t = this.tok;
    const loc = this.loc(t);
    let stmt: Stmt;
    if (t.type === 'NAME' && t.text === 'pass') {
      this.pos++;
      stmt = { kind: 'pass', ...loc };
    } else if (t.type === 'NAME' && t.text === 'break') {
      this.pos++;
      if (this.loops === 0) this.fail('break-outside-loop', "'break' outside loop", { kw: 'break' }, t);
      stmt = { kind: 'break', ...loc };
    } else if (t.type === 'NAME' && t.text === 'continue') {
      this.pos++;
      if (this.loops === 0) this.fail('break-outside-loop', "'continue' not properly in loop", { kw: 'continue' }, t);
      stmt = { kind: 'continue', ...loc };
    } else if (t.type === 'NAME' && t.text === 'return') {
      this.pos++;
      if (this.funcs === 0) this.fail('return-outside-function', "'return' outside function", {}, t);
      const value = this.tok.type === 'NEWLINE' || this.tok.type === 'EOF' ? undefined : this.expressionList();
      stmt = { kind: 'return', ...loc, ...(value ? { value } : {}) };
    } else if (t.type === 'NAME' && t.text === 'global') {
      this.pos++;
      const names = [this.name()];
      while (this.acceptOp(',')) names.push(this.name());
      stmt = { kind: 'global', ...loc, names };
    } else if (t.type === 'NAME' && t.text in UNSUPPORTED) {
      this.fail('unsupported', 'not available', { what: UNSUPPORTED[t.text]! });
    } else {
      stmt = this.expressionStatement();
    }
    if (this.tok.type === 'NEWLINE') this.pos++;
    else if (this.tok.type !== 'EOF' && this.tok.type !== 'DEDENT') this.unexpected();
    return stmt;
  }

  private expressionStatement(): Stmt {
    const first = this.tok;
    const loc = this.loc(first);
    const left = this.expressionList();
    if (this.tok.type === 'OP' && AUG_OPS.has(this.tok.text as '+=')) {
      const op = AUG_OPS.get(this.tok.text as '+=')!;
      const target = this.toTarget(left, first);
      if (target.kind === 'tuple') this.fail('bad-assign-target', 'illegal expression for augmented assignment', {}, first);
      this.pos++;
      const value = this.expressionList();
      return { kind: 'augassign', ...loc, target, op, value };
    }
    if (this.isOp('=')) {
      const targets: Target[] = [];
      let value = left;
      let at = first;
      while (this.acceptOp('=')) {
        targets.push(this.toTarget(value, at));
        at = this.tok;
        value = this.expressionList();
      }
      return { kind: 'assign', ...loc, targets, value };
    }
    return { kind: 'expr', ...loc, expr: left };
  }

  private toTarget(e: Expr, at: Token): Target {
    const loc = { line: e.line, col: e.col };
    if (e.kind === 'name') return { kind: 'name', ...loc, name: e.name };
    if (e.kind === 'index') return { kind: 'index', ...loc, obj: e.obj, index: e.index };
    if (e.kind === 'tuple' || e.kind === 'list') return { kind: 'tuple', ...loc, items: e.items.map((i) => this.toTarget(i, at)) };
    if (e.kind === 'call') this.fail('bad-assign-target', "cannot assign to function call here. Maybe you meant '==' instead of '='?", { what: 'call' }, at);
    this.fail('bad-assign-target', 'cannot assign to expression', { what: e.kind }, at);
  }

  private targetList(): Target {
    const first = this.tok;
    const e = this.postfix();
    if (!this.isOp(',')) return this.toTarget(e, first);
    const items = [e];
    while (this.acceptOp(',')) {
      if (this.isKw('in')) break;
      items.push(this.postfix());
    }
    return { kind: 'tuple', line: e.line, col: e.col, items: items.map((i) => this.toTarget(i, first)) };
  }

  private name(): string {
    const t = this.tok;
    if (t.type !== 'NAME' || KEYWORDS.has(t.text)) this.unexpected();
    this.pos++;
    return t.text;
  }

  private condition(): Expr {
    const e = this.expression();
    return e;
  }

  private ifStatement(): Stmt {
    const t = this.tokens[this.pos++]!;
    const test = this.condition();
    this.colon(t);
    const body = this.block(t);
    let orelse: Stmt[] = [];
    if (this.isKw('elif')) {
      orelse = [this.ifStatementFrom()];
    } else if (this.isKw('else')) {
      const e = this.tokens[this.pos++]!;
      this.colon(e);
      orelse = this.block(e);
    }
    return { kind: 'if', ...this.loc(t), test, body, orelse };
  }

  /** `elif …` is an `if` nested in the else branch. */
  private ifStatementFrom(): Stmt {
    return this.ifStatement();
  }

  private funcDef(): Stmt {
    const t = this.tokens[this.pos++]!;
    const name = this.name();
    this.expectOp('(');
    const params: Param[] = [];
    if (!this.isOp(')')) {
      do {
        if (this.isOp(')')) break;
        if (this.isOp('*') || this.isOp('**')) this.fail('unsupported', 'not available', { what: '*args' });
        const pname = this.name();
        if (this.acceptOp('=')) params.push({ name: pname, default: this.expression() });
        else {
          if (params.some((p) => p.default)) this.fail('param-order', 'parameter without a default follows parameter with a default');
          params.push({ name: pname });
        }
      } while (this.acceptOp(','));
    }
    this.expectOp(')');
    this.colon(t);
    const outerLoops = this.loops;
    this.loops = 0;
    this.funcs++;
    const body = this.block(t);
    this.funcs--;
    this.loops = outerLoops;
    return { kind: 'def', ...this.loc(t), name, params, body };
  }

  // ------------------------------------------------------------ expressions

  /** `a, b` without parentheses makes a tuple. */
  expressionList(): Expr {
    const first = this.expression();
    if (!this.isOp(',')) return first;
    const items = [first];
    while (this.acceptOp(',')) {
      if (this.tok.type === 'NEWLINE' || this.isOp('=') || this.isOp(')') || this.tok.type === 'EOF') break;
      items.push(this.expression());
    }
    return { kind: 'tuple', line: first.line, col: first.col, items };
  }

  expression(): Expr {
    if (this.isKw('lambda')) this.fail('unsupported', 'not available', { what: 'lambda' });
    const body = this.orExpr();
    if (this.isKw('if')) {
      this.pos++;
      const test = this.orExpr();
      if (!this.acceptKw('else')) this.unexpected();
      const orelse = this.expression();
      return { kind: 'ifexp', line: body.line, col: body.col, test, body, orelse };
    }
    return body;
  }

  private orExpr(): Expr {
    let left = this.andExpr();
    while (this.isKw('or')) {
      this.pos++;
      left = { kind: 'bool', op: 'or', line: left.line, col: left.col, left, right: this.andExpr() };
    }
    return left;
  }

  private andExpr(): Expr {
    let left = this.notExpr();
    while (this.isKw('and')) {
      this.pos++;
      left = { kind: 'bool', op: 'and', line: left.line, col: left.col, left, right: this.notExpr() };
    }
    return left;
  }

  private notExpr(): Expr {
    const t = this.tok;
    if (this.acceptKw('not')) return { kind: 'unary', op: 'not', ...this.loc(t), operand: this.notExpr() };
    return this.comparison();
  }

  private compareOp(): CompareOp | undefined {
    const t = this.tok;
    if (t.type === 'OP' && COMPARE_OPS.has(t.text)) {
      this.pos++;
      return t.text as CompareOp;
    }
    if (t.type !== 'NAME') return undefined;
    if (t.text === 'in') {
      this.pos++;
      return 'in';
    }
    if (t.text === 'not' && this.tokens[this.pos + 1]?.text === 'in') {
      this.pos += 2;
      return 'not in';
    }
    if (t.text === 'is') {
      this.pos++;
      if (this.acceptKw('not')) return 'is not';
      return 'is';
    }
    return undefined;
  }

  private comparison(): Expr {
    const first = this.sum();
    const rest: { op: CompareOp; right: Expr }[] = [];
    for (let op = this.compareOp(); op; op = this.compareOp()) rest.push({ op, right: this.sum() });
    return rest.length === 0 ? first : { kind: 'compare', line: first.line, col: first.col, first, rest };
  }

  private sum(): Expr {
    let left = this.term();
    while (this.isOp('+') || this.isOp('-')) {
      const op = this.tokens[this.pos++]!.text as '+' | '-';
      left = { kind: 'binary', op, line: left.line, col: left.col, left, right: this.term() };
    }
    return left;
  }

  private term(): Expr {
    let left = this.factor();
    while (this.isOp('*') || this.isOp('/') || this.isOp('//') || this.isOp('%')) {
      const op = this.tokens[this.pos++]!.text as '*' | '/' | '//' | '%';
      left = { kind: 'binary', op, line: left.line, col: left.col, left, right: this.factor() };
    }
    return left;
  }

  private factor(): Expr {
    const t = this.tok;
    if (this.isOp('-') || this.isOp('+')) {
      this.pos++;
      return { kind: 'unary', op: t.text as '-' | '+', ...this.loc(t), operand: this.factor() };
    }
    return this.power();
  }

  private power(): Expr {
    const base = this.postfix();
    if (this.acceptOp('**')) return { kind: 'binary', op: '**', line: base.line, col: base.col, left: base, right: this.factor() };
    return base;
  }

  private postfix(): Expr {
    let e = this.atom();
    for (;;) {
      if (this.isOp('(')) {
        this.pos++;
        const args: Expr[] = [];
        const kwargs: { name: string; value: Expr }[] = [];
        while (!this.isOp(')')) {
          if (this.isOp('*') || this.isOp('**')) this.fail('unsupported', 'not available', { what: '*args' });
          if (this.tok.type === 'NAME' && this.tokens[this.pos + 1]?.text === '=' && this.tokens[this.pos + 1]?.type === 'OP') {
            const name = this.name();
            this.pos++;
            kwargs.push({ name, value: this.expression() });
          } else {
            if (kwargs.length > 0) this.fail('positional-after-keyword', 'positional argument follows keyword argument');
            const arg = this.expression();
            if (this.isKw('for')) this.fail('unsupported', 'not available', { what: 'comprehensions' });
            args.push(arg);
          }
          if (!this.acceptOp(',')) break;
        }
        this.expectOp(')');
        e = { kind: 'call', line: e.line, col: e.col, func: e, args, kwargs };
      } else if (this.isOp('.')) {
        this.pos++;
        const t = this.tok;
        if (t.type !== 'NAME') this.unexpected();
        this.pos++;
        e = { kind: 'attr', line: e.line, col: e.col, obj: e, name: t.text };
      } else if (this.isOp('[')) {
        this.pos++;
        e = this.subscript(e);
      } else return e;
    }
  }

  private subscript(obj: Expr): Expr {
    const loc = { line: obj.line, col: obj.col };
    let lower: Expr | undefined;
    if (!this.isOp(':')) lower = this.expression();
    if (!this.isOp(':')) {
      this.expectOp(']');
      return { kind: 'index', ...loc, obj, index: lower! };
    }
    this.pos++;
    let upper: Expr | undefined;
    let step: Expr | undefined;
    if (!this.isOp(':') && !this.isOp(']')) upper = this.expression();
    if (this.acceptOp(':') && !this.isOp(']')) step = this.expression();
    this.expectOp(']');
    return { kind: 'slice', ...loc, obj, ...(lower ? { lower } : {}), ...(upper ? { upper } : {}), ...(step ? { step } : {}) };
  }

  private atom(): Expr {
    const t = this.tok;
    const loc = this.loc(t);
    switch (t.type) {
      case 'INT':
        this.pos++;
        return { kind: 'int', ...loc, value: Number(t.text) };
      case 'FLOAT':
        this.pos++;
        return { kind: 'float', ...loc, value: Number(t.text) };
      case 'STR': {
        this.pos++;
        let value = t.text;
        while (this.tok.type === 'STR') value += this.tokens[this.pos++]!.text;
        return { kind: 'str', ...loc, value };
      }
      case 'FSTR':
        this.pos++;
        return { kind: 'fstr', ...loc, parts: this.fstringParts(t) };
      case 'NAME':
        if (t.text === 'True' || t.text === 'False' || t.text === 'None') {
          this.pos++;
          return { kind: 'const', ...loc, value: t.text === 'None' ? null : t.text === 'True' };
        }
        if (t.text in UNSUPPORTED) this.fail('unsupported', 'not available', { what: UNSUPPORTED[t.text]! });
        if (KEYWORDS.has(t.text)) this.unexpected();
        this.pos++;
        return { kind: 'name', ...loc, name: t.text };
      case 'OP':
        if (t.text === '(') {
          this.pos++;
          if (this.acceptOp(')')) return { kind: 'tuple', ...loc, items: [] };
          const first = this.expression();
          if (this.isKw('for')) this.fail('unsupported', 'not available', { what: 'generators' });
          if (this.acceptOp(')')) return first;
          const items = [first];
          while (this.acceptOp(',')) {
            if (this.isOp(')')) break;
            items.push(this.expression());
          }
          this.expectOp(')');
          return { kind: 'tuple', ...loc, items };
        }
        if (t.text === '[') {
          this.pos++;
          const items: Expr[] = [];
          while (!this.isOp(']')) {
            items.push(this.expression());
            if (this.isKw('for')) this.fail('unsupported', 'not available', { what: 'comprehensions' });
            if (!this.acceptOp(',')) break;
          }
          this.expectOp(']');
          return { kind: 'list', ...loc, items };
        }
        if (t.text === '{') {
          this.pos++;
          const entries: [Expr, Expr][] = [];
          while (!this.isOp('}')) {
            const key = this.expression();
            if (!this.acceptOp(':')) this.fail('unsupported', 'not available', { what: 'sets' });
            entries.push([key, this.expression()]);
            if (this.isKw('for')) this.fail('unsupported', 'not available', { what: 'comprehensions' });
            if (!this.acceptOp(',')) break;
          }
          this.expectOp('}');
          return { kind: 'dict', ...loc, entries };
        }
        return this.unexpected();
      default:
        return this.unexpected();
    }
  }

  /** Splits an f-string into literal text and `{expr!r:spec}` parts. */
  private fstringParts(t: Token): (string | { expr: Expr; conv?: 'r' | 's'; spec: string })[] {
    const s = t.text;
    const parts: (string | { expr: Expr; conv?: 'r' | 's'; spec: string })[] = [];
    let text = '';
    let i = 0;
    while (i < s.length) {
      const c = s[i]!;
      if (c === '{' && s[i + 1] === '{') {
        text += '{';
        i += 2;
      } else if (c === '}' && s[i + 1] === '}') {
        text += '}';
        i += 2;
      } else if (c === '}') {
        this.fail('fstring', "f-string: single '}' is not allowed", {}, t);
      } else if (c === '{') {
        let depth = 0;
        let j = i + 1;
        let quote = '';
        for (; j < s.length; j++) {
          const d = s[j]!;
          if (quote) {
            if (d === quote) quote = '';
          } else if (d === '"' || d === "'") quote = d;
          else if (d === '(' || d === '[' || d === '{') depth++;
          else if (d === ')' || d === ']') depth--;
          else if (d === '}') {
            if (depth === 0) break;
            depth--;
          }
        }
        if (j >= s.length) this.fail('fstring', "f-string: expecting '}'", {}, t);
        let inner = s.slice(i + 1, j);
        let spec = '';
        let conv: 'r' | 's' | undefined;
        // Split off `:spec` and `!r` at the top level of the expression.
        let d2 = 0;
        let q2 = '';
        for (let k = 0; k < inner.length; k++) {
          const d = inner[k]!;
          if (q2) {
            if (d === q2) q2 = '';
          } else if (d === '"' || d === "'") q2 = d;
          else if ('([{'.includes(d)) d2++;
          else if (')]}'.includes(d)) d2--;
          else if (d === ':' && d2 === 0) {
            spec = inner.slice(k + 1);
            inner = inner.slice(0, k);
            break;
          }
        }
        const bang = /!([rs])$/.exec(inner);
        if (bang) {
          conv = bang[1] as 'r' | 's';
          inner = inner.slice(0, -2);
        }
        if (inner.trim() === '') this.fail('fstring', 'f-string: empty expression not allowed', {}, t);
        if (text) parts.push(text);
        text = '';
        parts.push({ expr: parseExpression(inner, { line: t.line, col: t.col }), ...(conv ? { conv } : {}), spec });
        i = j + 1;
      } else {
        text += c;
        i++;
      }
    }
    if (text) parts.push(text);
    return parts;
  }
}
