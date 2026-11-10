import { chapter, lineCount, mk, T, wallRow } from './helpers.ts';

/**
 * Three lanes (rows 0, 2 and 4) between two walls; they only meet in column 0, where the robot starts.
 * The enemies stand 8, 7 and 6 tiles in, the blaster reaches 5: drive 3, 2 and 1 tiles in, and back out again.
 */
const MAP = mk(9, 5, ['>', 0, 2], ...wallRow(1, 1, 8), ...wallRow(3, 1, 8), ['D', 8, 2], ['2', 7, 0], ['3', 6, 4]);

const STRIKE = 'def strike(n):\n    forward(n)\n    while see() == "enemy":\n        fire()\n    backward(n)';
const S1 = `${STRIKE}\nstrike(3)\nturn_left()\nforward(2)\nturn_right()\nstrike(2)\nturn_right()\nforward(4)\nturn_left()\nstrike(1)`;

/** Chapter 5: a function with a parameter. The same raid three times, each with another number. */
export const CHAPTER_5 = chapter(5, [
  {
    id: 'lanes',
    title: T('Drei Gänge', 'Three Lanes'),
    catchLine: T('Drei Gänge, drei Entfernungen. Höchstens 14 Zeilen: def mit Parameter.', 'Three lanes, three distances. At most 14 lines: def with a parameter.'),
    enemies: [{ hp: 2 }, { hp: 3, regen: { every: 2, amount: 1 } }, { hp: 1 }],
    map: MAP,
    needs: { maxLines: 14 },
    solution: S1,
    par: lineCount(S1),
  },
]);
