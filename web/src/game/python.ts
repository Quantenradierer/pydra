/**
 * A tiny interpreter for the Python subset the game's programs use. It runs
 * a program step by step like a debugger: execution pauses before every
 * statement (and at every loop or branch check), so the view can highlight
 * the line and show the variables.
 *
 * Supported: int, bool and string literals (no escapes), list literals,
 * names, calls, indexing `x[i]` (also negative), `+ - * // %`, unary `-`,
 * comparisons, `not`/`and`/`or`, parentheses; `x = …`, `x += …`, `x -= …`,
 * `if`/`elif`/`else`, `while`, `for name in …` over `range(…)` (1 to 3
 * arguments), a list or a string, `break`, `continue`, `def` with
 * parameters and default values, `return`, `pass`, the builtin `len`,
 * comments and blank lines. Indentation is spaces only. Everything else is a syntax error, so a level can only use
 * what this file implements and real Python would run the same way.
 */

export type Value = number | boolean | null | string | PyFunction | Builtin | Value[];

export interface PyFunction {
  kind: 'function';
  name: string;
  params: string[];
  /** Values of the last parameters' defaults, evaluated once when `def` runs (like Python). */
  defaults: Value[];
  body: Stmt[];
}

export interface Builtin {
  kind: 'builtin';
  name: string;
  arity: number;
  call: (args: Value[]) => Value;
}

export type Expr =
  | { kind: 'num'; value: number }
  | { kind: 'bool'; value: boolean }
  | { kind: 'str'; value: string }
  | { kind: 'list'; items: Expr[] }
  | { kind: 'index'; target: Expr; index: Expr }
  | { kind: 'name'; name: string }
  | { kind: 'call'; name: string; args: Expr[] }
  | { kind: 'unary'; op: '-' | 'not'; operand: Expr }
  | { kind: 'binary'; op: BinaryOp; left: Expr; right: Expr };

type BinaryOp = '+' | '-' | '*' | '//' | '%' | '==' | '!=' | '<' | '>' | '<=' | '>=' | 'and' | 'or';

export type Stmt =
  | { kind: 'expr'; line: number; expr: Expr }
  | { kind: 'assign'; line: number; name: string; op: '=' | '+=' | '-='; expr: Expr }
  | { kind: 'if'; branches: { line: number; cond: Expr; body: Stmt[] }[]; orelse: Stmt[] }
  | { kind: 'while'; line: number; cond: Expr; body: Stmt[] }
  | { kind: 'for'; line: number; name: string; iter: Expr; body: Stmt[] }
  | { kind: 'def'; line: number; name: string; params: string[]; defaults: Expr[]; body: Stmt[] }
  | { kind: 'break'; line: number }
  | { kind: 'continue'; line: number }
  | { kind: 'return'; line: number; expr?: Expr }
  | { kind: 'pass'; line: number };

type PyErrorType =
  | 'SyntaxError'
  | 'IndentationError'
  | 'NameError'
  | 'UnboundLocalError'
  | 'TypeError'
  | 'ValueError'
  | 'IndexError'
  | 'ZeroDivisionError'
  | 'RecursionError';

/** A syntax or runtime error, with the 1-based line it happened in. */
export class PyError extends Error {
  readonly type: PyErrorType;
  readonly line: number;

  constructor(type: PyErrorType, message: string, line: number) {
    super(`${type}: ${message}`);
    this.type = type;
    this.line = line;
  }
}

// ---------------------------------------------------------------- tokens

type Token = { type: 'name' | 'num' | 'str' | 'op'; text: string };

const KEYWORDS = new Set([
  'def',
  'if',
  'elif',
  'else',
  'while',
  'for',
  'in',
  'break',
  'continue',
  'return',
  'pass',
  'and',
  'or',
  'not',
  'True',
  'False',
]);
const OPERATORS = ['//', '==', '!=', '<=', '>=', '+=', '-=', '+', '-', '*', '%', '<', '>', '=', '(', ')', '[', ']', ',', ':'];

function tokenize(text: string, line: number): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    const space = /^\s+/.exec(rest);
    if (space) {
      i += space[0].length;
      continue;
    }
    if (rest.startsWith('#')) break;
    // A string in double or single quotes, on one line, without backslash escapes.
    const quoted = /^"([^"\\]*)"|^'([^'\\]*)'/.exec(rest);
    if (quoted) {
      tokens.push({ type: 'str', text: quoted[1] ?? quoted[2]! });
      i += quoted[0].length;
      continue;
    }
    if (rest[0] === '"' || rest[0] === "'") throw new PyError('SyntaxError', 'unterminated string', line);
    const word = /^[A-Za-z_]\w*/.exec(rest);
    const num = /^\d+/.exec(rest);
    const op = OPERATORS.find((o) => rest.startsWith(o));
    if (word) tokens.push({ type: 'name', text: word[0] });
    else if (num) tokens.push({ type: 'num', text: num[0] });
    else if (op) tokens.push({ type: 'op', text: op });
    else throw new PyError('SyntaxError', `unexpected character ${JSON.stringify(rest[0])}`, line);
    i += (word ?? num)?.[0].length ?? op!.length;
  }
  return tokens;
}

// ---------------------------------------------------------------- parser

interface Line {
  number: number;
  indent: number;
  tokens: Token[];
}

class ExprParser {
  private pos = 0;
  private tokens: Token[];
  private line: number;

  constructor(tokens: Token[], line: number) {
    this.tokens = tokens;
    this.line = line;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  fail(message: string): never {
    throw new PyError('SyntaxError', message, this.line);
  }

  accept(text: string): boolean {
    if (this.peek()?.text !== text) return false;
    this.pos++;
    return true;
  }

  expect(text: string) {
    if (!this.accept(text)) this.fail(`expected '${text}'`);
  }

  atEnd(): boolean {
    return this.pos === this.tokens.length;
  }

  end() {
    if (!this.atEnd()) this.fail(`unexpected '${this.peek()!.text}'`);
  }

  identifier(): string {
    const token = this.peek();
    if (token?.type !== 'name' || KEYWORDS.has(token.text)) this.fail('expected a name');
    this.pos++;
    return token.text;
  }

  expression(): Expr {
    return this.or();
  }

  private or(): Expr {
    let left = this.and();
    while (this.accept('or')) left = { kind: 'binary', op: 'or', left, right: this.and() };
    return left;
  }

  private and(): Expr {
    let left = this.not();
    while (this.accept('and')) left = { kind: 'binary', op: 'and', left, right: this.not() };
    return left;
  }

  private not(): Expr {
    if (this.accept('not')) return { kind: 'unary', op: 'not', operand: this.not() };
    return this.comparison();
  }

  private comparison(): Expr {
    const left = this.sum();
    const op = this.peek()?.text;
    if (op === '==' || op === '!=' || op === '<' || op === '>' || op === '<=' || op === '>=') {
      this.pos++;
      const right = this.sum();
      if (['==', '!=', '<', '>', '<=', '>='].includes(this.peek()?.text ?? '')) this.fail('chained comparisons are not supported');
      return { kind: 'binary', op, left, right };
    }
    return left;
  }

  private sum(): Expr {
    let left = this.product();
    for (let op = this.peek()?.text; op === '+' || op === '-'; op = this.peek()?.text) {
      this.pos++;
      left = { kind: 'binary', op, left, right: this.product() };
    }
    return left;
  }

  private product(): Expr {
    let left = this.unary();
    for (let op = this.peek()?.text; op === '*' || op === '//' || op === '%'; op = this.peek()?.text) {
      this.pos++;
      left = { kind: 'binary', op, left, right: this.unary() };
    }
    return left;
  }

  private unary(): Expr {
    if (this.accept('-')) return { kind: 'unary', op: '-', operand: this.unary() };
    let expr = this.atom();
    while (this.accept('[')) {
      const index = this.expression();
      this.expect(']');
      expr = { kind: 'index', target: expr, index };
    }
    return expr;
  }

  /** Comma-separated expressions up to the closing bracket. */
  private items(close: string): Expr[] {
    const items: Expr[] = [];
    if (!this.accept(close)) {
      do items.push(this.expression());
      while (this.accept(','));
      this.expect(close);
    }
    return items;
  }

  private atom(): Expr {
    const token = this.peek();
    if (!token) this.fail('unexpected end of line');
    if (token.type === 'num') {
      this.pos++;
      return { kind: 'num', value: Number(token.text) };
    }
    if (token.type === 'str') {
      this.pos++;
      return { kind: 'str', value: token.text };
    }
    if (this.accept('[')) return { kind: 'list', items: this.items(']') };
    if (this.accept('True')) return { kind: 'bool', value: true };
    if (this.accept('False')) return { kind: 'bool', value: false };
    if (this.accept('(')) {
      const inner = this.expression();
      this.expect(')');
      return inner;
    }
    const name = this.identifier();
    if (!this.accept('(')) return { kind: 'name', name };
    return { kind: 'call', name, args: this.items(')') };
  }
}

/** Parses a program into statements; throws PyError('SyntaxError') on anything outside the subset. */
export function parse(source: string): Stmt[] {
  const lines: Line[] = [];
  for (const [i, text] of source.split('\n').entries()) {
    if (/\t/.test(text)) throw new PyError('SyntaxError', 'use spaces, not tabs', i + 1);
    const tokens = tokenize(text, i + 1);
    if (tokens.length > 0) lines.push({ number: i + 1, indent: /^ */.exec(text)![0].length, tokens });
  }
  let pos = 0;
  /** How many loops the statement being parsed is in (a `def` starts again at 0): `break` needs one. */
  let loops = 0;

  function block(indent: number): Stmt[] {
    const stmts: Stmt[] = [];
    while (pos < lines.length && lines[pos]!.indent === indent) stmts.push(statement(indent));
    const next = lines[pos];
    if (next && next.indent > indent) {
      // Coming back out of a deeper block to a depth no block has is not an indent but a bad unindent.
      const unindent = pos > 0 && lines[pos - 1]!.indent > next.indent;
      throw new PyError('IndentationError', unindent ? 'unindent does not match any outer indentation level' : 'unexpected indent', next.number);
    }
    return stmts;
  }

  /** The indented block after a line ending in ':'. */
  function body(header: Line): Stmt[] {
    const next = lines[pos];
    if (!next || next.indent <= header.indent) {
      const keyword = header.tokens[0]!.text;
      const what = keyword === 'def' ? 'function definition' : `'${keyword}' statement`;
      throw new PyError('IndentationError', `expected an indented block after ${what} on line ${header.number}`, next?.number ?? header.number);
    }
    return block(next.indent);
  }

  function loopBody(header: Line): Stmt[] {
    loops++;
    try {
      return body(header);
    } finally {
      loops--;
    }
  }

  /** Parses `<keyword> <expr>:` and returns the expression. */
  function headerExpr(p: ExprParser): Expr {
    const expr = p.expression();
    p.expect(':');
    p.end();
    return expr;
  }

  function statement(indent: number): Stmt {
    const line = lines[pos++]!;
    const p = new ExprParser(line.tokens, line.number);
    const first = line.tokens[0]!.text;
    const at = line.number;
    const skip = () => p.expect(first);

    switch (first) {
      case 'if': {
        skip();
        const branches = [{ line: at, cond: headerExpr(p), body: body(line) }];
        let orelse: Stmt[] = [];
        while (pos < lines.length && lines[pos]!.indent === indent && lines[pos]!.tokens[0]!.text === 'elif') {
          const elif = lines[pos++]!;
          const ep = new ExprParser(elif.tokens, elif.number);
          ep.expect('elif');
          branches.push({ line: elif.number, cond: headerExpr(ep), body: body(elif) });
        }
        if (pos < lines.length && lines[pos]!.indent === indent && lines[pos]!.tokens[0]!.text === 'else') {
          const other = lines[pos++]!;
          const op = new ExprParser(other.tokens, other.number);
          op.expect('else');
          op.expect(':');
          op.end();
          orelse = body(other);
        }
        return { kind: 'if', branches, orelse };
      }
      case 'elif':
      case 'else':
        throw new PyError('SyntaxError', `'${first}' without 'if'`, at);
      case 'while': {
        skip();
        const cond = headerExpr(p);
        return { kind: 'while', line: at, cond, body: loopBody(line) };
      }
      case 'for': {
        skip();
        const name = p.identifier();
        p.expect('in');
        const iter = headerExpr(p);
        return { kind: 'for', line: at, name, iter, body: loopBody(line) };
      }
      case 'break':
      case 'continue':
        skip();
        p.end();
        if (loops === 0) throw new PyError('SyntaxError', `'${first}' outside loop`, at);
        return { kind: first, line: at };
      case 'def': {
        skip();
        const name = p.identifier();
        p.expect('(');
        const params: string[] = [];
        const defaults: Expr[] = [];
        if (!p.accept(')')) {
          do {
            params.push(p.identifier());
            if (p.accept('=')) defaults.push(p.expression());
            else if (defaults.length > 0) p.fail('parameter without a default follows parameter with a default');
          } while (p.accept(','));
          p.expect(')');
        }
        p.expect(':');
        p.end();
        const outer = loops;
        loops = 0;
        const stmts = body(line);
        loops = outer;
        return { kind: 'def', line: at, name, params, defaults, body: stmts };
      }
      case 'return': {
        skip();
        if (p.atEnd()) return { kind: 'return', line: at };
        const expr = p.expression();
        p.end();
        return { kind: 'return', line: at, expr };
      }
      case 'pass':
        skip();
        p.end();
        return { kind: 'pass', line: at };
    }

    const op = line.tokens[1]?.text;
    if (line.tokens[0]!.type === 'name' && (op === '=' || op === '+=' || op === '-=')) {
      const name = p.identifier();
      p.expect(op);
      const expr = p.expression();
      p.end();
      return { kind: 'assign', line: at, name, op, expr };
    }
    const expr = p.expression();
    p.end();
    return { kind: 'expr', line: at, expr };
  }

  const program = block(0);
  if (pos < lines.length) throw new PyError('SyntaxError', 'unindent does not match', lines[pos]!.number);
  return program;
}

// ---------------------------------------------------------------- runtime

/** Where execution pauses: before the statement or check on `line`. */
export interface Pause {
  line: number;
}

interface Frame {
  vars: Map<string, Value>;
  /** Hidden loop state (each running `for`: its items and the current index), part of the loop-detection key. */
  loops: [Value[] | string, number][];
}

class Break {}
class Continue {}

class Return {
  readonly value: Value;
  constructor(value: Value) {
    this.value = value;
  }
}

const MAX_DEPTH = 30;

const isNumber = (v: Value): v is number => typeof v === 'number' || typeof v === 'boolean';
const num = (v: Value): number => Number(v);

export function truthy(v: Value): boolean {
  if (Array.isArray(v) || typeof v === 'string') return v.length > 0;
  if (v === null) return false;
  if (typeof v === 'object') return true;
  return Boolean(v);
}

/** How Python prints a value (repr), for the variables panel. */
export function repr(v: Value): string {
  if (v === null) return 'None';
  if (v === true) return 'True';
  if (v === false) return 'False';
  if (typeof v === 'string') return v.includes("'") && !v.includes('"') ? `"${v}"` : `'${v}'`;
  if (Array.isArray(v)) return `[${v.map(repr).join(', ')}]`;
  if (typeof v === 'object') return `<function ${v.name}>`;
  return String(v);
}

/** The state of a running program, visible between steps. */
export class Interpreter {
  readonly globals: Frame = { vars: new Map(), loops: [] };
  private frames: Frame[] = [this.globals];
  private calls: number[] = [];

  constructor(builtins: readonly Builtin[]) {
    const range: Builtin = {
      kind: 'builtin',
      name: 'range',
      arity: -1,
      call: (args) => {
        if (args.length < 1 || args.length > 3) throw new TypeError('range() takes 1 to 3 integers');
        const bad = args.find((a) => !isNumber(a));
        if (bad !== undefined) throw new TypeError(`'${typeName(bad)}' object cannot be interpreted as an integer`);
        const [start, stop, step] = args.length === 1 ? [0, num(args[0]!), 1] : [num(args[0]!), num(args[1]!), num(args[2] ?? 1)];
        if (step === 0) throw new PyError('ValueError', 'range() arg 3 must not be zero', 0);
        const items: number[] = [];
        for (let i = start; step > 0 ? i < stop : i > stop; i += step) items.push(i);
        return items;
      },
    };
    const len: Builtin = {
      kind: 'builtin',
      name: 'len',
      arity: 1,
      call: ([v]) => {
        if (typeof v === 'string' || Array.isArray(v)) return v.length;
        throw new TypeError(`object of type '${typeName(v!)}' has no len()`);
      },
    };
    this.builtins = new Map([range, len, ...builtins].map((b) => [b.name, b]));
  }

  private builtins: Map<string, Builtin>;

  /** Variables in scope at the current step: the globals, then the locals of the running function. */
  variables(): [string, Value][] {
    const visible = new Map(this.globals.vars);
    const top = this.frames.at(-1)!;
    if (top !== this.globals) for (const [k, v] of top.vars) visible.set(k, v);
    return [...visible].filter(([, v]) => typeof v !== 'object' || v === null || Array.isArray(v));
  }

  /** A fingerprint of the whole program state (without the world). Equal fingerprints at the same line mean an endless loop. */
  fingerprint(): string {
    return JSON.stringify([
      this.calls,
      this.frames.map((f) => [f.loops, [...f.vars].filter(([, v]) => typeof v !== 'object' || v === null || Array.isArray(v))]),
    ]);
  }

  /** Runs the program; yields before every statement and every loop/branch check. */
  *run(program: Stmt[]): Generator<Pause, void> {
    yield* this.block(program);
  }

  private frame(): Frame {
    return this.frames.at(-1)!;
  }

  private *block(stmts: Stmt[]): Generator<Pause, void> {
    for (const stmt of stmts) yield* this.exec(stmt);
  }

  private *exec(stmt: Stmt): Generator<Pause, void> {
    switch (stmt.kind) {
      case 'expr':
        yield { line: stmt.line };
        yield* this.eval(stmt.expr, stmt.line);
        return;
      case 'assign': {
        yield { line: stmt.line };
        const value = yield* this.eval(stmt.expr, stmt.line);
        if (stmt.op === '=') {
          this.frame().vars.set(stmt.name, value);
          return;
        }
        // Like Python: a function cannot update a global with += (UnboundLocalError).
        if (this.frames.length > 1 && !this.frame().vars.has(stmt.name)) {
          throw new PyError('UnboundLocalError', `local variable '${stmt.name}' referenced before assignment`, stmt.line);
        }
        const old = this.lookup(stmt.name, stmt.line);
        this.frame().vars.set(stmt.name, this.binary(stmt.op === '+=' ? '+' : '-', old, value, stmt.line));
        return;
      }
      case 'if':
        for (const branch of stmt.branches) {
          yield { line: branch.line };
          if (truthy(yield* this.eval(branch.cond, branch.line))) {
            yield* this.block(branch.body);
            return;
          }
        }
        yield* this.block(stmt.orelse);
        return;
      case 'while':
        for (;;) {
          yield { line: stmt.line };
          if (!truthy(yield* this.eval(stmt.cond, stmt.line))) return;
          if ((yield* this.loopBody(stmt.body)) === 'break') return;
        }
      case 'for': {
        yield { line: stmt.line };
        const items = yield* this.eval(stmt.iter, stmt.line);
        if (!Array.isArray(items) && typeof items !== 'string') {
          throw new PyError('TypeError', `'${typeName(items)}' object is not iterable`, stmt.line);
        }
        const loops = this.frame().loops;
        const state: [Value[] | string, number] = [items, 0];
        loops.push(state);
        try {
          for (const [i, item] of [...items].entries()) {
            if (i > 0) yield { line: stmt.line };
            state[1] = i;
            this.frame().vars.set(stmt.name, item);
            if ((yield* this.loopBody(stmt.body)) === 'break') return;
          }
        } finally {
          loops.pop();
        }
        return;
      }
      case 'break':
        yield { line: stmt.line };
        throw new Break();
      case 'continue':
        yield { line: stmt.line };
        throw new Continue();
      case 'def': {
        yield { line: stmt.line };
        const defaults: Value[] = [];
        for (const d of stmt.defaults) defaults.push(yield* this.eval(d, stmt.line));
        this.frame().vars.set(stmt.name, { kind: 'function', name: stmt.name, params: stmt.params, defaults, body: stmt.body });
        return;
      }
      case 'return': {
        yield { line: stmt.line };
        if (this.frames.length === 1) throw new PyError('SyntaxError', "'return' outside function", stmt.line);
        throw new Return(stmt.expr ? yield* this.eval(stmt.expr, stmt.line) : null);
      }
      case 'pass':
        yield { line: stmt.line };
        return;
    }
  }

  /** Runs one pass of a loop body; tells whether it ended with `break`. */
  private *loopBody(stmts: Stmt[]): Generator<Pause, 'break' | undefined> {
    try {
      yield* this.block(stmts);
    } catch (error) {
      if (error instanceof Break) return 'break';
      if (!(error instanceof Continue)) throw error;
    }
    return undefined;
  }

  private lookup(name: string, line: number): Value {
    const local = this.frame().vars;
    if (local.has(name)) return local.get(name)!;
    if (this.globals.vars.has(name)) return this.globals.vars.get(name)!;
    const builtin = this.builtins.get(name);
    if (builtin) return builtin;
    throw new PyError('NameError', `name '${name}' is not defined`, line);
  }

  private *eval(expr: Expr, line: number): Generator<Pause, Value> {
    switch (expr.kind) {
      case 'num':
      case 'bool':
      case 'str':
        return expr.value;
      case 'list': {
        const items: Value[] = [];
        for (const item of expr.items) items.push(yield* this.eval(item, line));
        return items;
      }
      case 'index': {
        const target = yield* this.eval(expr.target, line);
        const index = yield* this.eval(expr.index, line);
        if (typeof target !== 'string' && !Array.isArray(target)) {
          throw new PyError('TypeError', `'${typeName(target)}' object is not subscriptable`, line);
        }
        const what = typeof target === 'string' ? 'string' : 'list';
        if (!isNumber(index)) throw new PyError('TypeError', `${what} indices must be integers`, line);
        const i = num(index) < 0 ? target.length + num(index) : num(index);
        if (i < 0 || i >= target.length) throw new PyError('IndexError', `${what} index out of range`, line);
        return target[i]!;
      }
      case 'name':
        return this.lookup(expr.name, line);
      case 'unary': {
        const value = yield* this.eval(expr.operand, line);
        if (expr.op === 'not') return !truthy(value);
        if (!isNumber(value)) throw new PyError('TypeError', "bad operand type for unary -", line);
        return -num(value);
      }
      case 'binary': {
        const left = yield* this.eval(expr.left, line);
        // `and`/`or` return one of their operands and skip the right one when they can.
        if (expr.op === 'and') return truthy(left) ? yield* this.eval(expr.right, line) : left;
        if (expr.op === 'or') return truthy(left) ? left : yield* this.eval(expr.right, line);
        const right = yield* this.eval(expr.right, line);
        return this.binary(expr.op, left, right, line);
      }
      case 'call': {
        const callee = this.lookup(expr.name, line);
        const args: Value[] = [];
        for (const arg of expr.args) args.push(yield* this.eval(arg, line));
        if (callee === null || typeof callee !== 'object' || Array.isArray(callee)) {
          throw new PyError('TypeError', `'${repr(callee)}' is not callable`, line);
        }
        if (callee.kind === 'builtin') {
          if (callee.arity >= 0 && args.length !== callee.arity) {
            throw new PyError('TypeError', `${callee.name}() takes ${callee.arity} arguments but ${args.length} were given`, line);
          }
          try {
            return callee.call(args);
          } catch (error) {
            if (error instanceof TypeError) throw new PyError('TypeError', error.message, line);
            // Builtins do not know the line they are called from.
            if (error instanceof PyError && error.line === 0) throw new PyError(error.type, error.message.replace(/^\w+: /, ''), line);
            throw error;
          }
        }
        const required = callee.params.length - callee.defaults.length;
        if (args.length < required || args.length > callee.params.length) {
          const takes = required === callee.params.length ? `${required}` : `${required} to ${callee.params.length}`;
          throw new PyError('TypeError', `${callee.name}() takes ${takes} arguments but ${args.length} were given`, line);
        }
        if (this.frames.length > MAX_DEPTH) throw new PyError('RecursionError', 'maximum recursion depth exceeded', line);
        const values = [...args, ...callee.defaults.slice(args.length - required)];
        this.frames.push({ vars: new Map(callee.params.map((p, i) => [p, values[i]!])), loops: [] });
        this.calls.push(line);
        try {
          yield* this.block(callee.body);
          return null;
        } catch (error) {
          if (error instanceof Return) return error.value;
          throw error;
        } finally {
          this.frames.pop();
          this.calls.pop();
        }
      }
    }
  }

  private binary(op: BinaryOp, left: Value, right: Value, line: number): Value {
    if (op === '==') return equal(left, right);
    if (op === '!=') return !equal(left, right);
    if (op === '+' && typeof left === 'string' && typeof right === 'string') return left + right;
    if (op === '+' && Array.isArray(left) && Array.isArray(right)) return [...left, ...right];
    if (!isNumber(left) || !isNumber(right)) {
      throw new PyError('TypeError', `unsupported operand types for ${op}: '${typeName(left)}' and '${typeName(right)}'`, line);
    }
    const a = num(left);
    const b = num(right);
    switch (op) {
      case '+':
        return a + b;
      case '-':
        return a - b;
      case '*':
        return a * b;
      case '//':
      case '%': {
        if (b === 0) throw new PyError('ZeroDivisionError', 'division by zero', line);
        const quotient = Math.floor(a / b);
        return op === '//' ? quotient : a - b * quotient;
      }
      case '<':
        return a < b;
      case '>':
        return a > b;
      case '<=':
        return a <= b;
      case '>=':
        return a >= b;
      default:
        throw new PyError('SyntaxError', `unknown operator ${op}`, line);
    }
  }
}

function equal(a: Value, b: Value): boolean {
  if (isNumber(a) && isNumber(b)) return num(a) === num(b);
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => equal(x, b[i]!));
  return a === b;
}

/** Python's name for the type of a value, for error messages. */
function typeName(v: Value): string {
  if (v === null) return 'NoneType';
  if (typeof v === 'boolean') return 'bool';
  if (typeof v === 'number') return 'int';
  if (typeof v === 'string') return 'str';
  if (Array.isArray(v)) return 'list';
  return v.kind === 'builtin' ? 'builtin_function_or_method' : 'function';
}
