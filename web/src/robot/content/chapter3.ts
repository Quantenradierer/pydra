import { chapter, lineCount, mk, T } from './helpers.ts';

/** The Chapter 3 frame: a 9x8 arena, the robot at (4, 6) looking north. Dummies are added ahead, right and left, then a shielded one and a sniper (both in the column ahead). */
const arena = (...items: [string, number, number][]) => mk(9, 8, ['^', 4, 6], ...items);
const AHEAD: [string, number, number] = ['D', 4, 3];
const RIGHT: [string, number, number] = ['D', 7, 6];
const LEFT: [string, number, number] = ['D', 1, 6];
const SHIELDED: [string, number, number] = ['2', 4, 2];
const SNIPER: [string, number, number] = ['3', 4, 1];

const SHIELD_DUMMY = { hp: 3, gear: ['shield'], script: 'while True:\n    shield.activate()\n    wait()' };
const SNIPER_DEF = { hp: 5, script: 'while True:\n    fire()' };

/** Each solution is the one before plus new lines (a block around old lines adds only its `if` / `for` line). */
const S1 = 'if see() == "enemy":\n    fire()';
const S2 = 'for i in range(30):\n    if see() == "enemy":\n        fire()\n    elif see_right() == "enemy":\n        turn_right()';
const S3 = `${S2}\n    else:\n        turn_right()`;
const S4 = S3.replace('        fire()', '        if enemy_shielded():\n            wait()\n        else:\n            fire()');
const S5 = S4.replace('    if see() == "enemy":', '    if hp() < 6:\n        say("low")\n    if see() == "enemy":');

/** Chapter 3: if / elif / else. One 9x8 arena; every challenge adds ONE thing to it, and its solution is the one before plus new lines. */
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
    enemies: [{ hp: 1 }],
    map: arena(AHEAD, RIGHT),
    solution: S2,
    par: lineCount(S2),
  },
  {
    id: 'three-way',
    title: T('Drei Wege', 'Three-Way'),
    catchLine: T('Eine dritte steht links, hinter deinem Rücken. Sonst dreh dich.', 'A third one is on the left, behind you. Otherwise turn.'),
    enemies: [{ hp: 1 }],
    map: arena(AHEAD, RIGHT, LEFT),
    solution: S3,
    par: lineCount(S3),
  },
  {
    id: 'bubble',
    title: T('Blase', 'Bubble'),
    catchLine: T('Ein Schild steht jede zweite Runde. Schüsse darauf sind verschwendet.', 'A shield goes up every other round: shots at it are wasted.'),
    enemies: [{ hp: 1 }, SHIELD_DUMMY],
    map: arena(AHEAD, RIGHT, LEFT, SHIELDED),
    needs: { noWaste: true },
    solution: S4,
    par: lineCount(S4),
  },
  {
    id: 'health-check',
    title: T('Gesundheitscheck', 'Health Check'),
    catchLine: T('Ein Scharfschütze trifft dich. Sag „low“ unter 6 Leben.', 'A sniper hits you. Say "low" below 6 HP.'),
    enemies: [{ hp: 1 }, SHIELD_DUMMY, SNIPER_DEF],
    map: arena(AHEAD, RIGHT, LEFT, SHIELDED, SNIPER),
    needs: { sayPrefix: 'low', sayIfHpBelow: 6 },
    solution: S5,
    par: lineCount(S5),
  },
]);
