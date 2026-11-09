import { chapter, lineCount, mk, T } from './helpers.ts';

/** The Chapter 4 frame: an open hall 8 wide and 14 tall, the robot at (3, 12) looking north. Things are added one by one. */
const hall = (...items: [string, number, number][]) => mk(8, 14, ['^', 3, 12], ...items);
const FAR: [string, number, number] = ['D', 3, 5];
const HEALER: [string, number, number] = ['2', 3, 2];
const SIDE: [string, number, number] = ['3', 0, 10];

const REGEN = { hp: 6, regen: { every: 2, amount: 1 } };

/** Each solution is the one before plus new lines. */
const S1 = 'while see() != "enemy":\n    forward()\nfire()\nfire()';
const S2 = `${S1}\nforward(3)\nwhile alive():\n    fire()`;
const S3 = S2.replace('while alive():', 'n = 5\nwhile n > 0:\n    say(n)\n    fire()\n    n = n - 1\nsay("Liftoff!")\nwhile alive():');
const S4 = S3.replace('forward(3)', 'turn_left()\nwhile see() == "enemy":\n    fire()\nturn_right()\nforward(3)');
const S5 = S4.replace('forward(3)', 'while True:\n    if see() == "enemy":\n        break\n    forward()\nforward(3)');

/** Chapter 4: while loops and booleans. One open hall; every challenge adds ONE thing, and its solution is the one before plus new lines. */
export const CHAPTER_4 = chapter(4, [
  {
    id: 'far-far-dummy',
    title: T('Ganz-weit-weg-Attrappe', 'Far-Far Dummy'),
    catchLine: T('Die Attrappe steht weit weg. Geh, bis du sie siehst.', 'The dummy stands far away. Walk until you see it.'),
    enemies: [{ hp: 2 }],
    map: hall(FAR),
    solution: S1,
    par: lineCount(S1),
  },
  {
    id: 'regenerator',
    title: T('Regenerator', 'Regenerator'),
    catchLine: T('Dahinter heilt sich ein Gegner alle zwei Runden um 1 Leben.', 'Behind it, an enemy heals 1 HP every two rounds.'),
    enemies: [{ hp: 2 }, REGEN],
    map: hall(FAR, HEALER),
    solution: S2,
    par: lineCount(S2),
  },
  {
    id: 'countdown',
    title: T('Countdown', 'Countdown'),
    catchLine: T('Zähl von 5 herunter, schieß, sag am Ende „Liftoff!“. Ohne for.', 'Count down from 5, shoot, say "Liftoff!" at the end. No for.'),
    enemies: [{ hp: 2 }, REGEN],
    map: hall(FAR, HEALER),
    needs: { sayOnce: 'Liftoff!', uses: ['while'], without: ['for'] },
    solution: S3,
    par: lineCount(S3),
  },
  {
    id: 'side-guard',
    title: T('Seitenwache', 'Side Guard'),
    catchLine: T('Links, weit weg, steht noch einer. Schieß, solange du ihn siehst.', 'Far to the left stands one more enemy. Shoot while you see it.'),
    enemies: [{ hp: 2 }, REGEN, { hp: 2 }],
    map: hall(FAR, HEALER, SIDE),
    needs: { sayOnce: 'Liftoff!', uses: ['while'], without: ['for'] },
    solution: S4,
    par: lineCount(S4),
  },
  {
    id: 'break-out',
    title: T('Ausbruch', 'Break Out'),
    catchLine: T('Schreib eine Endlosschleife und verlass sie mit break.', 'Write an endless loop and leave it with break.'),
    enemies: [{ hp: 2 }, REGEN, { hp: 2 }],
    map: hall(FAR, HEALER, SIDE),
    needs: { sayOnce: 'Liftoff!', uses: ['while True', 'break'], without: ['for'] },
    solution: S5,
    par: lineCount(S5),
  },
]);
