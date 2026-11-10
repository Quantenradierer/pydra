/**
 * A resumable tree-walking evaluator for the teaching subset of Python.
 *
 * The evaluator is a stack of generators, so it can pause in the middle of
 * any expression: `runUntilAction()` runs until the script calls an action
 * (a host function that returns an `ActionRequest`) or uses up its step
 * budget, and the next call resumes exactly there.
 */
import type { Expr, Stmt, Target } from './ast.ts';
import { BUILTINS, callMethod, hasMethod, methodNames, toArray } from './builtins.ts';
import { BudgetExceeded, RbError, suggest } from './errors.ts';
import type { TraceEvent } from './trace.ts';
import {
  ActionRequest, compare, equal, formatValue, isFloat, isInt, isNumeric, keyOf, PyDict, PyFloat, PyRange, PyTuple, repr, Scope, str, toNumber, truthy, typeName,
  type Builtin, type PyFunction, type Value,
} from './values.ts';

export interface ProgramOptions {
  /** Pre-bound names: host functions and objects. */
  globals?: Record<string, Value>;
  /** Names that exist but are not usable here, for better "did you mean" hints. */
  known?: string[];
  /** Gets everything `print()` writes, including the trailing newline. */
  print?: (text: string) => void;
  maxDepth?: number;
  /** Gets one event per executed statement, call, branch, loop pass and variable change (see `trace.ts`). */
  trace?: (event: TraceEvent) => void;
}

export type RunResult =
  | { kind: 'action'; request: ActionRequest; line: number }
  | { kind: 'done' }
  | { kind: 'budget'; line: number }
  | { kind: 'error'; error: RbError };

const BREAK = Symbol('break');
const CONTINUE = Symbol('continue');
class Return {
  constructor(readonly value: Value) {}
}
type Flow = undefined | typeof BREAK | typeof CONTINUE | Return;
type Gen<T> = Generator<ActionRequest, T, Value>;

const MAX_DEPTH = 40;

/** Names assigned in a function body: Python treats them as local to it. */
function assignedNames(body: Stmt[], out = new Set<string>(), globals = new Set<string>()): { locals: Set<string>; globals: Set<string> } {
  const target = (t: Target) => {
    if (t.kind === 'name') out.add(t.name);
    else if (t.kind === 'tuple') t.items.forEach(target);
  };
  for (const s of body) {
    switch (s.kind) {
      case 'assign':
        s.targets.forEach(target);
        break;
      case 'augassign':
        target(s.target);
        break;
      case 'for':
        target(s.target);
        assignedNames(s.body, out, globals);
        break;
      case 'while':
        assignedNames(s.body, out, globals);
        break;
      case 'if':
        assignedNames(s.body, out, globals);
        assignedNames(s.orelse, out, globals);
        break;
      case 'def':
        out.add(s.name);
        break;
      case 'global':
        s.names.forEach((n) => globals.add(n));
        break;
    }
  }
  return { locals: out, globals };
}

const localCache = new WeakMap<Stmt[], { locals: Set<string>; globals: Set<string> }>();
function localsOf(fn: PyFunction) {
  let info = localCache.get(fn.body);
  if (!info) {
    info = assignedNames(fn.body);
    for (const p of fn.params) info.locals.add(p.name);
    for (const g of info.globals) info.locals.delete(g);
    localCache.set(fn.body, info);
  }
  return info;
}

/** `forward`, `eyes.see_right`: the name a call is shown with. */
function calleeName(e: Expr): string {
  return e.kind === 'name' ? e.name : e.kind === 'attr' ? `${calleeName(e.obj)}.${e.name}` : '…';
}

const lineless = (e: RbError, line: number) => (e.line === 0 ? e.at(line) : e);

export class Program {
  readonly module = new Scope(undefined, undefined);
  private scope = this.module;
  private builtins = new Map<string, Builtin>();
  private known = new Set<string>();
  private gen: Gen<void>;
  private started = false;
  private finished = false;
  private budget = 0;
  private steps = 0;
  private depth = 0;
  private maxDepth: number;
  private trace: ((event: TraceEvent) => void) | undefined;
  /** The line being executed; with an action, the line of the call. */
  line = 0;
  /** Total steps used so far (statements and calls). */
  totalSteps = 0;

  constructor(
    private ast: Stmt[],
    private options: ProgramOptions = {},
  ) {
    this.maxDepth = options.maxDepth ?? MAX_DEPTH;
    this.trace = options.trace;
    for (const b of BUILTINS) this.builtins.set(b.name, b);
    const print = options.print;
    this.builtins.set('print', {
      kind: 'builtin',
      name: 'print',
      call: (args, kwargs) => {
        const sep = kwargs.sep === undefined || kwargs.sep === null ? ' ' : str(kwargs.sep);
        const end = kwargs.end === undefined || kwargs.end === null ? '\n' : str(kwargs.end);
        print?.(args.map(str).join(sep) + end);
        return null;
      },
    });
    for (const [k, v] of Object.entries(options.globals ?? {})) this.module.vars.set(k, v);
    for (const k of options.known ?? []) this.known.add(k);
    this.gen = this.runModule();
  }

  /** Every name the script could mean, for "did you mean" hints. */
  names(): string[] {
    const out = new Set<string>([...this.builtins.keys(), ...this.known]);
    for (const s of [this.scope, this.module]) for (const k of s.vars.keys()) out.add(k);
    return [...out];
  }

  /** The variables of the module scope that are plain data, for the viewer. */
  variables(): [string, string][] {
    return [...this.module.vars].filter(([, v]) => typeof v !== 'object' || v === null || Array.isArray(v) || v instanceof PyFloat || v instanceof PyTuple || v instanceof PyDict).map(([k, v]) => [k, repr(v)]);
  }

  get done(): boolean {
    return this.finished;
  }

  /**
   * Runs until the script calls an action, ends, fails, or has used `maxSteps`
   * steps since this call. `resume` is the value the pending action returns.
   */
  runUntilAction(maxSteps: number, resume: Value = null): RunResult {
    if (this.finished) return { kind: 'done' };
    this.budget = maxSteps;
    this.steps = 0;
    try {
      const r = this.started ? this.gen.next(resume) : ((this.started = true), this.gen.next());
      if (r.done) {
        this.finished = true;
        return { kind: 'done' };
      }
      return { kind: 'action', request: r.value, line: r.value.line };
    } catch (e) {
      this.finished = true;
      if (e instanceof BudgetExceeded) return { kind: 'budget', line: this.line };
      if (e instanceof RbError) return { kind: 'error', error: e };
      throw e;
    }
  }

  /** Runs to the end (no actions allowed to pause: they return None at once). Used by the golden tests. */
  runAll(maxSteps = 1_000_000): RunResult {
    let result = this.runUntilAction(maxSteps);
    while (result.kind === 'action') result = this.runUntilAction(maxSteps);
    return result;
  }

  private tick(line: number) {
    this.line = line;
    this.totalSteps++;
    if (++this.steps > this.budget) throw new BudgetExceeded();
  }

  private *runModule(): Gen<void> {
    yield* this.block(this.ast);
  }

  // ------------------------------------------------------------ statements

  private *block(stmts: Stmt[]): Gen<Flow> {
    for (const s of stmts) {
      const flow = yield* this.exec(s);
      if (flow !== undefined) return flow;
    }
    return undefined;
  }

  private *exec(s: Stmt): Gen<Flow> {
    this.tick(s.line);
    this.trace?.({ k: 'line', line: s.line });
    try {
      return yield* this.execInner(s);
    } catch (e) {
      if (e instanceof RbError) throw lineless(e, s.line);
      throw e;
    }
  }

  private *execInner(s: Stmt): Gen<Flow> {
    switch (s.kind) {
      case 'expr':
        yield* this.eval(s.expr);
        return undefined;
      case 'pass':
        return undefined;
      case 'assign': {
        const value = yield* this.eval(s.value);
        for (const t of s.targets) yield* this.assign(t, value);
        return undefined;
      }
      case 'augassign': {
        if (s.target.kind === 'name') {
          const old = this.lookup(s.target.name);
          const value = yield* this.eval(s.value);
          this.setName(s.target.name, this.arith(s.op, old, value));
        } else if (s.target.kind === 'index') {
          const obj = yield* this.eval(s.target.obj);
          const index = yield* this.eval(s.target.index);
          const value = yield* this.eval(s.value);
          this.setIndex(obj, index, this.arith(s.op, this.getIndex(obj, index), value));
        }
        return undefined;
      }
      case 'if': {
        const taken = truthy(yield* this.eval(s.test));
        this.trace?.({ k: 'branch', line: s.line, kind: 'if', taken, hasElse: s.orelse.length > 0 });
        if (taken) return yield* this.block(s.body);
        return yield* this.block(s.orelse);
      }
      case 'while':
        for (let n = 1; ; n++) {
          const taken = truthy(yield* this.eval(s.test));
          this.trace?.({ k: 'branch', line: s.line, kind: 'while', taken, n });
          if (!taken) break;
          const flow = yield* this.block(s.body);
          if (flow === BREAK) break;
          if (flow instanceof Return) return flow;
          this.tick(s.line);
        }
        return undefined;
      case 'for': {
        const iterable = yield* this.eval(s.iter);
        if (iterable instanceof PyRange) {
          for (let i = 0; i < iterable.length; i++) {
            this.trace?.({ k: 'branch', line: s.line, kind: 'for', taken: true, n: i + 1, value: repr(iterable.at(i)) });
            yield* this.assign(s.target, iterable.at(i));
            const flow = yield* this.block(s.body);
            if (flow === BREAK) break;
            if (flow instanceof Return) return flow;
            this.tick(s.line);
          }
          this.trace?.({ k: 'branch', line: s.line, kind: 'for', taken: false });
          return undefined;
        }
        const live = Array.isArray(iterable) ? iterable : toArray(iterable);
        for (let i = 0; i < live.length; i++) {
          this.trace?.({ k: 'branch', line: s.line, kind: 'for', taken: true, n: i + 1, value: repr(live[i]!) });
          yield* this.assign(s.target, live[i]!);
          const flow = yield* this.block(s.body);
          if (flow === BREAK) break;
          if (flow instanceof Return) return flow;
          this.tick(s.line);
        }
        this.trace?.({ k: 'branch', line: s.line, kind: 'for', taken: false });
        return undefined;
      }
      case 'break':
        return BREAK;
      case 'continue':
        return CONTINUE;
      case 'def': {
        const defaults: (Value | undefined)[] = [];
        for (const p of s.params) defaults.push(p.default ? yield* this.eval(p.default) : undefined);
        this.setName(s.name, { kind: 'function', name: s.name, params: s.params, defaults, body: s.body, closure: this.scope }, false);
        return undefined;
      }
      case 'return':
        return new Return(s.value ? yield* this.eval(s.value) : null);
      case 'global':
        for (const n of s.names) this.scope.globals.add(n);
        return undefined;
    }
  }

  private *assign(t: Target, value: Value): Gen<void> {
    if (t.kind === 'name') {
      this.setName(t.name, value);
    } else if (t.kind === 'index') {
      const obj = yield* this.eval(t.obj);
      const index = yield* this.eval(t.index);
      this.setIndex(obj, index, value);
    } else {
      let items: Value[];
      if (typeof value === 'string' || Array.isArray(value) || value instanceof PyTuple || value instanceof PyDict || value instanceof PyRange) items = toArray(value);
      else throw new RbError('TypeError', 'not-iterable', { type: typeName(value) }, 0, `cannot unpack non-iterable ${typeName(value)} object`);
      if (items.length !== t.items.length) {
        const detail = items.length < t.items.length ? `not enough values to unpack (expected ${t.items.length}, got ${items.length})` : `too many values to unpack (expected ${t.items.length})`;
        throw new RbError('ValueError', 'unpack', { expected: t.items.length, got: items.length }, 0, detail);
      }
      for (const [i, sub] of t.items.entries()) yield* this.assign(sub, items[i]!);
    }
  }

  private setName(name: string, value: Value, traced = true) {
    const global = this.scope.globals.has(name);
    if (global) this.module.vars.set(name, value);
    else this.scope.vars.set(name, value);
    if (traced && this.trace) this.trace({ k: 'set', line: this.line, name, value: repr(value), depth: global ? 0 : this.depth });
  }

  private lookup(name: string): Value {
    const current = this.scope;
    for (let s: Scope | undefined = current; s; s = s.parent) {
      if (s.globals.has(name)) return this.fromModule(name);
      const v = s.vars.get(name);
      if (v !== undefined) return v;
      if (s === current && s.localNames?.has(name)) {
        throw new RbError('UnboundLocalError', 'unbound-local', { name }, 0, `cannot access local variable '${name}' where it is not associated with a value`);
      }
    }
    return this.fromModule(name);
  }

  private fromModule(name: string): Value {
    const v = this.module.vars.get(name);
    if (v !== undefined) return v;
    const b = this.builtins.get(name);
    if (b) return b;
    const hint = suggest(name, this.names());
    const callable = hint !== undefined && (this.builtins.has(hint) || this.known.has(hint) || ((v) => v !== null && typeof v === 'object' && !Array.isArray(v) && 'kind' in v && v.kind !== 'object')(this.module.vars.get(hint)));
    throw new RbError('NameError', 'unknown-name', { name, ...(hint ? { suggestion: callable ? `${hint}()` : hint } : {}) }, 0, `name '${name}' is not defined`);
  }

  // ------------------------------------------------------------ expressions

  private *eval(e: Expr): Gen<Value> {
    switch (e.kind) {
      case 'int':
        return e.value;
      case 'float':
        return new PyFloat(e.value);
      case 'str':
        return e.value;
      case 'const':
        return e.value;
      case 'name':
        return this.lookup(e.name);
      case 'fstr': {
        let out = '';
        for (const part of e.parts) {
          if (typeof part === 'string') out += part;
          else {
            const v = yield* this.eval(part.expr);
            out += formatValue(part.conv === 'r' ? repr(v) : part.conv === 's' ? str(v) : v, part.spec);
          }
        }
        return out;
      }
      case 'list': {
        const items: Value[] = [];
        for (const i of e.items) items.push(yield* this.eval(i));
        return items;
      }
      case 'tuple': {
        const items: Value[] = [];
        for (const i of e.items) items.push(yield* this.eval(i));
        return new PyTuple(items);
      }
      case 'dict': {
        const d = new PyDict();
        for (const [k, v] of e.entries) {
          const key = yield* this.eval(k);
          d.set(key, yield* this.eval(v));
        }
        return d;
      }
      case 'unary': {
        const v = yield* this.eval(e.operand);
        if (e.op === 'not') return !truthy(v);
        if (!isNumeric(v)) {
          throw new RbError('TypeError', 'bad-operand-unary', { op: e.op, type: typeName(v) }, 0, `bad operand type for unary ${e.op}: '${typeName(v)}'`);
        }
        const n = toNumber(v);
        const r = e.op === '-' ? -n : n;
        return isFloat(v) ? new PyFloat(r) : r === 0 ? 0 : r;
      }
      case 'binary': {
        const left = yield* this.eval(e.left);
        const right = yield* this.eval(e.right);
        return this.arith(e.op, left, right);
      }
      case 'bool': {
        const left = yield* this.eval(e.left);
        if (e.op === 'and') return truthy(left) ? yield* this.eval(e.right) : left;
        return truthy(left) ? left : yield* this.eval(e.right);
      }
      case 'compare': {
        let left = yield* this.eval(e.first);
        for (const { op, right: re } of e.rest) {
          const right = yield* this.eval(re);
          if (!this.compareOp(op, left, right)) return false;
          left = right;
        }
        return true;
      }
      case 'ifexp':
        return truthy(yield* this.eval(e.test)) ? yield* this.eval(e.body) : yield* this.eval(e.orelse);
      case 'attr': {
        const obj = yield* this.eval(e.obj);
        return this.attribute(obj, e.name);
      }
      case 'index': {
        const obj = yield* this.eval(e.obj);
        const index = yield* this.eval(e.index);
        return this.getIndex(obj, index);
      }
      case 'slice': {
        const obj = yield* this.eval(e.obj);
        const part = function* (self: Program, x: Expr | undefined): Gen<number | undefined> {
          if (!x) return undefined;
          const v = yield* self.eval(x);
          if (v === null) return undefined;
          if (!isInt(v)) throw new RbError('TypeError', 'slice-index', {}, 0, 'slice indices must be integers or None or have an __index__ method');
          return Number(v);
        };
        const lower = yield* part(this, e.lower);
        const upper = yield* part(this, e.upper);
        const step = yield* part(this, e.step);
        return this.slice(obj, lower, upper, step);
      }
      case 'call':
        return yield* this.call(e);
    }
  }

  private *call(e: Extract<Expr, { kind: 'call' }>): Gen<Value> {
    const callee = yield* this.eval(e.func);
    const args: Value[] = [];
    for (const a of e.args) args.push(yield* this.eval(a));
    const kwargs: Record<string, Value> = {};
    for (const k of e.kwargs) kwargs[k.name] = yield* this.eval(k.value);
    this.tick(e.line);
    try {
      return yield* this.invoke(callee, args, kwargs, e);
    } catch (err) {
      if (err instanceof RbError) throw lineless(err, e.line);
      throw err;
    }
  }

  private *invoke(callee: Value, args: Value[], kwargs: Record<string, Value>, e: Extract<Expr, { kind: 'call' }>): Gen<Value> {
    if (callee === null || typeof callee !== 'object' || Array.isArray(callee) || callee instanceof PyFloat || callee instanceof PyTuple || callee instanceof PyDict || callee instanceof PyRange) {
      throw new RbError('TypeError', 'not-callable', { type: typeName(callee) }, 0, `'${typeName(callee)}' object is not callable`);
    }
    switch (callee.kind) {
      case 'builtin':
        if (callee.name === 'print' && this.trace) this.trace({ k: 'call', line: e.line, fn: 'print', args: args.map(repr), kind: 'print', result: 'None' });
        return callee.call(args, kwargs);
      case 'method':
        return callMethod(callee.self, callee.name, args, kwargs);
      case 'host': {
        const r = callee.call(args, kwargs);
        const label = this.trace ? calleeName(e.func) : '';
        const shown = this.trace ? [...args.map(repr), ...Object.entries(kwargs).map(([k, v]) => `${k}=${repr(v)}`)] : [];
        if (r instanceof ActionRequest) {
          r.line = e.line;
          this.line = e.line;
          this.trace?.({ k: 'call', line: e.line, fn: label, args: shown, kind: 'action' });
          return yield r;
        }
        this.trace?.({ k: 'call', line: e.line, fn: label, args: shown, kind: 'sensor', result: repr(r) });
        return r;
      }
      case 'function':
        return yield* this.callFunction(callee, args, kwargs);
      case 'object':
        throw new RbError('TypeError', 'not-callable', { type: typeName(callee) }, 0, `'${typeName(callee)}' object is not callable`);
    }
  }

  private *callFunction(fn: PyFunction, args: Value[], kwargs: Record<string, Value>): Gen<Value> {
    const given = args.length;
    if (given > fn.params.length) {
      throw new RbError('TypeError', 'arg-count', { name: fn.name, expected: fn.params.length, given }, 0, `${fn.name}() takes ${fn.params.length} positional argument${fn.params.length === 1 ? '' : 's'} but ${given} ${given === 1 ? 'was' : 'were'} given`);
    }
    const info = localsOf(fn);
    const scope = new Scope(fn.closure, info.locals);
    for (const g of info.globals) scope.globals.add(g);
    for (const [i, p] of fn.params.entries()) {
      let v: Value | undefined = args[i];
      if (p.name in kwargs) {
        if (v !== undefined) throw new RbError('TypeError', 'multiple-values', { name: fn.name, param: p.name }, 0, `${fn.name}() got multiple values for argument '${p.name}'`);
        v = kwargs[p.name];
      }
      v ??= fn.defaults[i];
      if (v === undefined) {
        const missing = fn.params.filter((q, j) => args[j] === undefined && !(q.name in kwargs) && fn.defaults[j] === undefined).map((q) => `'${q.name}'`);
        throw new RbError('TypeError', 'arg-count', { name: fn.name, expected: fn.params.length, given }, 0, `${fn.name}() missing ${missing.length} required positional argument${missing.length === 1 ? '' : 's'}: ${missing.join(' and ')}`);
      }
      scope.vars.set(p.name, v);
    }
    for (const k of Object.keys(kwargs)) {
      if (!fn.params.some((p) => p.name === k)) throw new RbError('TypeError', 'bad-keyword', { name: fn.name, param: k }, 0, `${fn.name}() got an unexpected keyword argument '${k}'`);
    }
    if (this.depth >= this.maxDepth) throw new RbError('RecursionError', 'recursion', {}, 0, 'maximum recursion depth exceeded');
    const outer = this.scope;
    this.scope = scope;
    this.depth++;
    const callLine = this.line;
    this.trace?.({ k: 'enter', line: callLine, fn: fn.name, args: [...fn.params.map((p) => `${p.name}=${repr(scope.vars.get(p.name) ?? null)}`)], depth: this.depth });
    try {
      const flow = yield* this.block(fn.body);
      const value = flow instanceof Return ? flow.value : null;
      this.trace?.({ k: 'leave', line: callLine, fn: fn.name, value: repr(value), depth: this.depth });
      this.line = callLine;
      return value;
    } finally {
      this.depth--;
      this.scope = outer;
    }
  }

  private attribute(obj: Value, name: string): Value {
    if (obj !== null && typeof obj === 'object' && !Array.isArray(obj) && 'kind' in obj && obj.kind === 'object') {
      const f = obj.get(name);
      if (f) return f;
      const hint = suggest(name, obj.names());
      throw new RbError('AttributeError', 'attribute', { type: obj.name, name, ...(hint ? { suggestion: `${hint}()` } : {}) }, 0, `'${obj.name}' object has no attribute '${name}'`);
    }
    if (hasMethod(obj, name)) return { kind: 'method', name, self: obj };
    const hint = suggest(name, methodNames(obj));
    throw new RbError('AttributeError', 'attribute', { type: typeName(obj), name, ...(hint ? { suggestion: `${hint}()` } : {}) }, 0, `'${typeName(obj)}' object has no attribute '${name}'`);
  }

  // ------------------------------------------------------------ operators

  private compareOp(op: string, a: Value, b: Value): boolean {
    switch (op) {
      case '==':
        return equal(a, b);
      case '!=':
        return !equal(a, b);
      case '<':
        return compare(a, b, op) < 0;
      case '>':
        return compare(a, b, op) > 0;
      case '<=':
        return compare(a, b, op) <= 0;
      case '>=':
        return compare(a, b, op) >= 0;
      case 'is':
        return this.identical(a, b);
      case 'is not':
        return !this.identical(a, b);
      case 'in':
      case 'not in': {
        const found = this.contains(b, a);
        return op === 'in' ? found : !found;
      }
    }
    return false;
  }

  private identical(a: Value, b: Value): boolean {
    if (a === null || b === null || typeof a === 'boolean' || typeof b === 'boolean') return a === b;
    if (typeof a === 'number' && typeof b === 'number') return a === b;
    if (typeof a === 'string' && typeof b === 'string') return a === b;
    return a === b;
  }

  private contains(container: Value, item: Value): boolean {
    if (typeof container === 'string') {
      if (typeof item !== 'string') throw new RbError('TypeError', 'in-string', { type: typeName(item) }, 0, `'in <string>' requires string as left operand, not ${typeName(item)}`);
      return container.includes(item);
    }
    if (container instanceof PyDict) return container.map.has(keyOf(item));
    if (Array.isArray(container) || container instanceof PyTuple || container instanceof PyRange) return toArray(container).some((x) => equal(x, item));
    throw new RbError('TypeError', 'not-container', { type: typeName(container) }, 0, `argument of type '${typeName(container)}' is not iterable`);
  }

  arith(op: string, a: Value, b: Value): Value {
    if (op === '+') {
      if (typeof a === 'string' && typeof b === 'string') return a + b;
      if (Array.isArray(a) && Array.isArray(b)) return [...a, ...b];
      if (a instanceof PyTuple && b instanceof PyTuple) return new PyTuple([...a.items, ...b.items]);
      if (typeof a === 'string') throw new RbError('TypeError', 'concat', { left: 'str', right: typeName(b) }, 0, `can only concatenate str (not "${typeName(b)}") to str`);
      if (Array.isArray(a)) throw new RbError('TypeError', 'concat', { left: 'list', right: typeName(b) }, 0, `can only concatenate list (not "${typeName(b)}") to list`);
    }
    if (op === '*') {
      const rep = (seq: Value, n: Value): Value | undefined => {
        if (!isInt(n)) return undefined;
        const k = Math.max(0, Number(n));
        if (typeof seq === 'string') return seq.repeat(k);
        if (Array.isArray(seq)) return Array.from({ length: k }, () => seq).flat();
        if (seq instanceof PyTuple) return new PyTuple(Array.from({ length: k }, () => seq.items).flat());
        return undefined;
      };
      const r = rep(a, b) ?? rep(b, a);
      if (r !== undefined) return r;
    }
    if (!isNumeric(a) || !isNumeric(b)) {
      throw new RbError('TypeError', 'bad-operand', { op, left: typeName(a), right: typeName(b) }, 0, `unsupported operand type(s) for ${op}: '${typeName(a)}' and '${typeName(b)}'`);
    }
    const x = toNumber(a);
    const y = toNumber(b);
    const float = isFloat(a) || isFloat(b);
    const wrap = (n: number) => (float ? new PyFloat(n) : n);
    switch (op) {
      case '+':
        return wrap(x + y);
      case '-':
        return wrap(x - y);
      case '*':
        return wrap(x * y);
      case '/':
        if (y === 0) throw new RbError('ZeroDivisionError', 'zero-division', {}, 0, 'division by zero');
        return new PyFloat(x / y);
      case '//': {
        if (y === 0) throw new RbError('ZeroDivisionError', 'zero-division', {}, 0, float ? 'float floor division by zero' : 'integer division or modulo by zero');
        return wrap(Math.floor(x / y));
      }
      case '%': {
        if (y === 0) throw new RbError('ZeroDivisionError', 'zero-division', {}, 0, float ? 'float modulo by zero' : 'integer modulo by zero');
        const m = x % y;
        return wrap(m !== 0 && m < 0 !== y < 0 ? m + y : m === 0 ? 0 : m);
      }
      case '**': {
        if (x === 0 && y < 0) throw new RbError('ZeroDivisionError', 'zero-division', {}, 0, 'zero to a negative power');
        const r = x ** y;
        return float || y < 0 ? new PyFloat(r) : r;
      }
    }
    throw new RbError('SyntaxError', 'unknown-operator', { op }, 0, `unknown operator ${op}`);
  }

  private getIndex(obj: Value, index: Value): Value {
    if (obj instanceof PyDict) {
      const v = obj.get(index);
      if (v === undefined) throw new RbError('KeyError', 'key', { key: repr(index) }, 0, repr(index));
      return v;
    }
    const kind = typeof obj === 'string' ? 'string' : Array.isArray(obj) ? 'list' : obj instanceof PyTuple ? 'tuple' : obj instanceof PyRange ? 'range' : undefined;
    if (!kind) throw new RbError('TypeError', 'not-subscriptable', { type: typeName(obj) }, 0, `'${typeName(obj)}' object is not subscriptable`);
    if (!isInt(index)) throw new RbError('TypeError', 'index-type', { what: kind, type: typeName(index) }, 0, `${kind} indices must be integers or slices, not ${typeName(index)}`);
    const items = typeof obj === 'string' ? obj : Array.isArray(obj) ? obj : obj instanceof PyTuple ? obj.items : null;
    const length = items ? items.length : (obj as PyRange).length;
    let i = Number(index);
    if (i < 0) i += length;
    if (i < 0 || i >= length) throw new RbError('IndexError', 'index', { what: kind }, 0, `${kind} index out of range`);
    return items ? (typeof items === 'string' ? [...items][i]! : (items as Value[])[i]!) : (obj as PyRange).at(i);
  }

  private setIndex(obj: Value, index: Value, value: Value) {
    if (obj instanceof PyDict) {
      obj.set(index, value);
      return;
    }
    if (!Array.isArray(obj)) {
      throw new RbError('TypeError', 'no-item-assignment', { type: typeName(obj) }, 0, `'${typeName(obj)}' object does not support item assignment`);
    }
    if (!isInt(index)) throw new RbError('TypeError', 'index-type', { what: 'list', type: typeName(index) }, 0, `list indices must be integers or slices, not ${typeName(index)}`);
    let i = Number(index);
    if (i < 0) i += obj.length;
    if (i < 0 || i >= obj.length) throw new RbError('IndexError', 'assign-index', {}, 0, 'list assignment index out of range');
    obj[i] = value;
  }

  private slice(obj: Value, lower?: number, upper?: number, step = 1): Value {
    const items = typeof obj === 'string' ? [...obj] : Array.isArray(obj) ? obj : obj instanceof PyTuple ? obj.items : undefined;
    if (!items) throw new RbError('TypeError', 'not-subscriptable', { type: typeName(obj) }, 0, `'${typeName(obj)}' object is not subscriptable`);
    if (step === 0) throw new RbError('ValueError', 'slice-step', {}, 0, 'slice step cannot be zero');
    const n = items.length;
    const clamp = (v: number | undefined, dflt: number, lo: number, hi: number) => {
      if (v === undefined) return dflt;
      const w = v < 0 ? v + n : v;
      return Math.min(hi, Math.max(lo, w));
    };
    const out: Value[] = [];
    if (step > 0) {
      for (let i = clamp(lower, 0, 0, n); i < clamp(upper, n, 0, n); i += step) out.push(items[i]!);
    } else {
      for (let i = clamp(lower, n - 1, -1, n - 1); i > clamp(upper, -1, -1, n - 1); i += step) out.push(items[i]!);
    }
    if (typeof obj === 'string') return out.join('');
    return obj instanceof PyTuple ? new PyTuple(out) : out;
  }
}

export { isInt };
