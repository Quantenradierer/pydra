import { chapter, lineCount, mk, T } from './helpers.ts';

const P: ['^', number, number] = ['^', 3, 9];
const NEAR: [string, number, number] = ['D', 3, 6];
const FAR: [string, number, number] = ['2', 3, 2];
const RIGHT: [string, number, number] = ['3', 7, 3];
const arena = (...items: [string, number, number][]) => mk(8, 10, P, ...items);

/** Each solution is the one before plus new lines. Nothing is printed: numbers and variables win the fights. */
const S1 = 'forward(2)\nfire()\nfire()';
const S2 = `${S1}\nd = distance()\nforward(d - 1)\nfire()`;
const S3 = `${S2}\nturn_right()\nd = distance()\nforward(d - 1)\nfire()\nfire()\nfire()`;

/**
 * Chapter 1: numbers, variables and arguments. One 8x10 arena (robot at (3, 9)) with at most three dummies of different
 * hit points; every challenge adds ONE idea (a count, a measured distance in a variable) and its solution is the one before
 * plus new lines.
 */
export const CHAPTER_1 = chapter(1, [
  {
    id: 'two-steps',
    title: T('Zwei Felder', 'Two Tiles'),
    catchLine: T('forward(2) fährt zwei Felder auf einmal.', 'forward(2) drives two tiles at once.'),
    enemies: [{ hp: 2 }],
    map: arena(NEAR),
    solution: S1,
    breaks: false,
    par: lineCount(S1),
  },
  {
    id: 'far-dummy',
    title: T('Fernattrappe', 'Far Dummy'),
    catchLine: T('Eine zweite steht weit weg: d = distance(), dann d - 1 Felder.', 'A second one is far away: d = distance(), then d - 1 tiles.'),
    enemies: [{ hp: 2 }, { hp: 1 }],
    map: arena(NEAR, FAR),
    solution: S2,
    par: lineCount(S2),
  },
  {
    id: 'sign-dummy',
    title: T('Rechts außen', 'Far Right'),
    catchLine: T('Rechts steht eine mit 3 Leben. Miss noch einmal: d wird neu.', 'One on the right has 3 HP. Measure again: d is new.'),
    enemies: [{ hp: 2 }, { hp: 1 }, { hp: 3 }],
    map: arena(NEAR, FAR, RIGHT),
    solution: S3,
    par: lineCount(S3),
  },
]);
