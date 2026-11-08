import type { Expr, Stmt, Target } from './ast.ts';
import { BUILTINS } from './builtins.ts';
import { RbError, suggest } from './errors.ts';

export interface CheckEnv {
  /** Names that exist and are usable: builtins, equipped parts, the player's own definitions are added by the checker. */
  known: Iterable<string>;
  /** Names that exist in the game but are not equipped: name -> the friendly message (already translated). */
  notEquipped: ReadonlyMap<string, string>;
}

/**
 * Runs before the battle and finds the first unknown name or part that is not
 * equipped, anywhere in the script (also in code that would not run). Syntax
 * errors and unsupported syntax were already found by the parser.
 */
export function checkProgram(ast: Stmt[], env: CheckEnv): RbError | undefined {
  const defined = new Set<string>([...BUILTINS.map((b) => b.name), 'print', ...env.known]);
  const assigned = (t: Target) => {
    if (t.kind === 'name') defined.add(t.name);
    else if (t.kind === 'tuple') t.items.forEach(assigned);
  };
  const collect = (stmts: Stmt[]) => {
    for (const s of stmts) {
      switch (s.kind) {
        case 'assign':
          s.targets.forEach(assigned);
          break;
        case 'augassign':
          assigned(s.target);
          break;
        case 'for':
          assigned(s.target);
          collect(s.body);
          break;
        case 'while':
          collect(s.body);
          break;
        case 'if':
          collect(s.body);
          collect(s.orelse);
          break;
        case 'def':
          defined.add(s.name);
          s.params.forEach((p) => defined.add(p.name));
          collect(s.body);
          break;
      }
    }
  };
  collect(ast);

  let found: RbError | undefined;
  const fail = (e: Expr & { kind: 'name' }) => {
    if (found) return;
    const msg = env.notEquipped.get(e.name);
    if (msg !== undefined) {
      found = new RbError('NameError', 'not-equipped', { name: e.name, message: msg }, e.line, `name '${e.name}' is not defined`, e.col);
      return;
    }
    const hint = suggest(e.name, defined);
    found = new RbError('NameError', 'unknown-name', { name: e.name, ...(hint ? { suggestion: isCallable(hint) ? `${hint}()` : hint } : {}) }, e.line, `name '${e.name}' is not defined`, e.col);
  };
  const callables = new Set<string>([...BUILTINS.map((b) => b.name), 'print', ...env.known]);
  const isCallable = (n: string) => callables.has(n);

  const expr = (e: Expr | undefined): void => {
    if (!e || found) return;
    switch (e.kind) {
      case 'name':
        if (!defined.has(e.name)) fail(e);
        break;
      case 'fstr':
        for (const p of e.parts) if (typeof p !== 'string') expr(p.expr);
        break;
      case 'list':
      case 'tuple':
        e.items.forEach(expr);
        break;
      case 'dict':
        e.entries.forEach(([k, v]) => (expr(k), expr(v)));
        break;
      case 'unary':
        expr(e.operand);
        break;
      case 'binary':
      case 'bool':
        expr(e.left);
        expr(e.right);
        break;
      case 'compare':
        expr(e.first);
        e.rest.forEach((r) => expr(r.right));
        break;
      case 'ifexp':
        expr(e.test);
        expr(e.body);
        expr(e.orelse);
        break;
      case 'call':
        expr(e.func);
        e.args.forEach(expr);
        e.kwargs.forEach((k) => expr(k.value));
        break;
      case 'attr':
        expr(e.obj);
        break;
      case 'index':
        expr(e.obj);
        expr(e.index);
        break;
      case 'slice':
        expr(e.obj);
        expr(e.lower);
        expr(e.upper);
        expr(e.step);
        break;
    }
  };
  const target = (t: Target) => {
    if (t.kind === 'index') {
      expr(t.obj);
      expr(t.index);
    } else if (t.kind === 'tuple') t.items.forEach(target);
  };
  const stmts = (list: Stmt[]): void => {
    for (const s of list) {
      if (found) return;
      switch (s.kind) {
        case 'expr':
          expr(s.expr);
          break;
        case 'assign':
          expr(s.value);
          s.targets.forEach(target);
          break;
        case 'augassign':
          expr(s.value);
          target(s.target);
          if (s.target.kind === 'name' && !defined.has(s.target.name)) fail({ kind: 'name', name: s.target.name, line: s.line, col: s.col });
          break;
        case 'if':
          expr(s.test);
          stmts(s.body);
          stmts(s.orelse);
          break;
        case 'while':
          expr(s.test);
          stmts(s.body);
          break;
        case 'for':
          expr(s.iter);
          target(s.target);
          stmts(s.body);
          break;
        case 'def':
          s.params.forEach((p) => expr(p.default));
          stmts(s.body);
          break;
        case 'return':
          expr(s.value);
          break;
      }
    }
  };
  stmts(ast);
  return found;
}
