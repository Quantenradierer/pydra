/** Calendar days since 1970-01-01 of a local `YYYY-MM-DD` key (no time zones involved). */
export function dayNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** FNV-1a. */
function hash(text: string): number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** A small seeded generator (mulberry32): the same seed always gives the same numbers. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One snippet of the pool as the selection sees it. */
export interface PoolItem {
  topic: string;
  /** 0 = intro week (played once, in pool order, never again); 1 easy, 2 medium, 3 hard. */
  level: number;
}

/** First day of the intro week (the launch of the gentle start): the first snippet with level 0 is played on it. */
export const INTRO_START = '2026-11-06';

/**
 * One cycle through the regular pool: every snippet once, easy to hard (level 1,
 * then 2, then 3; seeded shuffle inside a level), arranged so that no two
 * neighbours (and not the first one after `previous`) share a topic. Always
 * possible while no topic has more than half of the pool; if the pool is too
 * lopsided the rule is dropped for the rest of the cycle. Indices into `items`.
 */
export function cycleOrder(items: readonly PoolItem[], cycle: number, previous?: string): number[] {
  const rng = seeded(hash(`pydra-daily-${cycle}`));
  const rest = items.map((_, i) => i);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [rest[i], rest[j]] = [rest[j]!, rest[i]!];
  }
  rest.sort((a, b) => items[a]!.level - items[b]!.level); // stable: the shuffle holds inside a level
  const topics = items.map((item) => item.topic);
  const order: number[] = [];
  let before = previous;
  // One level at a time, so a later level never comes first; the topic rule is kept inside and between levels.
  for (const level of [...new Set(rest.map((i) => items[i]!.level))]) {
    const group = rest.filter((i) => items[i]!.level === level);
    while (group.length > 0) {
      const counts = new Map<string, number>();
      for (const i of group) counts.set(topics[i]!, (counts.get(topics[i]!) ?? 0) + 1);
      // A topic that fills more than half of what is left has to go now, or it cannot be spread out.
      const urgent = [...counts].find(([topic, count]) => topic !== before && count * 2 > group.length)?.[0];
      let pos = group.findIndex((i) => (urgent === undefined ? topics[i] !== before : topics[i] === urgent));
      if (pos < 0) pos = 0;
      const [pick] = group.splice(pos, 1);
      order.push(pick!);
      before = topics[pick!];
    }
  }
  return order;
}

const orders = new Map<string, number[][]>();

/**
 * Which snippet of the pool is today's (index into `pool`).
 *
 * Intro week: the snippets with level 0 are played one per day, in pool order,
 * from INTRO_START on, and never again afterwards.
 *
 * After that the regular pool (levels 1 to 3) is played in cycles of its size,
 * the first one starting right after the intro week. Each cycle goes easy to
 * hard in another fixed shuffle, so nothing repeats before the pool is used
 * up and two days in a row (also across a cycle border and from the intro
 * week into the first cycle) never share a topic. Days before INTRO_START
 * use the same cycles backwards (no topic guarantee across their borders).
 *
 * Pure: the same day and pool always give the same answer, on every device.
 */
export function dailyIndex(day: string, pool: readonly PoolItem[]): number {
  if (pool.length === 0) throw new Error('The daily pool is empty.');
  const intro = pool.flatMap((item, i) => (item.level === 0 ? [i] : []));
  const regular = pool.flatMap((item, i) => (item.level === 0 ? [] : [i]));
  const offset = dayNumber(day) - dayNumber(INTRO_START);
  if (regular.length === 0) return intro[((offset % intro.length) + intro.length) % intro.length]!;
  if (offset >= 0 && offset < intro.length) return intro[offset]!;
  const items = regular.map((i) => pool[i]!);
  const size = items.length;
  const days = offset - intro.length; // days since the first regular day
  const cycle = Math.floor(days / size);
  const at = days - cycle * size;
  if (cycle < 0) return regular[cycleOrder(items, cycle)[at]!]!;
  const key = pool.map((item) => `${item.topic}:${item.level}`).join('|');
  let cache = orders.get(key);
  if (!cache) orders.set(key, (cache = []));
  // Cycles are built in order, each one knowing the topic the previous one ended on.
  for (let c = cache.length; c <= cycle; c++) {
    const before = cache.at(-1)?.at(-1);
    const previous = before === undefined ? pool[intro.at(-1) ?? -1]?.topic : items[before]!.topic;
    cache.push(cycleOrder(items, c, previous));
  }
  return regular[cache[cycle]![at]!]!;
}
