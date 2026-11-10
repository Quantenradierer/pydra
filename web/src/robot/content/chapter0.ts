import { chapter, lineCount, mk, T } from './helpers.ts';

const P: ['^', number, number] = ['^', 3, 7];
const NEAR: [string, number, number] = ['D', 3, 4];
const RIGHT: [string, number, number] = ['2', 7, 6];
/** The wall between the robot's row and the dummy on the right: shots bounce off, the robot has to drive around it. */
const WALL: [string, number, number] = ['#', 5, 6];

/** Each solution is the one before plus new lines (the player keeps ONE script and extends it). */
const S1 = 'forward()\nfire()';
const S2 = `${S1}\nfire()`;
const S3 = `${S2}\nturn_right()\nfire()\nfire()\nfire()`;
/** Around the wall: north, east along row 5, south again, face east. */
const S4 = `${S3}\nturn_left()\nforward()\nturn_right()\nforward()\nforward()\nforward()\nturn_right()\nforward()\nturn_left()\nfire()\nfire()\nfire()`;

/**
 * Chapter 0: calling functions, one after the other. Wheels, blaster, eyes. One 8x8 arena frame, at most three dummies with
 * different hit points; every challenge adds ONE idea (a turn, a wall that must be driven around) and its solution
 * is the one before plus a few lines.
 */
export const CHAPTER_0 = chapter(0, [
  {
    id: 'first-contact',
    title: T('Erster Kontakt', 'First Contact'),
    catchLine: T('Der Code ist schon fertig.', 'The code is already written.'),
    enemies: [{ hp: 1 }],
    map: mk(8, 8, P, NEAR),
    solution: S1,
    breaks: false,
    par: lineCount(S1),
  },
  {
    id: 'one-more-line',
    title: T('Eine Zeile mehr', 'One More Line'),
    catchLine: T('Diese Attrappe hält 2 Treffer aus.', 'This dummy takes 2 hits.'),
    enemies: [{ hp: 2 }],
    map: mk(8, 8, P, NEAR),
    solution: S2,
    par: lineCount(S2),
  },
  {
    id: 'training-dummy',
    title: T('Zweite Attrappe', 'Second Dummy'),
    catchLine: T('Rechts von dir steht eine zweite, sie hält 3 Treffer aus.', 'A second one stands to your right and takes 3 hits.'),
    enemies: [{ hp: 2 }, { hp: 3 }],
    map: mk(8, 8, P, NEAR, RIGHT),
    solution: S3,
    par: lineCount(S3),
  },
  {
    id: 'wall-dummy',
    title: T('Mauer-Attrappe', 'Wall Dummy'),
    catchLine: T('Eine Mauer steht dazwischen. Schüsse prallen ab: fahr drumherum.', 'A wall stands in between. Shots bounce off: drive around it.'),
    enemies: [{ hp: 2 }, { hp: 3 }],
    map: mk(8, 8, P, NEAR, RIGHT, WALL),
    solution: S4,
    par: lineCount(S4),
  },
]);
