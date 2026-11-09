/**
 * Training Grounds: endless fights generated from a seed, using only the
 * concepts the player has unlocked (the frame of the latest chapter, with
 * random numbers and positions). A daily fight uses a seed made from the date.
 * Every fight carries a script that wins it, so the generator is testable.
 */
import { ENEMIES } from './content/index.ts';
import { FINAL_SCRIPT } from './content/proving2.ts';
import { mk, T, wallCol } from './content/helpers.ts';
import type { EnemyData } from './content/types.ts';
import type { EnemyDef } from './layout.ts';
import { Rng } from './rng.ts';

/** Training opens with Chapter 2's loops. */
export const TRAINING_FROM = 2;

export interface TrainingFight {
  enemy: EnemyData;
  /** A script that wins it with the default build. */
  solution: string;
}

const SHIELD_SCRIPT = 'while True:\n    shield.activate()\n    wait()';
const SNIPER_SCRIPT = 'while True:\n    fire()';
const LOOK_AROUND =
  'for i in range(30):\n    if see_right() == "enemy":\n        turn_right()\n    elif see_left() == "enemy":\n        turn_left()\n    elif see() == "enemy":\n        if enemy_shielded():\n            wait()\n        else:\n            fire()';

/** A seed for the fight of a day: the same for everybody on that date. */
export function dailySeed(date: string): number {
  let h = 2166136261;
  for (const ch of date) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) % 1_000_000;
}

const dateOf = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const today = dateOf;

/** A short description in both languages, for the catch line. */
interface Words {
  de: string;
  en: string;
}

function loops(rng: Rng): Omit<TrainingFight, 'enemy'> & { enemies: EnemyDef[]; map: string[]; text: Words } {
  // A column of dummies ahead (3 steps blocked by the first), maybe a tough one to the right.
  const ahead = rng.between(2, 5);
  const hps: number[] = [];
  let total = 0;
  for (let i = 0; i < ahead; i++) {
    const hp = Math.min(rng.between(1, 3), 12 - total - (ahead - i - 1));
    hps.push(Math.max(1, hp));
    total += Math.max(1, hp);
  }
  const right = rng.chance(0.6) ? rng.between(3, 12) : 0;
  const shots = Math.max(total, right);
  const enemies: EnemyDef[] = hps.map((hp) => ({ hp }));
  const items: [string, number, number][] = hps.map((_, i) => [i === 0 ? 'D' : String(i + 1), 3, 5 - i]);
  const walls = right > 0 ? [...wallCol(2, 0, 8), ...wallCol(4, 0, 5), ...wallCol(4, 7, 8)] : [...wallCol(2, 0, 8), ...wallCol(4, 0, 8)];
  if (right > 0) {
    enemies.push({ hp: right });
    items.push([String(enemies.length), rng.chance(0.5) ? 7 : 6, 6]);
  }
  const map = mk(8, 10, ['^', 3, 9], ...walls, ...items);
  const sideCode = right > 0 ? `turn_right()\nfor i in range(shots):\n    fire()\n` : '';
  const solution = `shots = ${shots}\nforward(4)\nfor i in range(shots):\n    fire()\n${sideCode}`.trimEnd();
  return {
    enemies,
    map,
    solution,
    text: right > 0 ? { de: `${ahead} Attrappen vorn, ein zäher Gegner rechts`, en: `${ahead} dummies ahead, a tough one on the right` } : { de: `${ahead} Attrappen in einer Reihe`, en: `${ahead} dummies in a row` },
  };
}

const DECISION_WORDS: Record<'plain' | 'shield' | 'sniper', Words> = {
  plain: { de: 'ein Gegner, der mal links, mal rechts, mal vorn steht', en: 'one enemy that stands left, right or ahead' },
  shield: { de: 'ein Gegner mit Schild', en: 'an enemy with a shield' },
  sniper: { de: 'ein Scharfschütze', en: 'a sniper' },
};

function decisions(rng: Rng): Omit<TrainingFight, 'enemy'> & { enemies: EnemyDef[]; map: string[]; text: Words } {
  const arena = (...items: [string, number, number][]) => mk(9, 8, ['^', 4, 6], ...items);
  const kind = rng.pick(['plain', 'shield', 'sniper'] as const);
  const hp = kind === 'sniper' ? rng.between(3, 6) : rng.between(2, 4);
  const def: EnemyDef = kind === 'shield' ? { hp, gear: ['shield'], script: SHIELD_SCRIPT } : kind === 'sniper' ? { hp, script: SNIPER_SCRIPT } : { hp };
  const place = rng.pick([
    ['D', 4, rng.between(1, 3)],
    ['D', rng.between(7, 8), 6],
    ['D', rng.between(0, 1), 6],
  ] as [string, number, number][]);
  return { enemies: [def], map: arena(place), solution: LOOK_AROUND, text: DECISION_WORDS[kind] };
}

function walking(rng: Rng): Omit<TrainingFight, 'enemy'> & { enemies: EnemyDef[]; map: string[]; text: Words } {
  const pickFrom = (id: string) => ENEMIES.find((e) => e.id === id)!;
  if (rng.chance(0.5)) {
    const regen = rng.chance(0.4);
    const hp = regen ? rng.between(4, 6) : rng.between(2, 4);
    const y = rng.between(0, 6);
    return {
      enemies: [{ hp, ...(regen ? { regen: { every: 2, amount: 1 } } : {}) }],
      map: mk(8, 14, ['^', 3, 12], ['D', 3, y]),
      solution: 'while alive():\n    if see() == "enemy":\n        fire()\n    elif see() == "wall" and distance() == 1:\n        turn_right()\n    else:\n        forward()',
      text: regen ? { de: 'ein Gegner, der sich heilt', en: 'an enemy that heals itself' } : { de: 'ein weit entfernter Gegner', en: 'a far-away enemy' },
    };
  }
  const src = pickFrom('maze-runner');
  return { enemies: src.enemies, map: src.map, solution: FINAL_SCRIPT, text: { de: 'ein Gegner, der seitlich steht', en: 'an enemy to the side' } };
}

/** The fight of a seed for a player whose latest unlocked chapter is `level` (2-4). */
export function trainingFight(seed: number, level: number, id = `training-${seed}`): TrainingFight {
  const rng = new Rng(seed * 7919 + level);
  const l = Math.min(4, Math.max(TRAINING_FROM, level));
  const g = l === 2 ? loops(rng) : l === 3 ? decisions(rng) : walking(rng);
  const enemy: EnemyData = {
    id,
    chapter: l,
    title: T(`Training Nr. ${seed}`, `Training #${seed}`),
    catchLine: T(`Zufall: ${g.text.de}.`, `Random: ${g.text.en}.`),
    enemies: g.enemies,
    map: g.map,
    solution: g.solution,
    breaks: false,
    par: g.solution.split('\n').length,
  };
  return { enemy, solution: g.solution };
}
