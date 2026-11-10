import { chapter, lineCount, mk, T } from './helpers.ts';

const P: ['^', number, number] = ['^', 3, 7];
/** Straight ahead of the robot. */
const AHEAD: [string, number, number] = ['D', 3, 4];
/** Beside the robot: it has to turn after one step forward. */
const SIDE: [string, number, number] = ['D', 7, 6];
/** Further up on the right: two steps forward, then turn. */
const FAR_SIDE: [string, number, number] = ['D', 7, 5];
/** A dummy that walks a small square (2x2 tiles) and passes the robot's row again and again. */
const CIRCLE: [string, number, number] = ['D', 6, 4];
/** A dummy that walks up and down column 7 and is in the robot's row only part of the time. */
const WALKER: [string, number, number] = ['D', 7, 6];

/** Each solution is the one before plus new lines (the player keeps ONE script and extends it). */
const S1 = 'forward()\nfire()';
const S2 = `${S1}\nturn_right()\nfire()`;
const S3 = 'forward()\nfire()\nforward()\nturn_right()\nfire()';
const S4 = `${S3}\nfire()\nfire()`;
const S5 = `${S4}\nfire()`;

/**
 * Chapter 0: calling functions, one after the other. Wheels, blaster, eyes. One 8x8 arena frame with one dummy per challenge
 * (the dummy changes, the robot stays where it is): one in front, one at the side, one that needs a step first, one that walks in a
 * circle, one that walks to and fro and takes two hits. Each solution is the one before plus a few lines.
 */
export const CHAPTER_0 = chapter(0, [
  {
    id: 'first-contact',
    title: T('Erster Kontakt', 'First Contact'),
    catchLine: T('Der Code ist schon fertig.', 'The code is already written.'),
    enemies: [{ hp: 1 }],
    map: mk(8, 8, P, AHEAD),
    solution: S1,
    breaks: false,
    par: lineCount(S1),
  },
  {
    id: 'side-dummy',
    title: T('Von der Seite', 'From the Side'),
    catchLine: T('Die Attrappe steht rechts neben dir. Dreh dich.', 'The dummy stands to your right. Turn.'),
    enemies: [{ hp: 1 }],
    map: mk(8, 8, P, SIDE),
    solution: S2,
    par: lineCount(S2),
  },
  {
    id: 'move-and-turn',
    title: T('Erst fahren, dann drehen', 'Move, then Turn'),
    catchLine: T('Die Attrappe steht weiter oben. Fahr hin und dreh dich dann.', 'The dummy stands further up. Drive there, then turn.'),
    enemies: [{ hp: 1 }],
    map: mk(8, 8, P, FAR_SIDE),
    solution: S3,
    par: lineCount(S3),
  },
  {
    id: 'circle-dummy',
    title: T('Rundläufer', 'Circler'),
    catchLine: T('Die Attrappe läuft im Kreis. Schieß, wenn sie vorbeikommt.', 'The dummy walks in a circle. Shoot when it passes.'),
    enemies: [{ hp: 1, patrol: { dir: 'E', steps: 1, circle: true } }],
    map: mk(8, 8, P, CIRCLE),
    solution: S4,
    par: lineCount(S4),
  },
  {
    id: 'tough-walker',
    title: T('Zäher Läufer', 'Tough Walker'),
    catchLine: T('Die Attrappe läuft hin und her und hält 2 Treffer aus.', 'The dummy walks to and fro and takes 2 hits.'),
    enemies: [{ hp: 2, patrol: { dir: 'N', steps: 1 } }],
    map: mk(8, 8, P, WALKER),
    solution: S5,
    par: lineCount(S5),
  },
]);
