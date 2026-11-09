import { chapter, mk, T } from './helpers.ts';

const P: ['^', number, number] = ['^', 3, 7];
const FAR: [string, number, number] = ['D', 3, 0];
const RIGHT: [string, number, number] = ['D', 7, 5];
const LEFT: [string, number, number] = ['D', 0, 5];
const CORNER: [string, number, number] = ['D', 5, 1];
const WALL: [string, number, number] = ['#', 5, 3];

/** Each solution is the one before plus new lines (the player keeps ONE script and extends it). */
const S1 = 'forward()\nfire()';
const S2 = 'forward()\nfire()\nfire()';
const S3 = `${S2}\nforward()\nfire()\nfire()`;
const S4 = `${S3}\nturn_right()\nfire()\nfire()`;
const S5 = `${S4}\nturn_right()\nturn_right()\nfire()\nfire()`;
const S6 = `${S5}\nturn_right()\nturn_right()\nforward()\nforward()\nturn_left()\nfire()\nfire()`;
const S7 = `${S6}\nturn_right()\nforward()\nturn_left()\nforward()\nforward()\nforward()\nforward()\nturn_left()\nfire()\nfire()`;

/**
 * Chapter 0: calling functions, one after the other. Wheels, blaster, eyes. One 8x8 arena frame; every challenge adds
 * ONE thing to it (a hit point, a dummy, a wall) and its solution is the one before plus a few lines.
 */
export const CHAPTER_0 = chapter(0, [
  {
    id: 'first-contact',
    title: T('Erster Kontakt', 'First Contact'),
    catchLine: T('Der Code ist schon fertig.', 'The code is already written.'),
    enemies: [{ hp: 1 }],
    map: mk(8, 8, P, ['D', 3, 4]),
    solution: S1,
    breaks: false,
    par: 2,
  },
  {
    id: 'one-more-line',
    title: T('Eine Zeile mehr', 'One More Line'),
    catchLine: T('Diese Attrappe hält 2 Treffer aus.', 'This dummy takes 2 hits.'),
    enemies: [{ hp: 2 }],
    map: mk(8, 8, P, ['D', 3, 4]),
    solution: S2,
    par: 3,
  },
  {
    id: 'training-dummy',
    title: T('Zweite Attrappe', 'Second Dummy'),
    catchLine: T('Hinter der ersten steht eine zweite. Der Blaster reicht nur 5 Felder.', 'A second one stands behind the first. The blaster reaches 5 tiles.'),
    enemies: [{ hp: 2 }],
    map: mk(8, 8, P, ['D', 3, 4], FAR),
    solution: S3,
    par: 6,
  },
  {
    id: 'corner-dummy',
    title: T('Eckattrappe', 'Corner Dummy'),
    catchLine: T('Eine dritte steht rechts von dir.', 'A third one is on your right.'),
    enemies: [{ hp: 2 }],
    map: mk(8, 8, P, ['D', 3, 4], FAR, RIGHT),
    solution: S4,
    par: 9,
  },
  {
    id: 'u-turn',
    title: T('Wendemanöver', 'U-Turn'),
    catchLine: T('Eine vierte steht links. Du schaust nach rechts.', 'A fourth one is on the left. You look right.'),
    enemies: [{ hp: 2 }],
    map: mk(8, 8, P, ['D', 3, 4], FAR, RIGHT, LEFT),
    solution: S5,
    par: 13,
  },
  {
    id: 'far-corner',
    title: T('Ferne Ecke', 'Far Corner'),
    catchLine: T('Eine fünfte steht oben rechts, abseits deiner Linien.', 'A fifth one stands at the top right, off your lines.'),
    enemies: [{ hp: 2 }],
    map: mk(8, 8, P, ['D', 3, 4], FAR, RIGHT, LEFT, CORNER),
    solution: S6,
    par: 20,
  },
  {
    id: 'wall-dummy',
    title: T('Mauer-Attrappe', 'Wall Dummy'),
    catchLine: T('Eine Mauer steht vor der letzten Attrappe. Schüsse prallen ab.', 'A wall stands in front of the last dummy. Shots bounce off.'),
    enemies: [{ hp: 2 }],
    map: mk(8, 8, P, ['D', 3, 4], FAR, RIGHT, LEFT, CORNER, WALL),
    solution: S7,
    par: 30,
  },
]);
