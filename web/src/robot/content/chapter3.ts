import { chapter, lineCount, mk, T } from './helpers.ts';

/** The Chapter 3 frame: a 9x8 arena, the robot at (4, 6) looking north. One enemy is ahead, one on the right, one on the left. */
const arena = (...items: [string, number, number][]) => mk(9, 8, ['^', 4, 6], ...items);
const AHEAD: [string, number, number] = ['D', 4, 3];
const RIGHT: [string, number, number] = ['2', 7, 6];
const LEFT: [string, number, number] = ['3', 1, 6];

/** Its shield is up for 2 rounds, then down for 1 (a rhythm of its own: shots at a raised shield are wasted). */
const SHIELDED = { hp: 2, shieldCycle: { up: 2, down: 1 } };
/** Shoots every round along its row. */
const SNIPER = { hp: 2, script: 'while True:\n    fire()' };

/** Each solution is the one before plus new lines (a block around old lines adds only its `if` / `for` line). */
const S1 = 'if see() == "enemy":\n    fire()';
const S2 = 'for i in range(30):\n    if see() == "enemy":\n        fire()\n    elif see_right() == "enemy":\n        turn_right()';
const S3 = `${S2}\n    else:\n        turn_right()`;
const S4 = S3.replace('        fire()', '        if enemy_shielded():\n            wait()\n        else:\n            fire()');
const S5 = S4.replace('    if see() == "enemy":', '    if see_left() == "enemy":\n        turn_left()\n    if see() == "enemy":');

/**
 * Chapter 3: if / elif / else. One 9x8 arena, at most three enemies with different hit points; every challenge adds ONE thing
 * (a shield with its own rhythm, an enemy behind, a sniper that shoots back) and its solution is the one before plus new lines.
 */
export const CHAPTER_3 = chapter(3, [
  {
    id: 'peekaboo',
    title: T('Guck-guck', 'Peekaboo'),
    catchLine: T('Schau erst nach: Schieß nur, wenn du einen Gegner siehst.', 'Look first: fire only when you see an enemy.'),
    enemies: [{ hp: 1 }],
    map: arena(AHEAD),
    solution: S1,
    par: lineCount(S1),
  },
  {
    id: 'right-dummy',
    title: T('Rechts oder geradeaus', 'Right or Ahead'),
    catchLine: T('Eine zweite Attrappe steht rechts. Prüfe beides, immer wieder.', 'A second dummy is on the right. Check both, again and again.'),
    enemies: [{ hp: 1 }, { hp: 3 }],
    map: arena(AHEAD, RIGHT),
    solution: S2,
    par: lineCount(S2),
  },
  {
    id: 'three-way',
    title: T('Drei Wege', 'Three-Way'),
    catchLine: T('Ein dritter Gegner steht links, hinter deinem Rücken. Sonst dreh dich.', 'A third enemy is on the left, behind you. Otherwise turn.'),
    enemies: [{ hp: 1 }, { hp: 3 }, { hp: 1 }],
    map: arena(AHEAD, RIGHT, LEFT),
    solution: S3,
    par: lineCount(S3),
  },
  {
    id: 'bubble',
    title: T('Blase', 'Bubble'),
    catchLine: T('Sein Schild geht im eigenen Takt hoch. Schüsse darauf sind verschwendet.', 'Its shield rises at its own pace. Shots at it are wasted.'),
    enemies: [SHIELDED, { hp: 3 }, { hp: 1 }],
    map: arena(AHEAD, RIGHT, LEFT),
    needs: { noWaste: true },
    solution: S4,
    par: lineCount(S4),
  },
  {
    id: 'sniper',
    title: T('Scharfschütze', 'Sniper'),
    catchLine: T('Der Gegner links schießt zurück. Erledige ihn zuerst.', 'The enemy on the left shoots back. Take it out first.'),
    enemies: [SHIELDED, { hp: 3 }, SNIPER],
    map: arena(AHEAD, RIGHT, LEFT),
    needs: { noWaste: true },
    solution: S5,
    par: lineCount(S5),
  },
]);
