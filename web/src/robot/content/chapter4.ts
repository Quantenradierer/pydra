import { chapter, lineCount, mk, T } from './helpers.ts';

/** The robot stands in the middle of a 7x5 arena looking east: one enemy ahead, one to the left, one behind its right shoulder. */
const MAP = mk(7, 5, ['>', 3, 2], ['D', 6, 2], ['2', 3, 0], ['3', 3, 4]);

const ATTACK = 'def attack():\n    while see() == "enemy":\n        if enemy_shielded():\n            wait()\n        else:\n            fire()';
const S1 = `${ATTACK}\nattack()\nturn_left()\nattack()\nturn_left()\nturn_left()\nattack()`;

/** Chapter 4: functions. The same six lines beat every enemy here, so they are written once and called three times. */
export const CHAPTER_4 = chapter(4, [
  {
    id: 'drill',
    title: T('Rundumschlag', 'All Around'),
    catchLine: T('Zwei Schilde, ein Heiler. Kein Fehlschuss, höchstens 12 Zeilen: def.', 'Two shields, one healer. No missed shot, at most 12 lines: def.'),
    enemies: [
      { hp: 2, shieldCycle: { up: 2, down: 1 } },
      { hp: 3, shieldCycle: { up: 1, down: 1 } },
      { hp: 4, regen: { every: 2, amount: 1 } },
    ],
    map: MAP,
    needs: { noMiss: true, maxLines: 12 },
    solution: S1,
    par: lineCount(S1),
  },
]);
