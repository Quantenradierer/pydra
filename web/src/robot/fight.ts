import { START_BUILD, type Build } from './build.ts';
import { runBattle, type BattleResult } from './battle.ts';
import type { EnemyData, Needs } from './content/types.ts';
import { SEEDS } from './content/types.ts';
import type { LayoutSpec } from './layout.ts';

/** Lines of code: blank lines and comment-only lines do not count. */
export const codeLines = (script: string): number => script.split('\n').filter((l) => l.trim() !== '' && !l.trim().startsWith('#')).length;

export function layoutsOf(enemy: EnemyData, all: readonly EnemyData[]): LayoutSpec[] {
  const pick = (id: string) => all.find((e) => e.id === id)!;
  const out: LayoutSpec[] = [];
  const add = (src: EnemyData, i: number, k: number) =>
    out.push({ map: src.maps[i]!, enemies: src.enemies, seed: SEEDS[(i + k) % 3]!, ...(enemy.maxTicks ?? src.maxTicks ? { maxTicks: enemy.maxTicks ?? src.maxTicks! } : {}) });
  if (enemy.mix) {
    // A mixed fight takes one layout of each source: the first, or the n-th with "id#n" (1-based).
    enemy.mix.forEach((ref, k) => {
      const [id, n] = ref.split('#');
      add(pick(id!), n ? Number(n) - 1 : 0, k);
    });
  } else enemy.maps.forEach((_, i) => add(enemy, i, 0));
  return out;
}

export interface FightReport {
  battle: BattleResult;
  /** Won: every enemy down and the extra conditions met. */
  won: boolean;
  /** Why not, when the enemy is down but a condition failed. */
  unmet?: 'say' | 'sayPrefix' | 'sayOnce' | 'damage' | 'waste' | 'uses' | 'without' | 'repeat';
}

export interface EnemyReport {
  fights: FightReport[];
  /** Every fight won and the script short enough. */
  won: boolean;
  tooLong: boolean;
  lines: number;
  /** HP lost over all fights. */
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

export function judge(battle: BattleResult, needs: Needs | undefined, regression = false, script = ''): FightReport {
  if (battle.outcome !== 'win') return { battle, won: false };
  if (needs?.maxDamage !== undefined && battle.damageTaken > needs.maxDamage) return { battle, won: false, unmet: 'damage' };
  if (needs?.noWaste && battle.frames.some((f) => f.events.some((e) => e.type === 'shot' && e.by === 'player' && e.blocked))) return { battle, won: false, unmet: 'waste' };
  if (!regression && needs?.uses?.some((w) => !usesWord(script, w))) return { battle, won: false, unmet: 'uses' };
  if (!regression && needs?.without?.some((w) => usesWord(script, w))) return { battle, won: false, unmet: 'without' };
  if (!regression && needs?.noRepeatedNumber && repeatsNumber(script)) return { battle, won: false, unmet: 'repeat' };
  const said = battle.frames.flatMap((f) => f.bubbles.filter((b) => b.robot === 'player').map((b) => b.text));
  if (needs?.say && said.length === 0) return { battle, won: false, unmet: 'say' };
  if (needs?.sayPrefix && !said.some((t) => t.startsWith(needs.sayPrefix!))) return { battle, won: false, unmet: 'sayPrefix' };
  if (!regression && needs?.sayOnce && said.filter((t) => t === needs.sayOnce).length !== 1) return { battle, won: false, unmet: 'sayOnce' };
  return { battle, won: true };
}

/** Fights an enemy in all its layouts with the player's build and script. */
/** `regression`: an earlier enemy re-run for a newer script; the line limit does not apply (it was the old twist). */
export function fightEnemy(enemy: EnemyData, all: readonly EnemyData[], build: Build, script: string, regression = false): EnemyReport {
  const fights = layoutsOf(enemy, all).map((layout) => judge(runBattle({ build, script, layout }), enemy.needs, regression, script));
  const lines = codeLines(script);
  const tooLong = !regression && enemy.needs?.maxLines !== undefined && lines > enemy.needs.maxLines;
  return {
    fights,
    won: fights.every((f) => f.won) && !tooLong,
    tooLong,
    lines,
    damage: fights.reduce((n, f) => n + f.battle.damageTaken, 0),
  };
}

export const fullBuild = (partial: Partial<Build> | undefined): Build => ({ ...START_BUILD, chassis: 'medium', addons: [], ...partial });
