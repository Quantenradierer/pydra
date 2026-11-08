import { RbError } from './errors.ts';
import {
  compare, equal, floatRepr, formatValue, isFloat, isInt, isNumeric, keyOf, PyDict, PyFloat, PyRange, PyTuple, repr, str, toNumber, truthy, typeName,
  type Builtin, type Value,
} from './values.ts';

/** Errors raised here have no line yet; the evaluator adds it. */
const fail = (type: ConstructorParameters<typeof RbError>[0], code: string, params: Record<string, string | number>, detail: string): never => {
  throw new RbError(type, code, params, 0, detail);
};

/** The items of an iterable value, as a fresh array. */
export function toArray(v: Value): Value[] {
  if (Array.isArray(v)) return [...v];
  if (v instanceof PyTuple) return [...v.items];
  if (typeof v === 'string') return [...v];
  if (v instanceof PyDict) return [...v.map.values()].map(([k]) => k);
  if (v instanceof PyRange) return Array.from({ length: v.length }, (_, i) => v.at(i));
  return fail('TypeError', 'not-iterable', { type: typeName(v) }, `'${typeName(v)}' object is not iterable`);
}

const intArg = (v: Value, what: string): number => {
  if (isInt(v)) return Number(v);
  return fail('TypeError', 'not-integer', { type: typeName(v), what }, `'${typeName(v)}' object cannot be interpreted as an integer`);
};

function roundHalfEven(x: number): number {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

function parseInt10(s: string): number {
  const m = /^\s*([+-]?)(\d+(?:_\d+)*)\s*$/.exec(s);
  if (!m) return fail('ValueError', 'bad-int', { text: s }, `invalid literal for int() with base 10: ${repr(s)}`);
  return Number(m[1] + m[2]!.replace(/_/g, ''));
}

function parseFloatStr(s: string): number {
  const t = s.trim().toLowerCase();
  if (/^[+-]?(inf|infinity)$/.test(t)) return t.startsWith('-') ? -Infinity : Infinity;
  if (/^[+-]?nan$/.test(t)) return NaN;
  if (!/^[+-]?(\d+(_\d+)*\.?(\d+(_\d+)*)?|\.\d+(_\d+)*)(e[+-]?\d+)?$/.test(t)) {
    return fail('ValueError', 'bad-float', { text: s }, `could not convert string to float: ${repr(s)}`);
  }
  return Number(t.replace(/_/g, ''));
}

const builtin = (name: string, call: Builtin['call']): Builtin => ({ kind: 'builtin', name, call });

function argc(name: string, args: Value[], min: number, max = min): void {
  if (args.length < min || args.length > max) {
    const takes = min === max ? `exactly ${min}` : max === Infinity ? `at least ${min}` : `from ${min} to ${max}`;
    fail('TypeError', 'arg-count', { name, expected: min === max ? String(min) : `${min}-${max}`, given: args.length }, `${name}() takes ${takes} argument${max === 1 ? '' : 's'} (${args.length} given)`);
  }
}

function sortValues(items: Value[], reverse: boolean): Value[] {
  const out = items.map((v, i) => ({ v, i }));
  out.sort((a, b) => {
    const c = compare(a.v, b.v, '<');
    return (reverse ? -c : c) || a.i - b.i;
  });
  return out.map((x) => x.v);
}

export const BUILTINS: Builtin[] = [
  builtin('len', (args) => {
    argc('len', args, 1);
    const v = args[0]!;
    if (typeof v === 'string' || Array.isArray(v)) return v.length;
    if (v instanceof PyTuple) return v.items.length;
    if (v instanceof PyDict) return v.map.size;
    if (v instanceof PyRange) return v.length;
    return fail('TypeError', 'no-len', { type: typeName(v) }, `object of type '${typeName(v)}' has no len()`);
  }),
  builtin('range', (args) => {
    argc('range', args, 1, 3);
    const n = args.map((a) => intArg(a, 'range'));
    const [start, stop, step] = n.length === 1 ? [0, n[0]!, 1] : [n[0]!, n[1]!, n[2] ?? 1];
    if (step === 0) fail('ValueError', 'range-step', {}, 'range() arg 3 must not be zero');
    return new PyRange(start, stop, step);
  }),
  builtin('int', (args) => {
    argc('int', args, 0, 1);
    const v = args[0] ?? 0;
    if (typeof v === 'string') return parseInt10(v);
    if (isFloat(v)) {
      if (!Number.isFinite(v.v)) fail('ValueError', 'bad-int-float', {}, `cannot convert float ${floatRepr(v.v)} to integer`);
      return Math.trunc(v.v);
    }
    if (isInt(v)) return Number(v);
    return fail('TypeError', 'bad-int', { type: typeName(v) }, `int() argument must be a string, a bytes-like object or a real number, not '${typeName(v)}'`);
  }),
  builtin('float', (args) => {
    argc('float', args, 0, 1);
    const v = args[0] ?? 0;
    if (typeof v === 'string') return new PyFloat(parseFloatStr(v));
    if (isNumeric(v)) return new PyFloat(toNumber(v));
    return fail('TypeError', 'bad-float-type', { type: typeName(v) }, `float() argument must be a string or a real number, not '${typeName(v)}'`);
  }),
  builtin('str', (args) => {
    argc('str', args, 0, 1);
    return args.length === 0 ? '' : str(args[0]!);
  }),
  builtin('repr', (args) => {
    argc('repr', args, 1);
    return repr(args[0]!);
  }),
  builtin('bool', (args) => {
    argc('bool', args, 0, 1);
    return args.length === 0 ? false : truthy(args[0]!);
  }),
  builtin('abs', (args) => {
    argc('abs', args, 1);
    const v = args[0]!;
    if (isFloat(v)) return new PyFloat(Math.abs(v.v));
    if (isInt(v)) return Math.abs(Number(v));
    return fail('TypeError', 'bad-operand-unary', { op: 'abs()', type: typeName(v) }, `bad operand type for abs(): '${typeName(v)}'`);
  }),
  ...(['min', 'max'] as const).map((name) =>
    builtin(name, (args) => {
      const items = args.length === 1 ? toArray(args[0]!) : args;
      if (args.length === 0) fail('TypeError', 'arg-count', { name, expected: '1+', given: 0 }, `${name} expected at least 1 argument, got 0`);
      if (items.length === 0) fail('ValueError', 'empty-seq', { name }, `${name}() iterable argument is empty`);
      let best: Value = items[0]!;
      for (const x of items.slice(1)) if (name === 'min' ? compare(x, best, '<') < 0 : compare(x, best, '>') > 0) best = x;
      return best;
    }),
  ),
  builtin('sum', (args) => {
    argc('sum', args, 1, 2);
    let total: Value = args[1] ?? 0;
    for (const x of toArray(args[0]!)) {
      if (!isNumeric(x) || total === null || !isNumeric(total)) {
        return fail('TypeError', 'bad-operand', { op: '+', left: typeName(total), right: typeName(x) }, `unsupported operand type(s) for +: '${typeName(total)}' and '${typeName(x)}'`);
      }
      const sum: number = toNumber(total) + toNumber(x);
      total = isFloat(total) || isFloat(x) ? new PyFloat(sum) : sum;
    }
    return total;
  }),
  builtin('sorted', (args, kwargs) => {
    argc('sorted', args, 1);
    return sortValues(toArray(args[0]!), truthy(kwargs.reverse ?? false));
  }),
  builtin('reversed', (args) => {
    argc('reversed', args, 1);
    return toArray(args[0]!).reverse();
  }),
  builtin('enumerate', (args, kwargs) => {
    argc('enumerate', args, 1, 2);
    const start = args[1] !== undefined ? intArg(args[1], 'enumerate') : kwargs.start !== undefined ? intArg(kwargs.start, 'enumerate') : 0;
    return toArray(args[0]!).map((v, i) => new PyTuple([i + start, v]));
  }),
  builtin('zip', (args) => {
    const lists = args.map(toArray);
    const n = lists.length === 0 ? 0 : Math.min(...lists.map((l) => l.length));
    return Array.from({ length: n }, (_, i) => new PyTuple(lists.map((l) => l[i]!)));
  }),
  builtin('list', (args) => {
    argc('list', args, 0, 1);
    return args.length === 0 ? [] : toArray(args[0]!);
  }),
  builtin('tuple', (args) => {
    argc('tuple', args, 0, 1);
    return new PyTuple(args.length === 0 ? [] : toArray(args[0]!));
  }),
  builtin('dict', (args) => {
    argc('dict', args, 0, 1);
    const d = new PyDict();
    if (args[0] !== undefined) {
      for (const pair of toArray(args[0])) {
        const kv = toArray(pair);
        if (kv.length !== 2) fail('ValueError', 'dict-pair', {}, 'dictionary update sequence element has the wrong length');
        d.set(kv[0]!, kv[1]!);
      }
    }
    return d;
  }),
  builtin('round', (args) => {
    argc('round', args, 1, 2);
    const v = args[0]!;
    if (!isNumeric(v)) return fail('TypeError', 'bad-round', { type: typeName(v) }, `type ${typeName(v)} doesn't define __round__ method`);
    const digits = args[1] === undefined || args[1] === null ? undefined : intArg(args[1], 'round');
    if (digits === undefined) {
      if (isFloat(v) && !Number.isFinite(v.v)) fail('ValueError', 'bad-int-float', {}, `cannot convert float ${floatRepr(v.v)} to integer`);
      return roundHalfEven(toNumber(v));
    }
    if (!isFloat(v)) {
      const f = 10 ** -digits;
      return digits >= 0 ? Number(v) : roundHalfEven(Number(v) / f) * f;
    }
    return new PyFloat(Number(v.v.toFixed(Math.max(0, Math.min(100, digits)))));
  }),
  builtin('any', (args) => {
    argc('any', args, 1);
    return toArray(args[0]!).some(truthy);
  }),
  builtin('all', (args) => {
    argc('all', args, 1);
    return toArray(args[0]!).every(truthy);
  }),
  builtin('ord', (args) => {
    argc('ord', args, 1);
    const s = args[0]!;
    if (typeof s !== 'string' || [...s].length !== 1) return fail('TypeError', 'bad-ord', {}, 'ord() expected a character');
    return s.codePointAt(0)!;
  }),
  builtin('chr', (args) => {
    argc('chr', args, 1);
    return String.fromCodePoint(intArg(args[0]!, 'chr'));
  }),
];

// ---------------------------------------------------------------- methods

type Method = (self: any, args: Value[], kwargs: Record<string, Value>) => Value;

const strArg = (v: Value, method: string): string =>
  typeof v === 'string' ? v : fail('TypeError', 'str-arg', { method, type: typeName(v) }, `${method}() argument must be str, not ${typeName(v)}`);

const STR_METHODS: Record<string, Method> = {
  upper: (s: string) => s.toUpperCase(),
  lower: (s: string) => s.toLowerCase(),
  capitalize: (s: string) => (s.length ? s[0]!.toUpperCase() + s.slice(1).toLowerCase() : s),
  title: (s: string) => s.toLowerCase().replace(/(^|[^a-z0-9])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase()),
  strip: (s: string, a) => (a[0] === undefined || a[0] === null ? s.trim() : trimChars(s, strArg(a[0], 'strip'), true, true)),
  lstrip: (s: string, a) => (a[0] === undefined || a[0] === null ? s.trimStart() : trimChars(s, strArg(a[0], 'lstrip'), true, false)),
  rstrip: (s: string, a) => (a[0] === undefined || a[0] === null ? s.trimEnd() : trimChars(s, strArg(a[0], 'rstrip'), false, true)),
  split: (s: string, a, k) => {
    const sep = a[0] ?? k.sep ?? null;
    const max = a[1] !== undefined ? intArg(a[1], 'split') : k.maxsplit !== undefined ? intArg(k.maxsplit, 'split') : -1;
    if (sep === null) {
      const parts = s.trim() === '' ? [] : s.trim().split(/\s+/);
      if (max >= 0 && parts.length > max + 1) {
        const head = parts.slice(0, max);
        const rest = s.trimStart().replace(new RegExp(`^(?:\\S+\\s+){${max}}`), '');
        return [...head, rest.trimEnd() === rest ? rest : rest.trimEnd()];
      }
      return parts;
    }
    const sp = strArg(sep, 'split');
    if (sp === '') return fail('ValueError', 'empty-sep', {}, 'empty separator');
    const parts = s.split(sp);
    if (max >= 0 && parts.length > max + 1) return [...parts.slice(0, max), parts.slice(max).join(sp)];
    return parts;
  },
  join: (s: string, a) => {
    const items = toArray(a[0]!);
    const bad = items.findIndex((x) => typeof x !== 'string');
    if (bad >= 0) fail('TypeError', 'join-type', { index: bad, type: typeName(items[bad]!) }, `sequence item ${bad}: expected str instance, ${typeName(items[bad]!)} found`);
    return items.join(s);
  },
  replace: (s: string, a) => {
    const [old, rep] = [strArg(a[0]!, 'replace'), strArg(a[1]!, 'replace')];
    const count = a[2] === undefined ? -1 : intArg(a[2], 'replace');
    if (count < 0) return old === '' ? [...s].reduce((acc, ch) => acc + rep + ch, '') + rep : s.split(old).join(rep);
    let out = '';
    let rest = s;
    for (let i = 0; i < count; i++) {
      const at = rest.indexOf(old);
      if (at < 0) break;
      out += rest.slice(0, at) + rep;
      rest = rest.slice(at + old.length);
    }
    return out + rest;
  },
  startswith: (s: string, a) => (a[0] instanceof PyTuple ? a[0].items.some((p) => s.startsWith(strArg(p, 'startswith'))) : s.startsWith(strArg(a[0]!, 'startswith'))),
  endswith: (s: string, a) => (a[0] instanceof PyTuple ? a[0].items.some((p) => s.endsWith(strArg(p, 'endswith'))) : s.endsWith(strArg(a[0]!, 'endswith'))),
  find: (s: string, a) => s.indexOf(strArg(a[0]!, 'find')),
  index: (s: string, a) => {
    const i = s.indexOf(strArg(a[0]!, 'index'));
    return i < 0 ? fail('ValueError', 'substring-not-found', {}, 'substring not found') : i;
  },
  count: (s: string, a) => {
    const sub = strArg(a[0]!, 'count');
    return sub === '' ? s.length + 1 : s.split(sub).length - 1;
  },
  isdigit: (s: string) => /^[0-9]+$/.test(s),
  isalpha: (s: string) => /^\p{L}+$/u.test(s),
  isalnum: (s: string) => /^[\p{L}0-9]+$/u.test(s),
  isspace: (s: string) => /^\s+$/.test(s),
  isupper: (s: string) => s !== s.toLowerCase() && s === s.toUpperCase(),
  islower: (s: string) => s !== s.toUpperCase() && s === s.toLowerCase(),
  zfill: (s: string, a) => {
    const w = intArg(a[0]!, 'zfill');
    const sign = /^[+-]/.test(s) ? s[0]! : '';
    return sign + s.slice(sign.length).padStart(w - sign.length, '0');
  },
  ljust: (s: string, a) => s.padEnd(intArg(a[0]!, 'ljust'), a[1] === undefined ? ' ' : strArg(a[1], 'ljust')),
  rjust: (s: string, a) => s.padStart(intArg(a[0]!, 'rjust'), a[1] === undefined ? ' ' : strArg(a[1], 'rjust')),
  center: (s: string, a) => formatValue(s, `${a[1] === undefined ? '' : strArg(a[1], 'center')}^${intArg(a[0]!, 'center')}`),
};

function trimChars(s: string, chars: string, left: boolean, right: boolean): string {
  let a = 0;
  let b = s.length;
  if (left) while (a < b && chars.includes(s[a]!)) a++;
  if (right) while (b > a && chars.includes(s[b - 1]!)) b--;
  return s.slice(a, b);
}

const LIST_METHODS: Record<string, Method> = {
  append: (l: Value[], a) => {
    argc('append', a, 1);
    l.push(a[0]!);
    return null;
  },
  extend: (l: Value[], a) => {
    argc('extend', a, 1);
    l.push(...toArray(a[0]!));
    return null;
  },
  insert: (l: Value[], a) => {
    argc('insert', a, 2);
    let i = intArg(a[0]!, 'insert');
    if (i < 0) i = Math.max(0, l.length + i);
    l.splice(Math.min(i, l.length), 0, a[1]!);
    return null;
  },
  pop: (l: Value[], a) => {
    if (l.length === 0) return fail('IndexError', 'pop-empty', {}, 'pop from empty list');
    let i = a[0] === undefined ? l.length - 1 : intArg(a[0], 'pop');
    if (i < 0) i += l.length;
    if (i < 0 || i >= l.length) return fail('IndexError', 'pop-range', {}, 'pop index out of range');
    return l.splice(i, 1)[0]!;
  },
  remove: (l: Value[], a) => {
    const i = l.findIndex((x) => equal(x, a[0]!));
    if (i < 0) return fail('ValueError', 'not-in-list', { value: repr(a[0]!) }, 'list.remove(x): x not in list');
    l.splice(i, 1);
    return null;
  },
  index: (l: Value[], a) => {
    const i = l.findIndex((x) => equal(x, a[0]!));
    return i < 0 ? fail('ValueError', 'not-in-list', { value: repr(a[0]!) }, `${repr(a[0]!)} is not in list`) : i;
  },
  count: (l: Value[], a) => l.filter((x) => equal(x, a[0]!)).length,
  sort: (l: Value[], _a, k) => {
    const sorted = sortValues(l, truthy(k.reverse ?? false));
    l.splice(0, l.length, ...sorted);
    return null;
  },
  reverse: (l: Value[]) => {
    l.reverse();
    return null;
  },
  copy: (l: Value[]) => [...l],
  clear: (l: Value[]) => {
    l.length = 0;
    return null;
  },
};

const TUPLE_METHODS: Record<string, Method> = {
  index: (t: PyTuple, a) => {
    const i = t.items.findIndex((x) => equal(x, a[0]!));
    return i < 0 ? fail('ValueError', 'not-in-list', { value: repr(a[0]!) }, 'tuple.index(x): x not in tuple') : i;
  },
  count: (t: PyTuple, a) => t.items.filter((x) => equal(x, a[0]!)).length,
};

const DICT_METHODS: Record<string, Method> = {
  get: (d: PyDict, a) => {
    argc('get', a, 1, 2);
    return d.get(a[0]!) ?? a[1] ?? null;
  },
  keys: (d: PyDict) => [...d.map.values()].map(([k]) => k),
  values: (d: PyDict) => [...d.map.values()].map(([, v]) => v),
  items: (d: PyDict) => [...d.map.values()].map(([k, v]) => new PyTuple([k, v])),
  pop: (d: PyDict, a) => {
    argc('pop', a, 1, 2);
    const k = keyOf(a[0]!);
    const entry = d.map.get(k);
    if (!entry) {
      if (a.length === 2) return a[1]!;
      return fail('KeyError', 'key', { key: repr(a[0]!) }, repr(a[0]!));
    }
    d.map.delete(k);
    return entry[1];
  },
  update: (d: PyDict, a) => {
    const other = a[0];
    if (other instanceof PyDict) for (const [k, v] of other.map.values()) d.set(k, v);
    return null;
  },
  setdefault: (d: PyDict, a) => {
    const old = d.get(a[0]!);
    if (old !== undefined) return old;
    d.set(a[0]!, a[1] ?? null);
    return a[1] ?? null;
  },
  copy: (d: PyDict) => {
    const c = new PyDict();
    for (const [k, v] of d.map.values()) c.set(k, v);
    return c;
  },
  clear: (d: PyDict) => {
    d.map.clear();
    return null;
  },
};

function methodTable(self: Value): Record<string, Method> | undefined {
  if (typeof self === 'string') return STR_METHODS;
  if (Array.isArray(self)) return LIST_METHODS;
  if (self instanceof PyTuple) return TUPLE_METHODS;
  if (self instanceof PyDict) return DICT_METHODS;
  return undefined;
}

export function methodNames(self: Value): string[] {
  return Object.keys(methodTable(self) ?? {});
}

export function hasMethod(self: Value, name: string): boolean {
  return Object.prototype.hasOwnProperty.call(methodTable(self) ?? {}, name);
}

export function callMethod(self: Value, name: string, args: Value[], kwargs: Record<string, Value>): Value {
  return methodTable(self)![name]!(self, args, kwargs);
}
