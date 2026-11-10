import { chapter, mk, T } from './helpers.ts';

const P: ['^', number, number] = ['^', 3, 9];
const NORTH: [string, number, number] = ['D', 3, 2];
/** Where the patroller starts: it walks down column 7, rows 4 to 6, and back, so it is in the robot's row only part of the time. */
const EAST: [string, number, number] = ['2', 7, 4];
/** In the far corner, off every line of the robot: it has to walk there. */
const WEST: [string, number, number] = ['3', 0, 3];
const arena = (...items: [string, number, number][]) => mk(8, 10, P, ...items);

const PATROLLER = { hp: 2, face: 'W' as const, patrol: { dir: 'S' as const, steps: 2 } };

/** Each solution is the one before plus new lines (a loop around old lines adds only the `for` line). */
const L = (n: number) => `for i in range(${n}):\n    fire()`;
const S1 = `forward(4)\n${L(3)}`;
const S2 = `${S1}\nturn_right()\n${L(6)}`;
const S3 = `${S2}\nturn_right()\nturn_right()\nfor j in range(3):\n    forward()\nturn_right()\n${L(4)}`;
const S4 = S3.replace(`forward(4)\n${L(3)}`, `forward(4)\nfor k in range(2):\n    for i in range(3):\n        fire()`);

/**
 * Chapter 2: for loops. One 8x10 arena (robot at (3, 9), `forward(4)` brings it to (3, 5)) with at most three dummies of different
 * hit points. The one to the east walks back and forth: not every shot hits, so the loop runs more often than it has hit points.
 */
export const CHAPTER_2 = chapter(2, [
  {
    id: 'tank-dummy',
    title: T('Panzer-Attrappe', 'Tank Dummy'),
    catchLine: T('Die Attrappe hat 3 Leben. Schreib eine for-Schleife.', 'The dummy has 3 HP. Write a for loop.'),
    enemies: [{ hp: 3 }],
    map: arena(NORTH),
    needs: { uses: ['for'] },
    solution: S1,
    breaks: false,
    par: 3,
  },
  {
    id: 'patrol-dummy',
    title: T('Streife', 'Patrol'),
    catchLine: T('Rechts läuft eine Attrappe hin und her. Nicht jeder Schuss trifft.', 'A dummy on the right walks back and forth. Not every shot hits.'),
    enemies: [{ hp: 3 }, PATROLLER],
    map: arena(NORTH, EAST),
    needs: { uses: ['for'] },
    solution: S2,
    par: 6,
  },
  {
    id: 'corner-dummy',
    title: T('Eckattrappe', 'Corner Dummy'),
    catchLine: T('Links in der Ecke steht eine mit 4 Leben. Lauf hin, mit einer Schleife.', 'One with 4 HP stands in the far left corner. Walk there with a loop.'),
    enemies: [{ hp: 3 }, PATROLLER, { hp: 4 }],
    map: arena(NORTH, EAST, WEST),
    needs: { uses: ['for'] },
    solution: S3,
    par: 14,
  },
  {
    id: 'dummy-army',
    title: T('Boss-Attrappe', 'Boss Dummy'),
    catchLine: T('Boss: Die vordere hat jetzt 6 Leben. Höchstens 14 Zeilen.', 'Boss: the one ahead now has 6 HP. At most 14 lines.'),
    enemies: [{ hp: 6 }, PATROLLER, { hp: 4 }],
    map: arena(NORTH, EAST, WEST),
    needs: { maxLines: 14 },
    solution: S4,
    par: 14,
  },
]);
