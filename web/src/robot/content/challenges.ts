import { mk, T } from './helpers.ts';
import type { Text } from './types.ts';

/** Where a challenge sits in the order: after this step (an enemy id), so it is offered once that enemy is solved. */
interface Base {
  id: string;
  after: string;
  title: Text;
  prompt: Text;
}

/** Drag the shuffled lines into an order that beats the enemy. */
export interface LineUp extends Base {
  kind: 'lineup';
  enemy: string;
  /** The lines in one correct order; the player gets them shuffled. */
  lines: string[];
}

/** Say what the script will do, then run it. The answer is computed by running the script, so it cannot be wrong. */
export interface Predict extends Base {
  kind: 'predict';
  script: string;
  /** "tile": where does the robot stop ("x,y"); "say": the last bubble text. */
  ask: 'tile' | 'say';
  map: string[];
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
  skeleton: string;
  solution: string;
}

/** Beat an old enemy under a rule. */
export interface Constraint extends Base {
  kind: 'constraint';
  enemy: string;
  maxLines: number;
  solution: string;
}

export type Challenge = LineUp | Predict | Glitch | Workshop | Constraint;

const square = (x: number, y: number, size: number): string[] => {
  const out: string[] = [];
  for (let i = 0; i <= size; i++) out.push(`${x + i},${y}`, `${x + i},${y + size}`, `${x},${y + i}`, `${x + size},${y + i}`);
  return [...new Set(out)];
};

/** Hp-99 dummy in the corner so a workshop or predict run never ends early. */
const far = (...items: [string, number, number][]) => mk(8, 8, ['D', 7, 0], ...items);

export const CHALLENGES: readonly Challenge[] = [
  {
    kind: 'lineup',
    id: 'lu-first-shot',
    after: 'training-dummy',
    title: T('Zeilen ordnen: Annäherung', 'Line up: Approach'),
    prompt: T('Die Attrappe ist weit weg. Bring die Zeilen in eine Reihenfolge, mit der der Roboter sie zweimal trifft.', 'The dummy is far away. Put the lines in an order that lets the robot hit it twice.'),
    enemy: 'training-dummy',
    lines: ['forward()', 'forward()', 'fire()', 'fire()'],
  },
  {
    kind: 'lineup',
    id: 'lu-corner',
    after: 'corner-dummy',
    title: T('Zeilen ordnen: Um die Ecke', 'Line up: Around the corner'),
    prompt: T('Erst dahin fahren, dann drehen, dann schießen: Bring die Zeilen in die richtige Reihenfolge.', 'Drive first, then turn, then shoot: put the lines in the right order.'),
    enemy: 'corner-dummy',
    lines: ['forward()', 'forward()', 'turn_right()', 'fire()', 'fire()'],
  },
  {
    kind: 'predict',
    id: 'pr-tile',
    after: 'training-dummy',
    title: T('Vorhersage: Wo hält er an?', 'Predict: Where does it stop?'),
    prompt: T('Der Roboter startet unten bei (3, 7) und schaut nach oben. Auf welchem Feld steht er am Ende? Schreib x,y.', 'The robot starts at (3, 7) looking up. Which tile does it end on? Write x,y.'),
    script: 'forward()\nforward()\nturn_right()\nforward()',
    ask: 'tile',
    map: far(['^', 3, 7]),
  },
  {
    kind: 'predict',
    id: 'pr-tile-2',
    after: 'u-turn',
    title: T('Vorhersage: Hin und zurück', 'Predict: There and back'),
    prompt: T('Wo steht der Roboter am Ende? Schreib x,y. (Der Start ist (3, 7), die Blickrichtung oben.)', 'Where does the robot end up? Write x,y. (It starts at (3, 7), looking up.)'),
    script: 'forward()\nforward()\nforward()\nturn_right()\nturn_right()\nforward()',
    ask: 'tile',
    map: far(['^', 3, 7]),
  },
  {
    kind: 'predict',
    id: 'pr-say',
    after: 'name-tag',
    title: T('Vorhersage: Was sagt er?', 'Predict: What does it say?'),
    prompt: T('Welchen Text zeigt die letzte Sprechblase? Schreib genau ab, was der Roboter sagt.', 'What does the last speech bubble say? Type exactly what the robot says.'),
    script: 'x = 4\ny = x * 2 + 1\nsay("y is " + str(y))',
    ask: 'say',
    map: far(['^', 3, 7]),
  },
  {
    kind: 'glitch',
    id: 'gl-foward',
    after: 'one-more-line',
    title: T('Fehlersuche: Tippfehler', 'Glitch: Typo'),
    prompt: T('In deinem Code hat sich ein Fehler eingeschlichen: forward() ist plötzlich anders geschrieben. Finde und behebe ihn.', 'A bug crept into your code: forward() is spelled differently. Find and fix it.'),
    enemy: 'one-more-line',
    bug: { from: 'forward()', to: 'foward()' },
    fallback: 'foward()\nfire()\nfire()',
  },
  {
    kind: 'glitch',
    id: 'gl-parens',
    after: 'training-dummy',
    title: T('Fehlersuche: Klammern', 'Glitch: Brackets'),
    prompt: T('fire hat keine Klammern mehr, der Roboter schießt nicht. Behebe den Fehler.', 'fire lost its brackets and the robot does not shoot. Fix it.'),
    enemy: 'training-dummy',
    bug: { from: 'fire()', to: 'fire' },
    fallback: 'forward()\nforward()\nfire\nfire()',
  },
  {
    kind: 'glitch',
    id: 'gl-indent',
    after: 'tank-dummy',
    title: T('Fehlersuche: Einrückung', 'Glitch: Indentation'),
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
    skeleton: 'brush.down()\nforward()\nforward()\nturn_right()\n???',
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
    skeleton: 'brush.down()\nbrush.up()\nforward()\n???',
    solution: 'brush.down()\nbrush.up()\nforward()\nforward()\nbrush.down()\nbrush.up()\nforward()\nforward()\nbrush.down()',
  },
  {
    kind: 'constraint',
    id: 'cn-row-3',
    after: 'dummy-row',
    title: T('Auflage: Attrappenreihe in 3 Zeilen', 'Constraint: Dummy Row in 3 lines'),
    prompt: T('Schlage die Attrappenreihe noch einmal, aber mit höchstens 3 Zeilen Code.', 'Beat the Dummy Row again, but with at most 3 lines of code.'),
    enemy: 'dummy-row',
    maxLines: 3,
    solution: 'forward(4)\nfor i in range(10):\n    fire()',
  },
  {
    kind: 'constraint',
    id: 'cn-tank-3',
    after: 'tank-dummy',
    title: T('Auflage: Panzer-Attrappe in 3 Zeilen', 'Constraint: Tank Dummy in 3 lines'),
    prompt: T('Schlage die Panzer-Attrappe noch einmal, aber mit höchstens 3 Zeilen Code.', 'Beat the Tank Dummy again, but with at most 3 lines of code.'),
    enemy: 'tank-dummy',
    maxLines: 3,
    solution: 'forward(4)\nfor i in range(5):\n    fire()',
  },
];
