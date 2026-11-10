import { chapter, lineCount, mk, T } from './helpers.ts';

type Item = [string, number, number];
/** The Chapter 1 frame: 9 wide, 5 high, the robot on the left edge looking east. */
const arena = (...items: Item[]) => mk(9, 5, ['>', 0, 2], ...items);
/** 7 tiles ahead (the blaster reaches 5), the tank right behind it. */
const FAR: Item = ['D', 7, 2];
const TANK: Item = ['2', 8, 2];

/** Its shield is down for 1 round, then up for 2, forever: a beat the loop can follow. */
const BEAT_SHIELD = { up: 2, down: 1 };

const S1 = 'forward(3)\nfire()\nfire()';
const S2 = `${S1}\nfor i in range(5):\n    fire()`;
/** The loop starts on round 5; the shield is down on rounds 6, 9, 12, ...: wait, fire, wait. */
const S3 = S2.replace('    fire()', '    wait()\n    fire()\n    wait()');

/** Chapter 1: numbers as arguments and for loops. Shorter code is the point, so every challenge has a line limit. */
export const CHAPTER_1 = chapter(1, [
  {
    id: 'long-way',
    title: T('Weit weg', 'Far Away'),
    catchLine: T('Zu weit weg: Der Blaster reicht 5 Felder. Höchstens 3 Zeilen.', 'Too far away: the blaster reaches 5 tiles. At most 3 lines.'),
    enemies: [{ hp: 2 }],
    map: arena(FAR),
    needs: { maxLines: 3 },
    solution: S1,
    par: lineCount(S1),
  },
  {
    id: 'tank',
    title: T('Panzer', 'Tank'),
    catchLine: T('Dahinter steht ein Panzer mit 5 Leben. Höchstens 5 Zeilen: nimm for.', 'A tank with 5 HP stands behind it. At most 5 lines: use for.'),
    enemies: [{ hp: 2 }, { hp: 5 }],
    map: arena(FAR, TANK),
    needs: { maxLines: 5 },
    solution: S2,
    par: lineCount(S2),
  },
  {
    id: 'beat',
    title: T('Taktschild', 'Beat Shield'),
    catchLine: T('Sein Schild: 1 Runde unten, 2 oben. Kein Fehlschuss, höchstens 7 Zeilen.', 'Its shield: down 1 round, up 2. No missed shot, at most 7 lines.'),
    enemies: [{ hp: 2 }, { hp: 5, shieldCycle: BEAT_SHIELD }],
    map: arena(FAR, TANK),
    needs: { maxLines: 7, noMiss: true },
    solution: S3,
    par: lineCount(S3),
  },
]);
