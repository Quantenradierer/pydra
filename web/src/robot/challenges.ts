import type { Build } from './build.ts';
import { CHALLENGES, type Challenge, type Constraint, type Glitch } from './content/challenges.ts';
import { ENEMIES } from './content/index.ts';
import { fightEnemy } from './fight.ts';

export { CHALLENGES };
export type { Challenge };

export const challengeById = (id: string): Challenge | undefined => CHALLENGES.find((c) => c.id === id);

const enemyOf = (id: string) => ENEMIES.find((e) => e.id === id)!;

/** The player's own script with the bug put in, or the fallback script when it has no place for the bug. */
export function injectGlitch(c: Glitch, script: string): string {
  return script.includes(c.bug.from) ? script.replace(c.bug.from, c.bug.to) : c.fallback;
}

export function checkGlitch(c: Glitch, script: string, build: Build): boolean {
  return fightEnemy(enemyOf(c.enemy), build, script).won;
}

export function checkConstraint(c: Constraint, script: string, build: Build): boolean {
  const enemy = { ...enemyOf(c.enemy), needs: { ...enemyOf(c.enemy).needs, ...(c.maxLines !== undefined ? { maxLines: c.maxLines } : {}), ...c.needs } };
  return fightEnemy(enemy, build, script).won;
}
