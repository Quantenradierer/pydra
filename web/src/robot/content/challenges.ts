import { T } from './helpers.ts';
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

/** Beat an old enemy under a rule. */
export interface Constraint extends Base {
  kind: 'constraint';
  enemy: string;
  /** At most this many lines of code. */
  maxLines?: number;
  /** Further rules (`without`, `noRepeatedNumber`, ...) and how they read to the player. */
  needs?: Needs;
  solution: string;
  /** A script that wins the enemy but breaks the rule (the tests check that it is refused). */
  violation?: string;
}

export type Challenge = Glitch | Constraint;

export const CHALLENGES: readonly Challenge[] = [
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
    enemy: 'twin-armor',
    needs: { noRepeatedNumber: true },
    solution: 'say("Hi")\nforward(4)\nforward(distance() - 1)\nfire()\nfire()\nfire()\nfire()\nfire()\nfire()\nturn_right()\nfire()\nfire()\nfire()\nfire()\nfire()\nfire()',
    violation: 'say("Hi")\nforward(4)\nforward(distance() - 1)\nfire()\nfire()\nfire()\nfire()\nfire()\nfire()\nturn_right()\nfire()\nfire()\nfire()\nfire()\nfire()\nfire()\nsay(4)',
  },
  // ---- Chapter 2
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
    enemy: 'maze-runner',
    maxLines: 8,
    needs: { without: ['for'] },
    solution: 'while alive():\n    if see() == "enemy":\n        fire()\n    elif see() == "wall" and distance() == 1:\n        turn_right()\n    else:\n        forward()',
    violation: 'for i in range(100):\n    if see() == "enemy":\n        fire()\n    elif see() == "wall" and distance() == 1:\n        turn_right()\n    else:\n        forward()',
  },
];
