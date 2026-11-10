import { chapter, lineCount, mk, T } from './helpers.ts';

const P: ['^', number, number] = ['^', 3, 9];
const NEAR: [string, number, number] = ['D', 3, 6];
const FAR: [string, number, number] = ['2', 3, 1];
const RIGHT: [string, number, number] = ['3', 7, 5];
const LEFT: [string, number, number] = ['4', 0, 5];
const TOP: [string, number, number] = ['5', 4, 2];
/** Hit points differ from dummy to dummy: near 2, far 2, right 3, left 1, top 1. */
const D = [{ hp: 2 }, { hp: 2 }, { hp: 3 }, { hp: 1 }, { hp: 1 }];
const arena = (...items: [string, number, number][]) => mk(8, 10, P, ...items);

/** Each solution is the one before plus new lines. */
const S1 = 'say("Hi")\nforward()\nforward()\nfire()\nfire()';
const S2 = `${S1}\nforward(2)\nfire()\nfire()`;
const S3 = 'say("Hi")\nshots = 0\nforward()\nforward()\nfire()\nshots = shots + 1\nfire()\nshots = shots + 1\nforward(2)\nfire()\nshots = shots + 1\nfire()\nshots = shots + 1\nsay(shots)';
const S4 = S3.replace('say(shots)', 'turn_right()\nd = distance()\nforward(d - 1)\nfire()\nfire()\nfire()\nsay(shots)');
const S5 = S4.replace('d = distance()', 'd = distance()\nsay("Distance: " + str(d))');
const S6 = S5.replace('say(shots)', 'turn_right()\nturn_right()\nforward(2)\nfire()\nsay(shots)');
const S7 = S6.replace('say(shots)', 'turn_right()\nfire()\nsay(shots)');

/**
 * Chapter 1: say(), numbers, variables, arguments. One 8x10 arena (robot at (3, 9)); every challenge adds ONE thing to it
 * and its solution is the one before plus new lines. The script of Chapter 0 is still there: the new thing is `say()`.
 */
export const CHAPTER_1 = chapter(1, [
  {
    id: 'hello-robot',
    title: T('Hallo, Roboter', 'Hello Robot'),
    catchLine: T('Die Attrappe will begrüßt werden: Dein Roboter muss etwas sagen.', 'The dummy wants a greeting: your robot has to say something.'),
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
    enemies: D.slice(0, 2),
    map: arena(NEAR, FAR),
    needs: { say: true },
    solution: S2,
    par: lineCount(S2),
  },
  {
    id: 'counter',
    title: T('Zähler', 'Counter'),
    catchLine: T('Dein Roboter soll zum Schluss sagen, wie oft er geschossen hat.', 'Your robot must say at the end how often it fired.'),
    enemies: D.slice(0, 2),
    map: arena(NEAR, FAR),
    needs: { sayOnce: '4' },
    solution: S3,
    par: lineCount(S3),
  },
  {
    id: 'sign-dummy',
    title: T('Schilder-Attrappe', 'Sign Dummy'),
    catchLine: T('Eine dritte steht rechts, mit 3 Leben. Miss sie mit distance().', 'A third one stands on the right, with 3 HP. Measure it with distance().'),
    enemies: D.slice(0, 3),
    map: arena(NEAR, FAR, RIGHT),
    needs: { uses: ['distance'] },
    solution: S4,
    par: lineCount(S4),
  },
  {
    id: 'name-tag',
    title: T('Namensschild', 'Name Tag'),
    catchLine: T('Dein Roboter soll die Entfernung ansagen: „Distance: 4“.', 'Your robot has to announce the distance: "Distance: 4".'),
    enemies: D.slice(0, 3),
    map: arena(NEAR, FAR, RIGHT),
    needs: { sayPrefix: 'Distance: ' },
    solution: S5,
    par: lineCount(S5),
  },
  {
    id: 'far-left',
    title: T('Weit links', 'Far Left'),
    catchLine: T('Eine vierte steht links, weit weg.', 'A fourth one stands on the left, far away.'),
    enemies: D.slice(0, 4),
    map: arena(NEAR, FAR, RIGHT, LEFT),
    needs: { sayPrefix: 'Distance: ' },
    solution: S6,
    par: lineCount(S6),
  },
  {
    id: 'calibrator',
    title: T('Kalibrator', 'Calibrator'),
    catchLine: T('Eine fünfte steht oben. Alles zusammen: ansagen, zählen, zielen.', 'A fifth one is at the top. All together: announce, count, aim.'),
    enemies: D.slice(0, 5),
    map: arena(NEAR, FAR, RIGHT, LEFT, TOP),
    needs: { sayPrefix: 'Distance: ' },
    solution: S7,
    par: lineCount(S7),
  },
]);
