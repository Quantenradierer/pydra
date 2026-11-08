import type { Param, Stmt } from './ast.ts';
import { RbError } from './errors.ts';

/** A Python float: ints are plain JS numbers, floats carry this tag so `2.0` stays a float. */
export class PyFloat {
  constructor(readonly v: number) {}
}

export class PyTuple {
  constructor(readonly items: Value[]) {}
}

export class PyRange {
  constructor(
    readonly start: number,
    readonly stop: number,
    readonly step: number,
  ) {}

  get length(): number {
    const n = this.step > 0 ? Math.ceil((this.stop - this.start) / this.step) : Math.ceil((this.start - this.stop) / -this.step);
    return Math.max(0, n);
  }

  at(i: number): number {
    return this.start + i * this.step;
  }
}

export class PyDict {
  readonly map = new Map<string, [Value, Value]>();

  get(key: Value): Value | undefined {
    return this.map.get(keyOf(key))?.[1];
  }

  set(key: Value, value: Value) {
    const k = keyOf(key);
    const old = this.map.get(k);
    this.map.set(k, [old ? old[0] : key, value]);
  }
}

export interface PyFunction {
  kind: 'function';
  name: string;
  params: Param[];
  /** Default values by parameter index, evaluated when `def` ran. */
  defaults: (Value | undefined)[];
  body: Stmt[];
  closure: Scope | undefined;
}

export interface Builtin {
  kind: 'builtin';
  name: string;
  call: (args: Value[], kwargs: Record<string, Value>) => Value;
}

/** A request from a host function to pause the script (an action costing a tick). */
export class ActionRequest {
  constructor(
    readonly payload: unknown,
    public line = 0,
  ) {}
}

export interface HostFunction {
  kind: 'host';
  name: string;
  call: (args: Value[], kwargs: Record<string, Value>) => Value | ActionRequest;
}

/** An object made of host functions (`blaster.fire()`). */
export interface HostObject {
  kind: 'object';
  name: string;
  get: (attr: string) => HostFunction | undefined;
  names: () => string[];
}

export interface BoundMethod {
  kind: 'method';
  name: string;
  self: Value;
}

export class Scope {
  readonly vars = new Map<string, Value>();
  /** Names declared `global` in this function. */
  readonly globals = new Set<string>();
  constructor(
    readonly parent: Scope | undefined,
    /** Names assigned in the function body (Python decides statically that they are local). */
    readonly localNames: ReadonlySet<string> | undefined,
  ) {}
}

export type Value = number | boolean | string | null | PyFloat | PyTuple | PyRange | PyDict | Value[] | PyFunction | Builtin | HostFunction | HostObject | BoundMethod;

export const isFloat = (v: Value): v is PyFloat => v instanceof PyFloat;
export const isNumeric = (v: Value): v is number | boolean | PyFloat => typeof v === 'number' || typeof v === 'boolean' || v instanceof PyFloat;
export const isInt = (v: Value): v is number | boolean => typeof v === 'number' || typeof v === 'boolean';
export const toNumber = (v: number | boolean | PyFloat): number => (v instanceof PyFloat ? v.v : Number(v));

export function typeName(v: Value): string {
  if (v === null) return 'NoneType';
  if (typeof v === 'boolean') return 'bool';
  if (typeof v === 'number') return 'int';
  if (typeof v === 'string') return 'str';
  if (v instanceof PyFloat) return 'float';
  if (Array.isArray(v)) return 'list';
  if (v instanceof PyTuple) return 'tuple';
  if (v instanceof PyDict) return 'dict';
  if (v instanceof PyRange) return 'range';
  if (v.kind === 'function') return 'function';
  if (v.kind === 'object') return v.name;
  return v.kind === 'method' ? 'builtin_function_or_method' : 'builtin_function_or_method';
}

export function truthy(v: Value): boolean {
  if (v === null) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string' || Array.isArray(v)) return v.length > 0;
  if (v instanceof PyFloat) return v.v !== 0;
  if (v instanceof PyTuple) return v.items.length > 0;
  if (v instanceof PyDict) return v.map.size > 0;
  if (v instanceof PyRange) return v.length > 0;
  return true;
}

const err = (type: ConstructorParameters<typeof RbError>[0], code: string, params: Record<string, string | number>, detail: string) => new RbError(type, code, params, 0, detail);

/** Hash key for dict lookups: equal Python keys (1, 1.0, True) give the same string. */
export function keyOf(v: Value): string {
  if (v === null) return 'N';
  if (typeof v === 'string') return `s${v}`;
  if (isNumeric(v)) return `n${toNumber(v)}`;
  if (v instanceof PyTuple) return `t(${v.items.map(keyOf).join(',')})`;
  throw err('TypeError', 'unhashable', { type: typeName(v) }, `unhashable type: '${typeName(v)}'`);
}

export function floatRepr(x: number): string {
  if (Number.isNaN(x)) return 'nan';
  if (!Number.isFinite(x)) return x > 0 ? 'inf' : '-inf';
  if (x === 0) return Object.is(x, -0) ? '-0.0' : '0.0';
  const [mantissa, exp] = x.toExponential().split('e') as [string, string];
  const e = Number(exp);
  const sign = mantissa.startsWith('-') ? '-' : '';
  const digits = mantissa.replace('-', '').replace('.', '');
  if (e >= -4 && e < 16) {
    if (e >= digits.length - 1) return `${sign}${digits}${'0'.repeat(e - digits.length + 1)}.0`;
    if (e >= 0) return `${sign}${digits.slice(0, e + 1)}.${digits.slice(e + 1)}`;
    return `${sign}0.${'0'.repeat(-e - 1)}${digits}`;
  }
  const m = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
  return `${sign}${m}e${e < 0 ? '-' : '+'}${String(Math.abs(e)).padStart(2, '0')}`;
}

function strRepr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = quote;
  for (const ch of s) {
    if (ch === quote || ch === '\\') out += `\\${ch}`;
    else if (ch === '\n') out += '\\n';
    else if (ch === '\t') out += '\\t';
    else if (ch === '\r') out += '\\r';
    else if (ch < ' ' || ch === '\x7f') out += `\\x${ch.charCodeAt(0).toString(16).padStart(2, '0')}`;
    else out += ch;
  }
  return out + quote;
}

export function repr(v: Value): string {
  if (v === null) return 'None';
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return strRepr(v);
  if (v instanceof PyFloat) return floatRepr(v.v);
  if (Array.isArray(v)) return `[${v.map(repr).join(', ')}]`;
  if (v instanceof PyTuple) return v.items.length === 1 ? `(${repr(v.items[0]!)},)` : `(${v.items.map(repr).join(', ')})`;
  if (v instanceof PyDict) return `{${[...v.map.values()].map(([k, x]) => `${repr(k)}: ${repr(x)}`).join(', ')}}`;
  if (v instanceof PyRange) return v.step === 1 ? `range(${v.start}, ${v.stop})` : `range(${v.start}, ${v.stop}, ${v.step})`;
  if (v.kind === 'function') return `<function ${v.name}>`;
  if (v.kind === 'object') return `<${v.name} object>`;
  return `<built-in function ${v.name}>`;
}

export const str = (v: Value): string => (typeof v === 'string' ? v : repr(v));

export function equal(a: Value, b: Value): boolean {
  if (isNumeric(a) && isNumeric(b)) return toNumber(a) === toNumber(b);
  if (typeof a === 'string' || typeof b === 'string') return a === b;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => equal(x, b[i]!));
  if (a instanceof PyTuple) return b instanceof PyTuple && a.items.length === b.items.length && a.items.every((x, i) => equal(x, b.items[i]!));
  if (a instanceof PyDict) {
    if (!(b instanceof PyDict) || a.map.size !== b.map.size) return false;
    for (const [k, [, x]] of a.map) {
      const other = b.map.get(k);
      if (!other || !equal(x, other[1])) return false;
    }
    return true;
  }
  if (a instanceof PyRange) return b instanceof PyRange && a.length === b.length && (a.length === 0 || (a.start === b.start && a.step === b.step));
  return a === b;
}

/** Negative / zero / positive like Python's ordering; throws TypeError for unorderable types. */
export function compare(a: Value, b: Value, op: string): number {
  if (isNumeric(a) && isNumeric(b)) {
    const x = toNumber(a);
    const y = toNumber(b);
    return x < y ? -1 : x > y ? 1 : x === y ? 0 : NaN;
  }
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
  const seq = (v: Value): Value[] | undefined => (Array.isArray(v) ? v : v instanceof PyTuple ? v.items : undefined);
  const sa = seq(a);
  const sb = seq(b);
  if (sa && sb && Array.isArray(a) === Array.isArray(b)) {
    for (let i = 0; i < Math.min(sa.length, sb.length); i++) {
      if (!equal(sa[i]!, sb[i]!)) return compare(sa[i]!, sb[i]!, op);
    }
    return sa.length - sb.length;
  }
  throw err('TypeError', 'not-ordered', { op, left: typeName(a), right: typeName(b) }, `'${op}' not supported between instances of '${typeName(a)}' and '${typeName(b)}'`);
}

// ---------------------------------------------------------------- format()

/** Python's format(value, spec) for the common cases: width, alignment, fill, sign, 0-padding, `,`, precision and d/f/s/e/%/x/b. */
export function formatValue(v: Value, spec: string): string {
  if (spec === '') return str(v);
  const m = /^(?:(.)?([<>^=]))?([+\- ])?(#)?(0)?(\d+)?([,_])?(?:\.(\d+))?([bdeEfFgGnosxX%])?$/su.exec(spec);
  if (!m) throw err('ValueError', 'bad-format', { spec }, `Invalid format specifier '${spec}' for object of type '${typeName(v)}'`);
  const [, fillRaw, alignRaw, sign = '-', , zero, widthRaw, group, precRaw, typeRaw] = m;
  const width = widthRaw ? Number(widthRaw) : 0;
  const prec = precRaw === undefined ? undefined : Number(precRaw);
  let type: string | undefined = typeRaw;
  let fill = fillRaw ?? ' ';
  let align = alignRaw;
  let body: string;
  let negative = false;
  if (typeof v === 'string') {
    if (type && type !== 's') throw err('ValueError', 'bad-format', { spec }, `Unknown format code '${type}' for object of type 'str'`);
    body = prec === undefined ? v : v.slice(0, prec);
    align ??= '<';
  } else if (isNumeric(v)) {
    const n = toNumber(v);
    const isF = v instanceof PyFloat;
    if (!type) type = isF ? (prec === undefined ? undefined : 'g') : 'd';
    if (type === 'd' || type === 'x' || type === 'X' || type === 'b' || type === 'o') {
      if (isF) throw err('ValueError', 'bad-format', { spec }, `Unknown format code '${type}' for object of type 'float'`);
      negative = n < 0;
      const radix = { d: 10, x: 16, X: 16, b: 2, o: 8 }[type];
      body = Math.abs(n).toString(radix);
      if (type === 'X') body = body.toUpperCase();
    } else if (type === 'f' || type === 'F' || type === '%' || type === 'e' || type === 'E') {
      const x = type === '%' ? n * 100 : n;
      negative = x < 0 || Object.is(x, -0);
      const p = prec ?? 6;
      body = type === 'e' || type === 'E' ? expFormat(Math.abs(x), p, type === 'E') : Math.abs(x).toFixed(p);
      if (type === '%') body += '%';
    } else if (type === 'g') {
      negative = n < 0;
      body = String(Number(Math.abs(n).toPrecision(prec || 6)));
    } else {
      negative = n < 0 || Object.is(n, -0);
      body = isF ? floatRepr(Math.abs(n)) : String(Math.abs(n));
    }
    if (group && /^\d+/.test(body)) body = body.replace(/^\d+/, (d) => d.replace(/\B(?=(\d{3})+(?!\d))/g, group));
    const signStr = negative ? '-' : sign === '+' ? '+' : sign === ' ' ? ' ' : '';
    if (zero && !alignRaw) {
      fill = '0';
      align = '=';
    }
    align ??= '>';
    if (align === '=') return signStr + body.padStart(Math.max(0, width - signStr.length), fill);
    body = signStr + body;
  } else {
    if (type || width) throw err('TypeError', 'bad-format', { spec }, `unsupported format string passed to ${typeName(v)}.__format__`);
    body = str(v);
  }
  align ??= '<';
  const pad = Math.max(0, width - [...body].length);
  if (align === '<') return body + fill.repeat(pad);
  if (align === '>') return fill.repeat(pad) + body;
  const left = Math.floor(pad / 2);
  return fill.repeat(left) + body + fill.repeat(pad - left);
}

function expFormat(x: number, p: number, upper: boolean): string {
  const [m, e] = x.toExponential(p).split('e') as [string, string];
  const n = Number(e);
  const s = `${m}e${n < 0 ? '-' : '+'}${String(Math.abs(n)).padStart(2, '0')}`;
  return upper ? s.toUpperCase() : s;
}
