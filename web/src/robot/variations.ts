/**
 * The variation queue: after the first fight the robot meets every other
 * variation of the same enemy (its other layouts) and the earlier enemies of
 * the chapter that must still be won, one after another. This module builds
 * the queue and says, per fight, who won and why a loss happened.
 */
import type { Build } from './build.ts';
import type { EnemyData } from './content/types.ts';
import { fightLayout, layoutsOf, type FightReport } from './fight.ts';
import type { LayoutSpec } from './layout.ts';
import type { RbError } from './py/errors.ts';

export interface QueueItem {
  /** Stable id: `enemy-id#n`. */
  key: string;
  enemy: EnemyData;
  /** 1-based layout number of that enemy, and how many it has. */
  n: number;
  of: number;
  layout: LayoutSpec;
  /** An earlier enemy of the chapter, re-run for the current script. */
  regression: boolean;
}

/** The fights in play order: all layouts of the enemy, then all layouts of each earlier enemy. */
export function buildQueue(enemy: EnemyData, earlier: readonly EnemyData[], all: readonly EnemyData[]): QueueItem[] {
  const items: QueueItem[] = [];
  for (const [e, regression] of [[enemy, false] as const, ...earlier.map((x) => [x, true] as const)]) {
    const layouts = layoutsOf(e, all);
    layouts.forEach((layout, i) => items.push({ key: `${e.id}#${i + 1}`, enemy: e, n: i + 1, of: layouts.length, layout, regression }));
  }
  return items;
}

export type LossReason =
  | { code: 'error'; line: number; error: RbError }
  | { code: 'budget'; line: number }
  | { code: 'dead' }
  | { code: 'timeout' }
  | { code: 'unmet'; unmet: NonNullable<FightReport['unmet']> };

/** Why a fight was not won (undefined when it was). */
export function lossReason(f: FightReport): LossReason | undefined {
  if (f.won) return undefined;
  const b = f.battle;
  if (f.unmet) return { code: 'unmet', unmet: f.unmet };
  if (b.reason === 'error' && b.error) return { code: 'error', line: b.error.line, error: b.error };
  if (b.reason === 'budget') return { code: 'budget', line: b.budgetLine ?? 0 };
  if (b.reason === 'dead') return { code: 'dead' };
  return { code: 'timeout' };
}

export interface QueueOutcome {
  item: QueueItem;
  won: boolean;
  reason: LossReason | undefined;
  /** Ticks the fight lasted and HP the player lost. */
  ticks: number;
  damage: number;
}

/** Plays one queue item. `trace` records the line-by-line trace the viewer needs. */
export function playItem(item: QueueItem, build: Build, script: string, trace = false): FightReport {
  return fightLayout(item.enemy, item.layout, build, script, item.regression, trace);
}

export function outcomeOf(item: QueueItem, report: FightReport): QueueOutcome {
  return { item, won: report.won, reason: lossReason(report), ticks: report.battle.frames.length - 1, damage: report.battle.damageTaken };
}

/** The result of every fight of the queue, without traces (fast). */
export function evaluateQueue(items: readonly QueueItem[], build: Build, script: string): QueueOutcome[] {
  return items.map((item) => outcomeOf(item, playItem(item, build, script)));
}
