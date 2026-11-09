import { T } from './helpers.ts';
import type { Needs, Text } from './types.ts';

/** Where a challenge sits in the order: after this step (an enemy id), so it is offered once that enemy is solved. */
interface Base {
  id: string;
  after: string;
  title: Text;
}

/** The one line a bug hunt shows: it says nothing about the bug. */
export const GLITCH_PROMPT: Text = T('Das Skript hat einen Fehler. Finde ihn.', 'The script has a bug. Find it.');

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
  /** The rule in one short sentence. */
  prompt: Text;
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
    title: T('Fehlersuche', 'Bug hunt'),
    enemy: 'one-more-line',
    bug: { from: 'forward()', to: 'foward()' },
    fallback: 'foward()\nfire()\nfire()',
  },
  {
    kind: 'glitch',
    id: 'gl-parens',
    after: 'training-dummy',
    title: T('Fehlersuche', 'Bug hunt'),
    enemy: 'training-dummy',
    bug: { from: 'fire()', to: 'fire' },
    fallback: 'forward()\nforward()\nfire\nfire()',
  },
  {
    kind: 'glitch',
    id: 'gl-indent',
    after: 'tank-dummy',
    title: T('Fehlersuche', 'Bug hunt'),
    enemy: 'tank-dummy',
    bug: { from: '    fire()', to: 'fire()' },
    fallback: 'forward(4)\nfor i in range(5):\nfire()',
  },
  {
    kind: 'constraint',
    id: 'cn-row-3',
    after: 'dummy-row',
    title: T('Sonderregel: Attrappenreihe in 3 Zeilen', 'Special rule: Dummy Row in 3 lines'),
    prompt: T('Höchstens 3 Zeilen Code.', 'At most 3 lines of code.'),
    enemy: 'dummy-row',
    maxLines: 3,
    solution: 'forward(4)\nfor i in range(10):\n    fire()',
  },
  {
    kind: 'constraint',
    id: 'cn-tank-3',
    after: 'tank-dummy',
    title: T('Sonderregel: Panzer-Attrappe in 3 Zeilen', 'Special rule: Tank Dummy in 3 lines'),
    prompt: T('Höchstens 3 Zeilen Code.', 'At most 3 lines of code.'),
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
    title: T('Fehlersuche', 'Bug hunt'),
    enemy: 'sign-dummy',
    bug: { from: 'forward(steps)', to: 'forward(step)' },
    fallback: 'steps = distance() - 1\nforward(4)\nforward(step)\nfire()',
  },
  {
    kind: 'glitch',
    id: 'gl-text-plus-number',
    after: 'name-tag',
    title: T('Fehlersuche', 'Bug hunt'),
    enemy: 'name-tag',
    bug: { from: 'str(d)', to: 'd' },
    fallback: 'd = distance()\nsay("Distance: " + d)',
  },
  {
    kind: 'constraint',
    id: 'cn-no-repeat',
    after: 'twin-armor',
    title: T('Sonderregel: Keine Zahl zweimal', 'Special rule: No number twice'),
    prompt: T('Keine Zahl darf zweimal im Code stehen.', 'No number may appear twice in the code.'),
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
    title: T('Fehlersuche', 'Bug hunt'),
    enemy: 'double-loop',
    bug: { from: '    fire()\nturn_right()', to: '    fire()\n    turn_right()' },
    fallback: 'shots = 12\nforward(4)\nfor i in range(shots):\n    fire()\n    turn_right()\nfor i in range(shots):\n    fire()',
  },
  {
    kind: 'constraint',
    id: 'cn-double-5',
    after: 'double-loop',
    title: T('Sonderregel: Doppelschleife in 5 Zeilen', 'Special rule: Double Loop in 5 lines'),
    prompt: T('Höchstens 5 Zeilen Code.', 'At most 5 lines of code.'),
    enemy: 'double-loop',
    maxLines: 5,
    solution: 'forward(4)\nfor side in range(2):\n    for i in range(12):\n        fire()\n    turn_right()',
  },
  // ---- Chapter 3
  {
    kind: 'glitch',
    id: 'gl-equals',
    after: 'peekaboo',
    title: T('Fehlersuche', 'Bug hunt'),
    enemy: 'peekaboo',
    bug: { from: ' == "enemy"', to: ' = "enemy"' },
    fallback: 'if see() = "enemy":\n    fire()\n    fire()\nelse:\n    turn_right()\n    fire()\n    fire()',
  },
  {
    kind: 'glitch',
    id: 'gl-colon',
    after: 'bubble',
    title: T('Fehlersuche', 'Bug hunt'),
    enemy: 'bubble',
    bug: { from: ':\n', to: '\n' },
    fallback: 'for i in range(8):\n    if see() == "enemy"\n        fire()',
  },
  // ---- Chapter 4
  {
    kind: 'glitch',
    id: 'gl-infinite',
    after: 'far-far-dummy',
    title: T('Fehlersuche', 'Bug hunt'),
    enemy: 'far-far-dummy',
    bug: { from: '    forward()', to: '    wait()' },
    fallback: 'while see() != "enemy":\n    wait()\nfire()\nfire()',
  },
  {
    kind: 'constraint',
    id: 'cn-maze-no-for',
    after: 'maze-runner',
    title: T('Sonderregel: Labyrinth ohne for', 'Special rule: Maze without for'),
    prompt: T('Kein for, höchstens 8 Zeilen.', 'No for, at most 8 lines.'),
    enemy: 'maze-runner',
    maxLines: 8,
    needs: { without: ['for'] },
    solution: 'while alive():\n    if see() == "enemy":\n        fire()\n    elif see() == "wall" and distance() == 1:\n        turn_right()\n    else:\n        forward()',
    violation: 'for i in range(100):\n    if see() == "enemy":\n        fire()\n    elif see() == "wall" and distance() == 1:\n        turn_right()\n    else:\n        forward()',
  },
];
