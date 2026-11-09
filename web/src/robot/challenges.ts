import { START_BUILD, type Build } from './build.ts';
import { runBattle } from './battle.ts';
import { CHALLENGES, type Challenge, type Constraint, type Glitch, type Workshop } from './content/challenges.ts';
import { ENEMIES } from './content/index.ts';
import { fightEnemy, DEFAULT_BUILD } from './fight.ts';

export { CHALLENGES };
export type { Challenge };

export const challengeById = (id: string): Challenge | undefined => CHALLENGES.find((c) => c.id === id);

const enemyOf = (id: string) => ENEMIES.find((e) => e.id === id)!;

/** The player's own script with the bug put in, or the fallback script when it has no place for the bug. */
export function injectGlitch(c: Glitch, script: string): string {
  return script.includes(c.bug.from) ? script.replace(c.bug.from, c.bug.to) : c.fallback;
}

export function checkGlitch(c: Glitch, script: string, build: Build): boolean {
  return fightEnemy(enemyOf(c.enemy), ENEMIES, build, script, true).won;
}

export function checkWorkshop(c: Workshop, script: string): { ok: boolean; trail: string[]; error?: string } {
  const r = runBattle({ build: START_BUILD, script, layout: { map: c.map, enemies: [{ hp: 99 }], seed: 1, maxTicks: 60 }, brush: true });
  const painted = new Set(r.trail);
  const ok = !r.error && painted.size === c.target.length && c.target.every((t) => painted.has(t));
  return { ok, trail: r.trail, ...(r.error ? { error: r.error.message } : {}) };
}

export function checkConstraint(c: Constraint, script: string, build: Build): boolean {
  const enemy = { ...enemyOf(c.enemy), needs: { ...enemyOf(c.enemy).needs, ...(c.maxLines !== undefined ? { maxLines: c.maxLines } : {}), ...c.needs } };
  return fightEnemy(enemy, ENEMIES, build, script).won;
}
