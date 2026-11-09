import { START_BUILD, type Build } from './build.ts';
import { runBattle, type BattleResult } from './battle.ts';
import type { EnemyData, Needs } from './content/types.ts';
import { SEED } from './content/types.ts';
import type { LayoutSpec } from './layout.ts';

/** Lines of code: blank lines and comment-only lines do not count. */
export const codeLines = (script: string): number => script.split('\n').filter((l) => l.trim() !== '' && !l.trim().startsWith('#')).length;

/** The one fight of an enemy: its map, its enemies and the seed. */
export function layoutOf(enemy: EnemyData): LayoutSpec {
  return { map: enemy.map, enemies: enemy.enemies, seed: SEED, ...(enemy.maxTicks ? { maxTicks: enemy.maxTicks } : {}) };
}

export interface FightReport {
  battle: BattleResult;
  /** Won: every enemy down and the extra conditions met. */
  won: boolean;
  /** Why not, when the enemy is down but a condition failed. */
  unmet?: 'say' | 'sayPrefix' | 'sayOnce' | 'damage' | 'waste' | 'uses' | 'without' | 'repeat';
}

export interface EnemyReport {
  fight: FightReport;
  /** The fight won and the script short enough. */
  won: boolean;
  tooLong: boolean;
  lines: number;
  /** HP lost in the fight. */
  damage: number;
}

/** The code without comments and string contents, for word and number checks. */
export function bareCode(script: string): string {
  return script
    .split('\n')
    .map((line) => line.replace(/"[^"]*"|'[^']*'/g, '""').replace(/#.*$/, ''))
    .join('\n');
}

export const usesWord = (script: string, word: string): boolean => new RegExp(`(^|[^A-Za-z0-9_])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')}($|[^A-Za-z0-9_])`).test(bareCode(script));

/** Whether some number literal is written more than once. */
export function repeatsNumber(script: string): boolean {
  const seen = new Set<string>();
  for (const m of bareCode(script).matchAll(/(?<![A-Za-z_0-9.])\d+(?:\.\d+)?/g)) {
    if (seen.has(m[0])) return true;
    seen.add(m[0]);
  }
  return false;
}

export function judge(battle: BattleResult, needs: Needs | undefined, script = ''): FightReport {
  if (battle.outcome !== 'win') return { battle, won: false };
  if (needs?.maxDamage !== undefined && battle.damageTaken > needs.maxDamage) return { battle, won: false, unmet: 'damage' };
  if (needs?.noWaste && battle.frames.some((f) => f.events.some((e) => e.type === 'shot' && e.by === 'player' && e.blocked))) return { battle, won: false, unmet: 'waste' };
  if (needs?.uses?.some((w) => !usesWord(script, w))) return { battle, won: false, unmet: 'uses' };
  if (needs?.without?.some((w) => usesWord(script, w))) return { battle, won: false, unmet: 'without' };
  if (needs?.noRepeatedNumber && repeatsNumber(script)) return { battle, won: false, unmet: 'repeat' };
  const said = battle.frames.flatMap((f) => f.bubbles.filter((b) => b.robot === 'player').map((b) => b.text));
  if (needs?.say && said.length === 0) return { battle, won: false, unmet: 'say' };
  const lowest = Math.min(...battle.frames.flatMap((f) => f.robots.filter((r) => r.id === 'player').map((r) => r.hp)));
  const needsPrefix = needs?.sayPrefix !== undefined && (needs.sayIfHpBelow === undefined || lowest < needs.sayIfHpBelow);
  if (needsPrefix && !said.some((t) => t.startsWith(needs!.sayPrefix!))) return { battle, won: false, unmet: 'sayPrefix' };
  if (needs?.sayOnce && said.filter((t) => t === needs.sayOnce).length !== 1) return { battle, won: false, unmet: 'sayOnce' };
  return { battle, won: true };
}

/** The fight of an enemy with the player's build and script, judged against the enemy's extra conditions. `trace` records the line-by-line trace for the viewer. */
export function fightEnemy(enemy: EnemyData, build: Build, script: string, trace = false): EnemyReport {
  const fight = judge(runBattle({ build, script, layout: layoutOf(enemy), ...(trace ? { trace } : {}) }), enemy.needs, script);
  const lines = codeLines(script);
  const tooLong = enemy.needs?.maxLines !== undefined && lines > enemy.needs.maxLines;
  return { fight, won: fight.won && !tooLong, tooLong, lines, damage: fight.battle.damageTaken };
}

/** The robot every battle must be winnable with: the starting build (light chassis, wheels, blaster and eyes). */
export const DEFAULT_BUILD: Build = START_BUILD;
