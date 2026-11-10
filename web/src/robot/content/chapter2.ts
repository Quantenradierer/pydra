import { chapter, lineCount, mk, T } from './helpers.ts';

type Item = [string, number, number];
/** The Chapter 2 frame: 8 wide, 5 high, the robot on the left edge looking east. */
const arena = (...items: Item[]) => mk(8, 5, ['>', 0, 2], ...items);
/** Where the walker starts: it walks down column 4, rows 0 to 3, and back. It is in the robot's row on rounds 2, 4, 8, 10, 14, 16, ... */
const WALK: Item = ['D', 4, 0];
/** Two tiles to the left of the robot. */
const LEFT: Item = ['2', 0, 0];

const WALKER = { hp: 2, patrol: { dir: 'S' as const, steps: 3 } };
/** Heals 1 HP every 2 rounds: one shot per round gets it down, a shot every other round never does. */
const REGENERATOR = { hp: 3, regen: { every: 2, amount: 1 } };
/** The walker with a shield that is down 2 rounds and up 1: a rhythm of 3 next to the walk of 6. */
const FLICKER = { ...WALKER, shieldCycle: { up: 1, down: 2 } };

const S1 = 'for i in range(40):\n    if see() == "enemy":\n        fire()\n    else:\n        wait()';
const S2 = S1.replace('    else:', '    elif see_left() == "enemy":\n        turn_left()\n    elif see_right() == "enemy":\n        turn_right()\n    else:');
const S3 = S2.replace('        fire()', '        if enemy_shielded():\n            wait()\n        else:\n            fire()');

/** Chapter 2: if / elif / else. The robot has to look before it shoots: no shot may miss. */
export const CHAPTER_2 = chapter(2, [
  {
    id: 'patrol',
    title: T('Streife', 'Patrol'),
    catchLine: T('Er läuft auf und ab. Kein Schuss darf danebengehen: nimm if und else.', 'It walks up and down. No shot may miss: use if and else.'),
    enemies: [WALKER],
    map: arena(WALK),
    needs: { noMiss: true },
    solution: S1,
    par: lineCount(S1),
  },
  {
    id: 'flank',
    title: T('Flanke', 'Flank'),
    catchLine: T('Links heilt sich einer jede zweite Runde. Dreh dich zu ihm: elif.', 'On the left one heals every other round. Turn to it: elif.'),
    enemies: [WALKER, REGENERATOR],
    map: arena(WALK, LEFT),
    needs: { noMiss: true },
    solution: S2,
    par: lineCount(S2),
  },
  {
    id: 'flicker',
    title: T('Flackerschild', 'Flicker Shield'),
    catchLine: T('Der Läufer hat jetzt ein Schild im eigenen Takt. Kein Fehlschuss.', 'The walker now has a shield with its own rhythm. No missed shot.'),
    enemies: [FLICKER, REGENERATOR],
    map: arena(WALK, LEFT),
    needs: { noMiss: true },
    solution: S3,
    par: lineCount(S3),
  },
]);
