import { chapter, lineCount, mk, T } from './helpers.ts';

type Item = [string, number, number];
/** The Chapter 3 frame: a hall 10 wide and 5 high, the robot on the left edge looking east. */
const hall = (...items: Item[]) => mk(10, 5, ['>', 0, 2], ...items);
/** The walker steps between columns 7 and 8 of the robot's row: 7, 8, 7, 8, ... */
const WALK: Item = ['D', 7, 2];
/** At the end of the hall, behind the walker. */
const END: Item = ['2', 9, 2];
/** In the top row, two columns past the tile the robot shoots the healer from (4, 2). */
const TOP: Item = ['3', 6, 0];

const walker = (hp: number) => ({ hp, patrol: { dir: 'E' as const, steps: 1 } });
const HEALER = { hp: 4, regen: { every: 2, amount: 1 } };
/** Looks down its column and shoots at whatever it sees there. */
const SNIPER = { hp: 3, face: 'S' as const, script: 'while True:\n    if see() == "enemy":\n        fire()\n    else:\n        wait()' };

const S1 = 'while see() != "enemy":\n    forward()\nfire()';
/** The first shot hits the walker at 5 tiles; it steps back out of range, so the robot has to drive on before the second. */
const S2 = 'for i in range(2):\n    while see() != "enemy":\n        forward()\n    fire()';
const S3 = `${S2}\nwhile see() != "enemy":\n    forward()\nwhile see() == "enemy":\n    fire()`;
const S4 = `${S3}\nwhile see_left() != "enemy":\n    forward()\nturn_left()\nfor k in range(3):\n    fire()`;

/** Chapter 3: while loops. Nobody tells the robot how far to drive or how often to shoot: it looks. */
export const CHAPTER_3 = chapter(3, [
  {
    id: 'scout',
    title: T('Späher', 'Scout'),
    catchLine: T('Er ist außer Reichweite. Fahr, bis du ihn siehst: while. Kein Fehlschuss.', 'It is out of range. Drive until you see it: while. No missed shot.'),
    enemies: [walker(1)],
    map: hall(WALK),
    needs: { noMiss: true, uses: ['while'] },
    solution: S1,
    par: lineCount(S1),
  },
  {
    id: 'twice',
    title: T('Zweimal', 'Twice'),
    catchLine: T('Er hat 2 Leben und läuft dir wieder aus der Reichweite. Kein Fehlschuss.', 'It has 2 HP and walks out of range again. No missed shot.'),
    enemies: [walker(2)],
    map: hall(WALK),
    needs: { noMiss: true, uses: ['while'] },
    solution: S2,
    par: lineCount(S2),
  },
  {
    id: 'healer',
    title: T('Heiler', 'Healer'),
    catchLine: T('Am Ende der Halle heilt sich einer. Schieß, solange du ihn siehst.', 'At the end of the hall one heals itself. Shoot while you see it.'),
    enemies: [walker(2), HEALER],
    map: hall(WALK, END),
    solution: S3,
    par: lineCount(S3),
  },
  {
    id: 'sniper',
    title: T('Scharfschütze', 'Sniper'),
    catchLine: T('Oben wartet ein Schütze: Er schießt zurück, sobald er dich sieht.', 'A gunner waits at the top: it shoots back as soon as it sees you.'),
    enemies: [walker(2), HEALER, SNIPER],
    map: hall(WALK, END, TOP),
    solution: S4,
    par: lineCount(S4),
  },
]);
