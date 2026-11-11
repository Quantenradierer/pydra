/**
 * The code every enemy runs. An enemy is a robot with a Python script like the player's, run by the same interpreter, one action per round.
 * Content files describe a walker or a shooter in a few words (`patrol`, `aim`); this turns the words into the script the enemy really runs
 * (and that the player can look at and step through). A dummy runs `while True: wait()`.
 *
 * What an enemy script can do besides the player's own functions:
 *  - `walk("east")`: one step that way, taken after the attacks of the round (the robot turns to face it; nothing happens when the tile is not free);
 *  - `player_in_line()`: whether the player is in the same row or column with nothing between;
 *  - `shoot_player()`: turn to the player and shoot (one hit point of damage, no range limit).
 */
import { opposite, turnRight, type Dir } from './engine.ts';
import type { EnemyDef } from './layout.ts';

const NAME: Record<Dir, string> = { N: 'north', E: 'east', S: 'south', W: 'west' };
const MIRROR: Record<Dir, Dir> = { N: 'N', S: 'S', E: 'W', W: 'E' };

const indent = (lines: string[], n: number): string[] => lines.map((l) => ' '.repeat(n) + l);

/** `walk` for `n` rounds. */
function leg(dir: Dir, n: number): string[] {
  const step = `walk("${NAME[dir]}")`;
  return n === 1 ? [step] : [`for i in range(${n}):`, ...indent([step], 4)];
}

export function enemyScript(def: EnemyDef, mirrored = false): string {
  if (def.script !== undefined) return def.script;
  const p = def.patrol && (mirrored ? { ...def.patrol, dir: MIRROR[def.patrol.dir] } : def.patrol);
  const aim = def.aim;
  if (!p && !aim) return 'while True:\n    wait()';
  const dirs: Dir[] = p ? (p.circle ? [p.dir, turnRight(p.dir), opposite(p.dir), opposite(turnRight(p.dir))] : [p.dir, opposite(p.dir)]) : [];
  if (!aim) {
    const start = p!.start ?? 0;
    const order = start > 0 ? [...dirs.slice(1), dirs[0]!] : dirs;
    return [...(start > 0 ? leg(p!.dir, p!.steps - start) : []), 'while True:', ...indent(order.flatMap((d) => leg(d, p!.steps)), 4)].join('\n');
  }
  // A shooter: every round it first looks whether it may shoot, else it walks (and counts its cooldown down).
  const lines = ['cooldown = ' + aim.every];
  if (p) lines.push(`side = 0`, `done = ${p.start ?? 0}`);
  lines.push('while True:', '    if cooldown == 0 and player_in_line():', '        shoot_player()', `        cooldown = ${aim.every}`, '    else:', '        if cooldown > 0:', '            cooldown -= 1');
  if (!p) lines.push('        wait()');
  else {
    const walks = dirs.flatMap((d, i) => [`${i === 0 ? 'if' : 'elif'} side == ${i}:`, ...indent([`walk("${NAME[d]}")`], 4)]);
    lines.push(...indent(walks, 8), '        done += 1', `        if done == ${p.steps}:`, '            done = 0', `            side = (side + 1) % ${dirs.length}`);
  }
  return lines.join('\n');
}
