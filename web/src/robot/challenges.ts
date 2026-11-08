import { START_BUILD, type Build } from './build.ts';
import { runBattle } from './battle.ts';
import { CHALLENGES, type Challenge, type Constraint, type Glitch, type LineUp, type Predict, type Workshop } from './content/challenges.ts';
import { ENEMIES } from './content/index.ts';
import { fightEnemy, fullBuild } from './fight.ts';
import { Rng } from './rng.ts';

export { CHALLENGES };
export type { Challenge };

export const challengeById = (id: string): Challenge | undefined => CHALLENGES.find((c) => c.id === id);

const enemyOf = (id: string) => ENEMIES.find((e) => e.id === id)!;

/** The lines of a Line Up in a shuffled order (never the solved order, seeded by the challenge id). */
export function shuffledLines(c: LineUp): string[] {
  const rng = new Rng([...c.id].reduce((n, ch) => n * 31 + ch.charCodeAt(0), 7));
  for (let tries = 0; tries < 20; tries++) {
    const lines = rng.shuffle(c.lines);
    if (lines.join('\n') !== c.lines.join('\n') || c.lines.length < 2) return lines;
  }
  return [...c.lines].reverse();
}

/** Whether this order of lines beats the enemy (several orders may). */
export function checkLineUp(c: LineUp, order: readonly string[]): boolean {
  return fightEnemy(enemyOf(c.enemy), ENEMIES, fullBuild(enemyOf(c.enemy).solutionBuild), order.join('\n'), true).won;
}

/** What the script really does: the answer to a Predict challenge. */
export function predictAnswer(c: Predict): string {
  const r = runBattle({ build: START_BUILD, script: c.script, layout: { map: c.map, enemies: [{ hp: 99 }], seed: 1, maxTicks: 40 } });
  if (c.ask === 'tile') {
    const p = r.frames.at(-1)!.robots.find((x) => x.id === 'player')!.pos;
    return `${p.x},${p.y}`;
  }
  const said = r.frames.flatMap((f) => f.bubbles.filter((b) => b.robot === 'player').map((b) => b.text));
  return said.at(-1) ?? '';
}

export const checkPredict = (c: Predict, answer: string): boolean => answer.replace(/[()\s]/g, '') === predictAnswer(c).replace(/[()\s]/g, '') || answer.trim() === predictAnswer(c);

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
  const enemy = { ...enemyOf(c.enemy), needs: { ...enemyOf(c.enemy).needs, maxLines: c.maxLines } };
  return fightEnemy(enemy, ENEMIES, build, script).won;
}
