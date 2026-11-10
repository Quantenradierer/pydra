import { chapter, mk, T } from './helpers.ts';

const P: ['^', number, number] = ['^', 3, 9];
const NORTH: [string, number, number] = ['D', 3, 2];
const EAST: [string, number, number] = ['D', 7, 5];
const WEST: [string, number, number] = ['D', 0, 5];
const BIG: [string, number, number] = ['2', 3, 1];
const arena = (...items: [string, number, number][]) => mk(8, 10, P, ...items);

/** Each solution is the one before plus new lines (a loop around old lines adds only the `for` line). */
const L = (n: number) => `for i in range(${n}):\n    fire()`;
const S1 = `forward(4)\n${L(3)}`;
const S2 = `${S1}\nturn_right()\n${L(3)}`;
const S3 = `${S2}\nsay("done")`;
const S4 = S3.replace('say("done")', `turn_right()\nturn_right()\n${L(3)}\nsay("done")`);
const S5 = S4.replace(`forward(4)\n${L(3)}`, `forward(4)\nfor k in range(4):\n    for i in range(3):\n        fire()`);

/**
 * Chapter 2: for loops. One 8x10 arena (robot at (3, 9), `forward(4)` brings it to (3, 5)); every challenge adds one thing:
 * the dummies north, east and west get a loop each, then a loop around a loop. The old lines stay.
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
    id: 'dummy-right',
    title: T('Attrappe rechts', 'Dummy on the Right'),
    catchLine: T('Dieselbe Attrappe steht nochmal rechts von dir.', 'The same kind of dummy stands on your right.'),
    enemies: [{ hp: 3 }],
    map: arena(NORTH, EAST),
    needs: { uses: ['for'] },
    solution: S2,
    par: 6,
  },
  {
    id: 'after-the-loop',
    title: T('Nach der Schleife', 'After the Loop'),
    catchLine: T('Sag genau einmal „done“: erst wenn alles erledigt ist.', 'Say "done" exactly once: only when everything is finished.'),
    enemies: [{ hp: 3 }],
    map: arena(NORTH, EAST),
    needs: { sayOnce: 'done' },
    solution: S3,
    par: 7,
  },
  {
    id: 'dummy-left',
    title: T('Attrappe links', 'Dummy on the Left'),
    catchLine: T('Eine dritte Attrappe steht links. „done“ kommt weiter ganz zum Schluss.', 'A third dummy stands on the left. "done" still comes last.'),
    enemies: [{ hp: 3 }],
    map: arena(NORTH, EAST, WEST),
    needs: { sayOnce: 'done' },
    solution: S4,
    par: 11,
  },
  {
    id: 'dummy-army',
    title: T('Attrappenarmee', 'Dummy Army'),
    catchLine: T('Boss: Hinter der ersten steht eine mit 6 Leben. Höchstens 12 Zeilen.', 'Boss: behind the first one stands one with 6 HP. At most 12 lines.'),
    enemies: [{ hp: 3 }, { hp: 6 }],
    map: arena(NORTH, EAST, WEST, BIG),
    needs: { sayOnce: 'done', maxLines: 12 },
    solution: S5,
    par: 12,
  },
]);
