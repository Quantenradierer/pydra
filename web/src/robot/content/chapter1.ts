import { chapter, lineCount, mk, T } from './helpers.ts';

const P: ['^', number, number] = ['^', 3, 9];
const NEAR: [string, number, number] = ['D', 3, 6];
const FAR: [string, number, number] = ['2', 3, 1];
const RIGHT: [string, number, number] = ['3', 7, 5];
const arena = (...items: [string, number, number][]) => mk(8, 10, P, ...items);

/** Each solution is the one before plus new lines. The report line is the robot's display, read by HQ: nobody talks to an enemy. */
const S1 = 'say("Target locked")\nforward()\nforward()\nfire()\nfire()';
const S2 = `${S1}\nforward(2)\nfire()`;
const S3 = `${S2}\nturn_right()\nd = distance()\nforward(d - 1)\nfire()\nfire()\nfire()`;
const S4 = S3.replace('d = distance()', 'd = distance()\nsay("Distance: " + str(d))');

/**
 * Chapter 1: numbers, variables, arguments and the robot's report line. One 8x10 arena (robot at (3, 9)) with at most three
 * dummies of different hit points; every challenge adds ONE idea and its solution is the one before plus new lines.
 */
export const CHAPTER_1 = chapter(1, [
  {
    id: 'status-report',
    title: T('Statusmeldung', 'Status Report'),
    catchLine: T('Der Stab will eine Meldung, bevor du schießt: say().', 'HQ wants a report before you fire: say().'),
    enemies: [{ hp: 2 }],
    map: arena(NEAR),
    needs: { say: true },
    solution: S1,
    breaks: false,
    par: lineCount(S1),
  },
  {
    id: 'far-dummy',
    title: T('Fernattrappe', 'Far Dummy'),
    catchLine: T('Eine zweite steht weit weg. forward(2) geht zwei Felder.', 'A second one is far away. forward(2) moves two tiles.'),
    enemies: [{ hp: 2 }, { hp: 1 }],
    map: arena(NEAR, FAR),
    needs: { say: true },
    solution: S2,
    par: lineCount(S2),
  },
  {
    id: 'sign-dummy',
    title: T('Rechts außen', 'Far Right'),
    catchLine: T('Rechts steht eine mit 3 Leben. Wie weit? Miss mit distance().', 'One on the right has 3 HP. How far? Use distance().'),
    enemies: [{ hp: 2 }, { hp: 1 }, { hp: 3 }],
    map: arena(NEAR, FAR, RIGHT),
    needs: { uses: ['distance'] },
    solution: S3,
    par: lineCount(S3),
  },
  {
    id: 'range-report',
    title: T('Entfernungsmeldung', 'Range Report'),
    catchLine: T('Melde dem Stab die Entfernung: „Distance: 4“.', 'Report the range to HQ: "Distance: 4".'),
    enemies: [{ hp: 2 }, { hp: 1 }, { hp: 3 }],
    map: arena(NEAR, FAR, RIGHT),
    needs: { sayPrefix: 'Distance: ' },
    solution: S4,
    par: lineCount(S4),
  },
]);
