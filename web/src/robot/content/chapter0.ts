import { chapter, lineCount, mk, T } from './helpers.ts';

type Item = [string, number, number];
/** The Chapter 0 frame: 8 wide, 5 high, the robot on the left edge looking east. */
const arena = (...items: Item[]) => mk(8, 5, ['>', 0, 2], ...items);
/** 6 tiles ahead: one tile out of the blaster's range, so the first command has to be forward(). */
const AHEAD: Item = ['D', 6, 2];
/** Beside the tile the robot stands on after forward(): it has to turn to it. */
const SIDE: Item = ['2', 1, 0];
/** Right under the start, behind a wall of two tiles: shots bounce off, the robot drives around. */
const BEHIND: Item = ['3', 0, 4];
const WALL: Item[] = [['#', 0, 3], ['#', 1, 3]];

/** Each solution is the one before plus new lines (the player keeps ONE script and extends it). */
const S1 = 'forward()\nfire()';
const S2 = `${S1}\nfire()`;
const S3 = `${S2}\nturn_left()\nfire()\nfire()\nfire()`;
/** Around the wall: east one tile, down column 2 to the bottom row, face west. */
const S4 = `${S3}\nturn_right()\nforward()\nturn_right()\nforward()\nforward()\nturn_right()\nfire()`;

/** Chapter 0: calling functions, one after the other. */
export const CHAPTER_0 = chapter(0, [
  {
    id: 'first-contact',
    title: T('Erster Kontakt', 'First Contact'),
    catchLine: T('Der Code ist schon fertig.', 'The code is already written.'),
    enemies: [{ hp: 1 }],
    map: arena(AHEAD),
    solution: S1,
    breaks: false,
    par: lineCount(S1),
  },
  {
    id: 'one-more-line',
    title: T('Eine Zeile mehr', 'One More Line'),
    catchLine: T('Diese Attrappe hält 2 Treffer aus.', 'This dummy takes 2 hits.'),
    enemies: [{ hp: 2 }],
    map: arena(AHEAD),
    solution: S2,
    par: lineCount(S2),
  },
  {
    id: 'training-dummy',
    title: T('Zweite Attrappe', 'Second Dummy'),
    catchLine: T('Links steht eine zweite, sie hält 3 Treffer aus.', 'A second one stands on the left and takes 3 hits.'),
    enemies: [{ hp: 2 }, { hp: 3 }],
    map: arena(AHEAD, SIDE),
    solution: S3,
    par: lineCount(S3),
  },
  {
    id: 'wall-dummy',
    title: T('Mauer-Attrappe', 'Wall Dummy'),
    catchLine: T('Die dritte steht hinter einer Mauer. Schüsse prallen ab: fahr drumherum.', 'The third is behind a wall. Shots bounce off: drive around it.'),
    enemies: [{ hp: 2 }, { hp: 3 }, { hp: 1 }],
    map: arena(AHEAD, SIDE, ...WALL, BEHIND),
    solution: S4,
    par: lineCount(S4),
  },
]);
