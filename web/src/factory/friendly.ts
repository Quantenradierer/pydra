/**
 * Hydra Works problems as sentences for a beginner, with the line ("(line 4)",
 * or "(line 4 in "Your machines")" for the block lessons' prelude). Python errors
 * go through Robot Battler's friendly texts; the few that name the robot are
 * replaced by factory wordings.
 */
import { MESSAGES, translate, type Lang, type MessageKey } from '../i18n.ts';
import { friendlyError } from '../robot/friendly.ts';
import { lineRef, type Order, type Problem } from './run.ts';
import type { IdleReason, Item, WorldSnapshot } from './world.ts';

const hasKey = (key: string): key is MessageKey => key in MESSAGES.de;

/** "line 4" or "line 4 in "Your machines"". */
export function whereText(line: number, lang: Lang): string {
  const ref = lineRef(line);
  return translate(lang, ref.part === 'own' ? 'factory.where.own' : 'factory.where.machines', { line: ref.line });
}

/** Adds "(line 4)" before the closing period (or after a question). */
function withWhere(text: string, line: number, lang: Lang): string {
  if (!line) return text;
  const where = whereText(line, lang);
  return text.endsWith('.') ? `${text.slice(0, -1)} (${where}).` : `${text} (${where})`;
}

function pythonText(p: Extract<Problem, { kind: 'python' }>, lang: Lang): string {
  const e = p.error;
  const base = e.code === 'not-equipped' ? 'factory.py.not-equipped' : `factory.py.${e.code}`;
  const text = withWhere(hasKey(base) ? translate(lang, base, e.params) : friendlyError(e, lang), e.line, lang);
  // The line belongs to the sentence that names the mistake; "Did you mean …?" comes after it.
  const hint = `${base}-hint`;
  return e.params.suggestion !== undefined && hasKey(hint) ? `${text} ${translate(lang, hint, e.params)}` : text;
}

/** `def-params` with 0, 1 or more parameters. */
function checkKey(p: Extract<Problem, { kind: 'check' }>): MessageKey {
  const key = `factory.check.${p.code}`;
  if (p.code === 'def-params') {
    const suffix = p.params.count === 0 ? '-none' : p.params.count === 1 ? '-one' : '';
    if (hasKey(key + suffix)) return (key + suffix) as MessageKey;
  }
  return key as MessageKey;
}

/** The whole sentence for a problem, line included. */
export function problemText(p: Problem, lang: Lang): string {
  switch (p.kind) {
    case 'python':
      return pythonText(p, lang);
    case 'world': {
      const key = p.code === 'nothing-there' ? `factory.err.nothing-there.${p.params.place === 'floor' ? 'floor' : 'belt'}` : `factory.err.${p.code}`;
      return translate(lang, key as MessageKey, { ...p.params, where: whereText(p.line, lang) });
    }
    case 'read-only':
      return translate(lang, p.name === 'n' ? 'factory.err.read-only-n' : 'factory.err.read-only', { name: p.name, where: whereText(p.line, lang) });
    case 'reserved': {
      const key = p.from === 'factory' || p.from === 'machines' ? `factory.err.reserved.${p.from}` : 'factory.err.reserved.lesson';
      return translate(lang, key as MessageKey, { name: p.name, lesson: p.from, where: whereText(p.line, lang) });
    }
    case 'machines-only':
      return translate(lang, 'factory.err.machines-only', { name: p.name, where: whereText(p.line, lang) });
    case 'budget':
      return translate(lang, 'factory.err.loop-budget', { where: whereText(p.line, lang) });
    case 'too-long':
      return translate(lang, 'factory.err.too-long', { where: whereText(p.line, lang) });
    case 'check': {
      const params: Record<string, string | number> = { ...p.params };
      if (typeof params.line === 'number') params.where = whereText(params.line, lang);
      return translate(lang, checkKey(p), params);
    }
  }
}

/** What wasted motion looks like, for the viewer's caption. */
export function idleText(reason: IdleReason, lang: Lang): string {
  return translate(lang, `factory.idle.${reason}`);
}

export function itemText(item: Item, lang: Lang): string {
  return translate(lang, `factory.item.${item}`);
}

/** "Order: 2 ore in the smelter, 1 coal in the bunker" / "Order: 3 plates". */
export function orderText(order: Order, lang: Lang, n = 0): string {
  const parts: string[] = [];
  if (order.ore !== undefined) parts.push(translate(lang, 'factory.order.ore', { n: order.ore }));
  if (order.coal !== undefined) parts.push(translate(lang, 'factory.order.coal', { n: order.coal }));
  if (order.plates !== undefined) {
    const count = order.plates === 'n' ? n : order.plates;
    parts.push(translate(lang, count === 1 ? 'factory.order.plates.one' : 'factory.order.plates.other', { n: count }));
  }
  return translate(lang, 'factory.order', { what: parts.join(', ') });
}

/** What the order sign asks for, as the belt's final block has it (`n` is the belt's n). */
export const orderPlates = (order: Order, n = 0): number | undefined => (order.plates === 'n' ? n : order.plates);

/**
 * One concrete reason why the order is not met after the program finished without an error: the items still on
 * the belt, else the heap or plate count that is short. Undefined when the block already meets the order.
 */
export function orderHint(order: Order, final: WorldSnapshot, n: number, lang: Lang): string | undefined {
  const left = new Map<Item, number>();
  for (const b of final.belt) left.set(b.kind, (left.get(b.kind) ?? 0) + 1);
  if (final.belt.length > 0) {
    const what = [...left].map(([kind, count]) => translate(lang, 'factory.hint.count', { n: count, item: itemText(kind, lang) })).join(', ');
    return translate(lang, 'factory.hint.belt-left', { what });
  }
  if (order.ore !== undefined && final.ore !== order.ore) return translate(lang, 'factory.hint.ore', { have: final.ore, need: order.ore });
  if (order.coal !== undefined && final.coal !== order.coal) return translate(lang, 'factory.hint.coal', { have: final.coal, need: order.coal });
  const plates = orderPlates(order, n);
  const plateWord = (k: number) => translate(lang, k === 1 ? 'factory.order.plates.one' : 'factory.order.plates.other', { n: k });
  if (plates !== undefined && final.plates !== plates) return translate(lang, 'factory.hint.plates', { have: plateWord(final.plates), need: plateWord(plates) });
  return undefined;
}
