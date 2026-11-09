import { mk, T } from './helpers.ts';
import type { Needs, Text } from './types.ts';

/** Where a challenge sits in the order: after this step (an enemy id), so it is offered once that enemy is solved. */
interface Base {
  id: string;
  after: string;
  title: Text;
  prompt: Text;
}

/** A bug in the script; fix it so the script beats the enemy. The bug is injected into the player's own script when it has the pattern. */
export interface Glitch extends Base {
  kind: 'glitch';
  enemy: string;
  /** The bug to inject: from -> to, applied to the first match in the player's script. */
  bug: { from: string; to: string };
  /** Used when the player's script has no `from`. */
  fallback: string;
}

/** Solve a small puzzle in a separate script, without an enemy: paint the target pattern. */
export interface Workshop extends Base {
  kind: 'workshop';
  map: string[];
  /** Tiles to paint, "x,y". Exactly these. */
  target: string[];
  solution: string;
}

/** Beat an old enemy under a rule. */
export interface Constraint extends Base {
  kind: 'constraint';
  enemy: string;
  /** At most this many lines of code. */
  maxLines?: number;
  /** Further rules (`without`, `noRepeatedNumber`, ...) and how they read to the player. */
  needs?: Needs;
  rule?: Text;
  solution: string;
  /** A script that wins the enemy but breaks the rule (the tests check that it is refused). */
  violation?: string;
}

export type Challenge = Glitch | Workshop | Constraint;

const square = (x: number, y: number, size: number): string[] => {
  const out: string[] = [];
  for (let i = 0; i <= size; i++) out.push(`${x + i},${y}`, `${x + i},${y + size}`, `${x},${y + i}`, `${x + size},${y + i}`);
  return [...new Set(out)];
};

/** Hp-99 dummy in the corner so a workshop run never ends early. */
const far = (...items: [string, number, number][]) => mk(8, 8, ['D', 7, 0], ...items);

export const CHALLENGES: readonly Challenge[] = [
  // ---- Chapter 0: write a script that paints
  {
    kind: 'workshop',
    id: 'ws-step',
    after: 'training-dummy',
    title: T('Werkstatt: Drei Felder', 'Workshop: Three tiles'),
    prompt: T('Male die drei Felder (3, 7), (3, 6) und (3, 5). Der Roboter startet bei (3, 7) und schaut nach oben. Mit brush.down() setzt du den Pinsel auf.', 'Paint the three tiles (3, 7), (3, 6) and (3, 5). The robot starts at (3, 7) looking up. brush.down() puts the brush down.'),
    map: far(['^', 3, 7]),
    target: ['3,7', '3,6', '3,5'],
    solution: 'brush.down()\nforward()\nforward()',
  },
  {
    kind: 'workshop',
    id: 'ws-corner',
    after: 'u-turn',
    title: T('Werkstatt: Um die Ecke', 'Workshop: Around the corner'),
    prompt: T('Male einen Winkel: (3, 7), (3, 6), (3, 5), dann nach rechts (4, 5) und (5, 5).', 'Paint an angle: (3, 7), (3, 6), (3, 5), then to the right (4, 5) and (5, 5).'),
    map: far(['^', 3, 7]),
    target: ['3,7', '3,6', '3,5', '4,5', '5,5'],
    solution: 'brush.down()\nforward()\nforward()\nturn_right()\nforward()\nforward()',
  },
  {
    kind: 'glitch',
    id: 'gl-foward',
    after: 'one-more-line',
    title: T('Fehlersuche: Tippfehler', 'Bug hunt: Typo'),
    prompt: T('In deinem Code hat sich ein Fehler eingeschlichen: forward() ist plötzlich anders geschrieben. Finde und behebe ihn.', 'A bug crept into your code: forward() is spelled differently. Find and fix it.'),
    enemy: 'one-more-line',
    bug: { from: 'forward()', to: 'foward()' },
    fallback: 'foward()\nfire()\nfire()',
  },
  {
    kind: 'glitch',
    id: 'gl-parens',
    after: 'training-dummy',
    title: T('Fehlersuche: Klammern', 'Bug hunt: Brackets'),
    prompt: T('fire hat keine Klammern mehr, der Roboter schießt nicht. Behebe den Fehler.', 'fire lost its brackets and the robot does not shoot. Fix it.'),
    enemy: 'training-dummy',
    bug: { from: 'fire()', to: 'fire' },
    fallback: 'forward()\nforward()\nfire\nfire()',
  },
  {
    kind: 'glitch',
    id: 'gl-indent',
    after: 'tank-dummy',
    title: T('Fehlersuche: Einrückung', 'Bug hunt: Indentation'),
    prompt: T('Eine Zeile in der Schleife ist nicht mehr eingerückt. Behebe den Fehler.', 'A line inside the loop lost its indentation. Fix it.'),
    enemy: 'tank-dummy',
    bug: { from: '    fire()', to: 'fire()' },
    fallback: 'forward(4)\nfor i in range(5):\nfire()',
  },
  {
    kind: 'workshop',
    id: 'ws-square',
    after: 'wall-dummy',
    title: T('Werkstatt: Quadrat malen', 'Workshop: Draw a square'),
    prompt: T('Male mit dem Pinsel ein Quadrat aus 3 × 3 Feldern (nur der Rand). Der Roboter startet unten links bei (1, 6). brush.down() setzt den Pinsel auf.', 'Draw a square of 3 × 3 tiles (just the outline) with the brush. The robot starts at the bottom left, (1, 6). brush.down() puts the brush down.'),
    map: far(['^', 1, 6]),
    target: square(1, 4, 2),
    solution: 'brush.down()\nforward()\nforward()\nturn_right()\nforward()\nforward()\nturn_right()\nforward()\nforward()\nturn_right()\nforward()\nforward()',
  },
  {
    kind: 'workshop',
    id: 'ws-line',
    after: 'twin-armor',
    title: T('Werkstatt: Gestrichelte Linie', 'Workshop: Dashed line'),
    prompt: T('Male jedes zweite Feld in der Spalte nach oben: (3, 7), (3, 5), (3, 3). Mit brush.up() hebst du den Pinsel an.', 'Paint every second tile up the column: (3, 7), (3, 5), (3, 3). brush.up() lifts the brush.'),
    map: far(['^', 3, 7]),
    target: ['3,7', '3,5', '3,3'],
    solution: 'brush.down()\nbrush.up()\nforward()\nforward()\nbrush.down()\nbrush.up()\nforward()\nforward()\nbrush.down()',
  },
  {
    kind: 'constraint',
    id: 'cn-row-3',
    after: 'dummy-row',
    title: T('Sonderregel: Attrappenreihe in 3 Zeilen', 'Special rule: Dummy Row in 3 lines'),
    prompt: T('Schlage die Attrappenreihe noch einmal, aber mit höchstens 3 Zeilen Code.', 'Beat the Dummy Row again, but with at most 3 lines of code.'),
    enemy: 'dummy-row',
    maxLines: 3,
    solution: 'forward(4)\nfor i in range(10):\n    fire()',
  },
  {
    kind: 'constraint',
    id: 'cn-tank-3',
    after: 'tank-dummy',
    title: T('Sonderregel: Panzer-Attrappe in 3 Zeilen', 'Special rule: Tank Dummy in 3 lines'),
    prompt: T('Schlage die Panzer-Attrappe noch einmal, aber mit höchstens 3 Zeilen Code.', 'Beat the Tank Dummy again, but with at most 3 lines of code.'),
    enemy: 'tank-dummy',
    maxLines: 3,
    solution: 'forward(4)\nfor i in range(5):\n    fire()',
  },
  // ---- Chapter 0
  // ---- Chapter 1
  {
    kind: 'glitch',
    id: 'gl-variable',
    after: 'sign-dummy',
    title: T('Fehlersuche: Falsch geschriebene Variable', 'Bug hunt: Misspelled variable'),
    prompt: T('Eine Variable ist an einer Stelle anders geschrieben als bei ihrer Erfindung. Finde sie.', 'A variable is spelled differently from where it was created. Find it.'),
    enemy: 'sign-dummy',
    bug: { from: 'forward(steps)', to: 'forward(step)' },
    fallback: 'steps = distance() - 1\nforward(4)\nforward(step)\nfire()',
  },
  {
    kind: 'glitch',
    id: 'gl-text-plus-number',
    after: 'name-tag',
    title: T('Fehlersuche: Text plus Zahl', 'Bug hunt: Text plus number'),
    prompt: T('Der Roboter stürzt ab, weil Text und Zahl nicht einfach addiert werden können. Finde die Stelle.', 'The robot crashes because text and a number cannot simply be added. Find the spot.'),
    enemy: 'name-tag',
    bug: { from: 'str(d)', to: 'd' },
    fallback: 'd = distance()\nsay("Distance: " + d)',
  },
  {
    kind: 'constraint',
    id: 'cn-no-repeat',
    after: 'twin-armor',
    title: T('Sonderregel: Keine Zahl zweimal', 'Special rule: No number twice'),
    prompt: T('Schlage die Doppelpanzer noch einmal, aber keine Zahl darf zweimal im Code stehen.', 'Beat Twin Armor again, but no number may be written twice in the code.'),
    rule: T('Regel: Keine Zahl steht zweimal im Code. Gib ihr einen Namen.', 'Rule: no number is written twice in the code. Give it a name.'),
    enemy: 'twin-armor',
    needs: { noRepeatedNumber: true },
    solution: 'say("Hi")\nforward(4)\nforward(distance() - 1)\nfire()\nfire()\nfire()\nfire()\nfire()\nfire()\nturn_right()\nfire()\nfire()\nfire()\nfire()\nfire()\nfire()',
    violation: 'say("Hi")\nforward(4)\nforward(distance() - 1)\nfire()\nfire()\nfire()\nfire()\nfire()\nfire()\nturn_right()\nfire()\nfire()\nfire()\nfire()\nfire()\nfire()\nsay(4)',
  },
  // ---- Chapter 2
  {
    kind: 'workshop',
    id: 'ws-stairs',
    after: 'staircase',
    title: T('Werkstatt: Treppe malen', 'Workshop: Draw stairs'),
    prompt: T('Male mit dem Pinsel drei Treppenstufen: hoch, rechts, hoch, rechts … Der Roboter startet bei (1, 6) und schaut nach oben.', 'Draw three steps with the brush: up, right, up, right … The robot starts at (1, 6) looking up.'),
    map: far(['^', 1, 6]),
    target: ['1,6', '1,5', '2,5', '2,4', '3,4', '3,3', '4,3'],
    solution: 'brush.down()\nfor i in range(3):\n    forward()\n    turn_right()\n    forward()\n    turn_left()',
  },
  {
    kind: 'workshop',
    id: 'ws-spiral',
    after: 'spiral-hallway',
    title: T('Werkstatt: Spirale malen', 'Workshop: Draw a spiral'),
    prompt: T('Male eine Spirale: erst 1 Feld, dann 2, 3, 4, nach jedem Stück rechts abbiegen. Start bei (3, 4), Blick nach oben.', 'Draw a spiral: 1 tile, then 2, 3, 4, turning right after each piece. Start at (3, 4) looking up.'),
    map: far(['^', 3, 4]),
    target: ['3,4', '3,3', '4,3', '5,3', '5,4', '5,5', '5,6', '4,6', '3,6', '2,6', '1,6'],
    solution: 'brush.down()\nfor i in range(1, 5):\n    forward(i)\n    turn_right()',
  },
  {
    kind: 'glitch',
    id: 'gl-indent-2',
    after: 'double-loop',
    title: T('Fehlersuche: Eingerückt zu weit', 'Bug hunt: Indented too far'),
    prompt: T('Eine Zeile gehört nicht in die Schleife, steht aber eingerückt darin. Behebe den Fehler.', 'A line does not belong in the loop but is indented inside it. Fix it.'),
    enemy: 'double-loop',
    bug: { from: '    fire()\nturn_right()', to: '    fire()\n    turn_right()' },
    fallback: 'shots = 12\nforward(4)\nfor i in range(shots):\n    fire()\n    turn_right()\nfor i in range(shots):\n    fire()',
  },
  {
    kind: 'constraint',
    id: 'cn-double-5',
    after: 'double-loop',
    title: T('Sonderregel: Doppelschleife in 5 Zeilen', 'Special rule: Double Loop in 5 lines'),
    prompt: T('Schlage die Doppelschleife noch einmal, aber mit höchstens 5 Zeilen Code. Eine Schleife in der Schleife hilft.', 'Beat the Double Loop again, but with at most 5 lines of code. A loop inside a loop helps.'),
    enemy: 'double-loop',
    maxLines: 5,
    solution: 'forward(4)\nfor side in range(2):\n    for i in range(12):\n        fire()\n    turn_right()',
  },
  // ---- Chapter 3
  {
    kind: 'glitch',
    id: 'gl-equals',
    after: 'peekaboo',
    title: T('Fehlersuche: = oder ==', 'Bug hunt: = or =='),
    prompt: T('In einer Bedingung steht ein einzelnes =. Zum Vergleichen brauchst du zwei.', 'A condition has a single =. To compare you need two.'),
    enemy: 'peekaboo',
    bug: { from: ' == "enemy"', to: ' = "enemy"' },
    fallback: 'if see() = "enemy":\n    fire()\n    fire()\nelse:\n    turn_right()\n    fire()\n    fire()',
  },
  {
    kind: 'glitch',
    id: 'gl-colon',
    after: 'bubble',
    title: T('Fehlersuche: Doppelpunkt fehlt', 'Bug hunt: Missing colon'),
    prompt: T('Hinter einer Bedingung oder Schleife fehlt der Doppelpunkt. Finde die Zeile.', 'A colon is missing after a condition or loop. Find the line.'),
    enemy: 'bubble',
    bug: { from: ':\n', to: '\n' },
    fallback: 'for i in range(8):\n    if see() == "enemy"\n        fire()',
  },
  {
    kind: 'workshop',
    id: 'ws-zebra',
    after: 'not-today',
    title: T('Werkstatt: Zebrastreifen', 'Workshop: Zebra crossing'),
    prompt: T('Male Streifen die Spalte hoch: Pinsel runter, wenn i % 3 == 0 ist, sonst hoch. Start (3, 7), Blick nach oben.', 'Paint stripes up the column: brush down when i % 3 == 0, otherwise up. Start at (3, 7), looking up.'),
    map: far(['^', 3, 7]),
    target: ['3,7', '3,6', '3,4', '3,3', '3,1', '3,0'],
    solution: 'for i in range(7):\n    if i % 3 == 0:\n        brush.down()\n    else:\n        brush.up()\n    forward()',
  },
  // ---- Chapter 4
  {
    kind: 'glitch',
    id: 'gl-infinite',
    after: 'far-far-dummy',
    title: T('Fehlersuche: Endlosschleife', 'Bug hunt: Endless loop'),
    prompt: T('Der Roboter dreht sich im Kreis, ohne weiterzukommen: In der while-Schleife passiert nichts, das die Bedingung ändert. Behebe es.', 'The robot gets nowhere: nothing in the while loop changes the condition. Fix it.'),
    enemy: 'far-far-dummy',
    bug: { from: '    forward()', to: '    wait()' },
    fallback: 'while see() != "enemy":\n    wait()\nfire()\nfire()',
  },
  {
    kind: 'constraint',
    id: 'cn-maze-no-for',
    after: 'maze-runner',
    title: T('Sonderregel: Labyrinth ohne for', 'Special rule: Maze without for'),
    prompt: T('Schlage den Labyrinthläufer noch einmal, ohne ein einziges for und mit höchstens 8 Zeilen.', 'Beat the Maze Runner again without a single for, in at most 8 lines.'),
    rule: T('Regel: kein for im Code.', 'Rule: no for in the code.'),
    enemy: 'maze-runner',
    maxLines: 8,
    needs: { without: ['for'] },
    solution: 'while alive():\n    if see() == "enemy":\n        fire()\n    elif see() == "wall" and distance() == 1:\n        turn_right()\n    else:\n        forward()',
    violation: 'for i in range(100):\n    if see() == "enemy":\n        fire()\n    elif see() == "wall" and distance() == 1:\n        turn_right()\n    else:\n        forward()',
  },
];
