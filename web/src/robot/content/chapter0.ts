import { chapter, mk, T, wallCol } from './helpers.ts';

const P = (x = 3, y = 7): ['^', number, number] => ['^', x, y];
const wall = wallCol(3, 2, 4);

/** Chapter 0: calling functions, sequence. Wheels, blaster, eyes. One 8x8 arena frame; each solution extends the one before. */
export const CHAPTER_0 = chapter(0, [
  {
    id: 'first-contact',
    title: T('Erster Kontakt', 'First Contact'),
    catchLine: T('Der Code ist schon fertig: Starte den Kampf und schau zu.', 'The code is already written: press "Start fight" and watch.'),
    enemies: [{ hp: 1 }],
    map: mk(8, 8, P(), ['D', 3, 4]),
    solution: 'forward()\nfire()',
    breaks: false,
    par: 2,
  },
  {
    id: 'one-more-line',
    title: T('Eine Zeile mehr', 'One More Line'),
    catchLine: T('Diese Attrappe hält 2 Treffer aus.', 'This dummy takes 2 hits.'),
    enemies: [{ hp: 2 }],
    map: mk(8, 8, P(), ['D', 3, 4]),
    solution: 'forward()\nfire()\nfire()',
    par: 3,
  },
  {
    id: 'backstep-dummy',
    title: T('Rückwärts-Attrappe', 'Backstep Dummy'),
    catchLine: T('Die Attrappe steht direkt vor dir. Nimm keinen Schaden.', 'The dummy is right in front of you. Take no damage.'),
    enemies: [{ hp: 2, gear: ['hammer'], script: 'while True:\n    smash()' }],
    map: mk(8, 8, P(3, 5), ['D', 3, 4]),
    needs: { maxDamage: 0 },
    solution: 'backward()\nfire()\nfire()',
    side: true,
    breaks: false,
    par: 3,
  },
  {
    id: 'training-dummy',
    title: T('Übungsattrappe', 'Training Dummy'),
    catchLine: T('Die Attrappe steht weit weg: Der Blaster reicht nur 5 Felder.', 'The dummy stands far away: the blaster only reaches 5 tiles.'),
    enemies: [{ hp: 2 }],
    map: mk(8, 8, P(), ['D', 3, 0]),
    solution: 'forward()\nforward()\nfire()\nfire()',
    par: 4,
  },
  {
    id: 'corner-dummy',
    title: T('Eckattrappe', 'Corner Dummy'),
    catchLine: T('Die Attrappe steht rechts von dir, nicht geradeaus.', 'The dummy is to your right, not straight ahead.'),
    enemies: [{ hp: 2 }],
    map: mk(8, 8, P(), ['D', 7, 5]),
    solution: 'forward()\nforward()\nfire()\nfire()\nturn_right()\nfire()\nfire()',
    par: 7,
  },
  {
    id: 'u-turn',
    title: T('Wendemanöver', 'U-Turn'),
    catchLine: T('Die Attrappe steht links, aber du schaust nach rechts.', 'The dummy is on the left, but you look right.'),
    enemies: [{ hp: 2 }],
    map: mk(8, 8, P(), ['D', 0, 5]),
    solution: 'forward()\nforward()\nfire()\nfire()\nturn_right()\nfire()\nfire()\nturn_right()\nturn_right()\nfire()\nfire()',
    par: 11,
  },
  {
    id: 'twin-dummies',
    title: T('Zwillingsattrappen', 'Twin Dummies'),
    catchLine: T('Zwei Attrappen auf einmal, links und rechts.', 'Two dummies at once, left and right.'),
    enemies: [{ hp: 2 }],
    map: mk(8, 8, P(), ['D', 7, 5], ['D', 0, 5]),
    solution: 'forward()\nforward()\nfire()\nfire()\nturn_right()\nfire()\nfire()\nturn_right()\nturn_right()\nfire()\nfire()',
    breaks: false,
    par: 11,
  },
  {
    id: 'wall-dummy',
    title: T('Mauer-Attrappe', 'Wall Dummy'),
    catchLine: T('Eine Mauer versperrt den Weg; die Attrappe steht dahinter.', 'A wall blocks the way; the dummy stands behind it.'),
    enemies: [{ hp: 2 }],
    map: mk(8, 8, P(), ['D', 5, 0], ...wall),
    solution:
      'forward()\nforward()\nfire()\nfire()\nturn_right()\nfire()\nfire()\nturn_right()\nturn_right()\nfire()\nfire()\nturn_right()\nturn_right()\nforward()\nforward()\nturn_left()\nfire()\nfire()',
    par: 18,
  },
  {
    id: 'obstacle-course',
    title: T('Hindernisparcours', 'Obstacle Course'),
    catchLine: T('Boss: Drei zähe Attrappen (3 Treffer) an drei Orten, dazu die Mauer.', 'Boss: three tough dummies (3 hits) in three places, plus the wall.'),
    enemies: [{ hp: 3 }],
    map: mk(8, 8, P(), ['D', 7, 5], ['D', 0, 5], ['D', 5, 0], ...wall),
    solution:
      'forward()\nforward()\nfire()\nfire()\nfire()\nturn_right()\nfire()\nfire()\nfire()\nturn_right()\nturn_right()\nfire()\nfire()\nfire()\nturn_right()\nturn_right()\nforward()\nforward()\nturn_left()\nfire()\nfire()\nfire()',
    par: 22,
  },
]);
