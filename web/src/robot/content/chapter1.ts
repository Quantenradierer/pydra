import type { EnemyDef } from '../layout.ts';
import { chapter, lineCount, mk, T } from './helpers.ts';

/**
 * The ring challenges at the start of Chapter 1: a 9x9 arena, the robot in the middle at (4, 4), and a dummy that walks a big
 * square (corners (1, 1) and (7, 7), side 6) around it. It only ever shoots when it is in line with the robot (the middle of a side).
 */
const RING_ROBOT: ['^', number, number] = ['^', 4, 4];
type Way = 'N' | 'E' | 'S' | 'W';
/** A dummy on the ring at (x, y) walking `dir`, `start` tiles into its side; it shoots at the robot when in line, then waits `cooldown` rounds. */
const walker = (x: number, y: number, dir: Way, start: number, hp: number, cooldown: number): { map: string[]; enemies: EnemyDef[] } => ({
  map: mk(9, 9, RING_ROBOT, ['D', x, y]),
  enemies: [{ hp, patrol: { dir, steps: 6, circle: true, start }, aim: { every: cooldown } }],
});
/** The middle of each side, clockwise: where the dummy may start. */
const SPAWNS: [number, number, Way][] = [[4, 1, 'E'], [7, 4, 'S'], [4, 7, 'W'], [1, 4, 'N']];
const onRing = (hp: number, cooldown: number) => SPAWNS.map(([x, y, dir]) => walker(x, y, dir, 3, hp, cooldown));
/** The dummy does not move: it stands at one of the four places around the robot. */
const FOUR_SPOTS = ([[4, 1], [7, 4], [4, 7], [1, 4]] as const).map(([x, y]) => ({ map: mk(9, 9, RING_ROBOT, ['D', x, y]), enemies: [{ hp: 2 }] as EnemyDef[] }));

const R1 = 'wait()\nwait()\nwait()\nfire()';
const R2 = 'for i in range(40):\n    if see() == "enemy":\n        fire()\n    turn_right()';
const R3 = 'for i in range(40):\n    if see() == "enemy":\n        fire()\n    else:\n        turn_right()';
const R4 = 'for i in range(40):\n    if see() == "enemy":\n        fire()\n        fire()\n    else:\n        turn_right()';

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
    id: 'roamer',
    title: T('Streuner', 'Roamer'),
    catchLine: T('Sie läuft im Kreis um dich und schießt manchmal.', 'It walks a circle around you and sometimes shoots.'),
    enemies: walker(1, 1, 'E', 0, 1, 8).enemies,
    map: walker(1, 1, 'E', 0, 1, 8).map,
    solution: R1,
    breaks: false,
    par: lineCount(R1),
  },
  {
    id: 'ring-search',
    title: T('Kreissuche', 'Circle Search'),
    catchLine: T('Sie startet irgendwo auf dem Kreis. Schau mit see() nach vorn: if see() == "enemy": und eingerückt darunter, was dann passiert.', 'It starts somewhere on the circle. Look ahead with see(): if see() == "enemy": and indented below it what happens then.'),
    enemies: onRing(1, 8)[0]!.enemies,
    map: onRing(1, 8)[0]!.map,
    variants: onRing(1, 8).slice(1),
    fresh: true,
    solution: R2,
    par: lineCount(R2),
  },
  {
    id: 'ring-shooter',
    title: T('Schießwütig', 'Trigger-Happy'),
    catchLine: T('Sie hält 2 Treffer aus und schießt jetzt öfter. Mit else: tust du etwas anderes, solange du nichts siehst: bleib stehen, solange du sie siehst.', 'It takes 2 hits and shoots more often now. With else: you do something different while you see nothing: stay put while you see it.'),
    enemies: onRing(2, 3)[0]!.enemies,
    map: onRing(2, 3)[0]!.map,
    variants: onRing(2, 3).slice(1),
    breaks: false,
    solution: R3,
    par: lineCount(R3),
  },
  {
    id: 'four-spots',
    title: T('Vier Orte', 'Four Spots'),
    catchLine: T('Er steht an einem von vier Orten rund um dich. Dreh dich.', 'It stands at one of four places around you. Turn.'),
    enemies: FOUR_SPOTS[0]!.enemies,
    map: FOUR_SPOTS[0]!.map,
    variants: FOUR_SPOTS.slice(1),
    breaks: false,
    solution: R4,
    par: lineCount(R4),
  },
  {
    id: 'two-steps',
    title: T('Zwei Felder', 'Two Tiles'),
    catchLine: T('forward(2) fährt zwei Felder auf einmal.', 'forward(2) drives two tiles at once.'),
    enemies: [{ hp: 2 }],
    map: arena(NEAR),
    fresh: true,
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
