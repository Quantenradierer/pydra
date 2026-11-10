import { chapter, lineCount, mk, T } from './helpers.ts';

/** The Chapter 4 frame: an open hall 8 wide and 14 tall, the robot at (3, 12) looking north. Things are added one by one. */
const hall = (...items: [string, number, number][]) => mk(8, 14, ['^', 3, 12], ...items);
const FAR: [string, number, number] = ['D', 3, 5];
const HEALER: [string, number, number] = ['2', 3, 2];
const SIDE: [string, number, number] = ['3', 0, 10];
/** Where the patroller starts: it walks down column 6, rows 9 to 11, and back. */
const PATROL: [string, number, number] = ['4', 6, 9];

const REGEN = { hp: 4, regen: { every: 2, amount: 1 } };
/** Walks 2 tiles down column 6 and 2 back (a round trip of 4 rounds). */
const PATROLLER = { hp: 2, face: 'W' as const, patrol: { dir: 'S' as const, steps: 2 } };
/** The same walker with a shield of its own: 2 rounds down, 1 up (a rhythm of 3 rounds, not the 4 of the walk). */
const FLICKER = { ...PATROLLER, shieldCycle: { up: 1, down: 2 } };

/** Each solution is the one before plus new lines. */
const S1 = 'while see() != "enemy":\n    forward()\nfire()';
const S2 = `${S1}\nforward(3)\nwhile alive():\n    fire()`;
const S3 = S2.replace('while alive():', 'n = 5\nwhile n > 0:\n    say(n)\n    fire()\n    n = n - 1\nsay("Liftoff!")\nwhile alive():');
const S4 = S3.replace('forward(3)', 'turn_left()\nwhile see() == "enemy":\n    fire()\nturn_right()\nforward(3)');
const S5 = S4.replace('forward(3)', 'while True:\n    if see() == "enemy":\n        break\n    forward()\nforward(3)');
const S6 = S5.replace('turn_right()', 'turn_right()\nturn_right()\nshots = 0\nwhile shots < 2:\n    if see() == "enemy":\n        fire()\n        shots = shots + 1\n    else:\n        wait()\nturn_left()');
const S7 = S6.replace('        fire()\n        shots = shots + 1\n', '        if not enemy_shielded():\n            fire()\n            shots = shots + 1\n        else:\n            wait()\n');

/** Chapter 4: while loops and booleans. One open hall; every challenge adds ONE thing, and its solution is the one before plus new lines. */
export const CHAPTER_4 = chapter(4, [
  {
    id: 'far-far-dummy',
    title: T('Ganz-weit-weg-Attrappe', 'Far-Far Dummy'),
    catchLine: T('Die Attrappe steht weit weg. Geh, bis du sie siehst.', 'The dummy stands far away. Walk until you see it.'),
    enemies: [{ hp: 1 }],
    map: hall(FAR),
    solution: S1,
    par: lineCount(S1),
  },
  {
    id: 'regenerator',
    title: T('Regenerator', 'Regenerator'),
    catchLine: T('Dahinter heilt sich ein Gegner alle zwei Runden um 1 Leben.', 'Behind it, an enemy heals 1 HP every two rounds.'),
    enemies: [{ hp: 1 }, REGEN],
    map: hall(FAR, HEALER),
    solution: S2,
    par: lineCount(S2),
  },
  {
    id: 'countdown',
    title: T('Countdown', 'Countdown'),
    catchLine: T('Zähl von 5 herunter, schieß, sag am Ende „Liftoff!“. Ohne for.', 'Count down from 5, shoot, say "Liftoff!" at the end. No for.'),
    enemies: [{ hp: 1 }, REGEN],
    map: hall(FAR, HEALER),
    needs: { sayOnce: 'Liftoff!', uses: ['while'], without: ['for'] },
    solution: S3,
    par: lineCount(S3),
  },
  {
    id: 'side-guard',
    title: T('Seitenwache', 'Side Guard'),
    catchLine: T('Links, weit weg, steht noch einer. Schieß, solange du ihn siehst.', 'Far to the left stands one more enemy. Shoot while you see it.'),
    enemies: [{ hp: 1 }, REGEN, { hp: 3 }],
    map: hall(FAR, HEALER, SIDE),
    needs: { sayOnce: 'Liftoff!', uses: ['while'], without: ['for'] },
    solution: S4,
    par: lineCount(S4),
  },
  {
    id: 'break-out',
    title: T('Ausbruch', 'Break Out'),
    catchLine: T('Schreib eine Endlosschleife und verlass sie mit break.', 'Write an endless loop and leave it with break.'),
    enemies: [{ hp: 1 }, REGEN, { hp: 3 }],
    map: hall(FAR, HEALER, SIDE),
    needs: { sayOnce: 'Liftoff!', uses: ['while True', 'break'], without: ['for'] },
    solution: S5,
    par: lineCount(S5),
  },
  {
    id: 'patroller',
    title: T('Patrouille', 'Patrol'),
    catchLine: T('Rechts patrouilliert ein Gegner. Kein Schuss darf danebengehen.', 'An enemy patrols on the right. No shot may miss.'),
    enemies: [{ hp: 1 }, REGEN, { hp: 3 }, PATROLLER],
    map: hall(FAR, HEALER, SIDE, PATROL),
    needs: { sayOnce: 'Liftoff!', uses: ['while True', 'break'], without: ['for'], noMiss: true },
    solution: S6,
    par: lineCount(S6),
  },
  {
    id: 'flicker',
    title: T('Flackerschild', 'Flicker Shield'),
    catchLine: T('Sein Schild flackert im eigenen Takt. Kein Schuss daneben.', 'Its shield flickers at its own pace. No shot may miss.'),
    enemies: [{ hp: 1 }, REGEN, { hp: 3 }, FLICKER],
    map: hall(FAR, HEALER, SIDE, PATROL),
    needs: { sayOnce: 'Liftoff!', uses: ['while True', 'break'], without: ['for'], noMiss: true },
    solution: S7,
    par: lineCount(S7),
  },
]);
