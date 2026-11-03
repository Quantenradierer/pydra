import type { Localized } from '../content/types.ts';

/** One answer for the gap: code (the same in every language) and what it does. */
export interface GameChoice {
  /** Replaces the gap `___` in the level's code. */
  code: string;
  /**
   * For the right answer: the explanation, shown once it is picked. For a
   * wrong answer: why the hydra went wrong, shown after its run; it never
   * names the right answer.
   */
  note: Localized;
}

/**
 * A level of the hydra game: a program with one gap, four answers for it
 * and the arena the hydra swims in. Every answer is really run by the
 * interpreter in python.ts; only the right one eats every fish.
 */
export interface GameLevel {
  /** Stable, saved in the progress. */
  id: string;
  /** The concept the level practises, shown as its title. */
  title: Localized;
  /** One or two sentences that introduce the concept. */
  intro: Localized;
  /** Arena rows: `#` rock, `.` water, `F` fish, the hydra's start `^ > v <`. */
  map: string[];
  /** The program with exactly one gap `___`. */
  code: string;
  choices: GameChoice[];
  answerIndex: 0 | 1 | 2 | 3;
}

/** The gap in a level's code. */
export const GAP = '___';

/** The level's program with the gap filled by a choice. */
export function fill(level: GameLevel, choice: number): string {
  return level.code.replace(GAP, level.choices[choice]!.code);
}

export const LEVELS: readonly GameLevel[] = [
  {
    id: 'sequence',
    title: { de: 'Der Reihe nach', en: 'One after another' },
    intro: {
      de: 'Python führt die Befehle von oben nach unten aus, einen nach dem anderen. `move()` schwimmt ein Feld vorwärts.',
      en: 'Python runs the commands from top to bottom, one after the other. `move()` swims one cell forward.',
    },
    map: ['>....', '.....', '..F..'],
    code: 'move()\nmove()\n___\nmove()\nmove()',
    choices: [
      {
        code: 'turn_right()',
        note: {
          de: 'Nach zwei Feldern nach rechts dreht sich die Hydra mit `turn_right()` nach rechts, aus ihrer Sicht. Sie schaut jetzt nach unten, und die zwei `move()` darunter bringen sie genau zum Fisch.\n\nDie Reihenfolge zählt: Jede Zeile wird erst ausgeführt, wenn die davor fertig ist, wie die Schritte in einem Rezept.',
          en: 'After two cells to the right, `turn_right()` turns the hydra to its right. It now faces down, and the two `move()` below take it straight to the fish.\n\nOrder matters: each line runs only after the one before has finished, like the steps of a recipe.',
        },
      },
      {
        code: 'turn_left()',
        note: {
          de: '`turn_left()` dreht die Hydra nach links, aus ihrer Sicht. Sie schaut dann nach oben, und dort ist sofort der Rand des Beckens.',
          en: '`turn_left()` turns the hydra to its left. It then faces up, and the edge of the pool is right there.',
        },
      },
      {
        code: 'move()',
        note: {
          de: 'Mit `move()` in der Lücke schwimmt die Hydra fünfmal geradeaus. Das Becken ist aber nur fünf Felder breit, also stößt sie beim letzten Schritt an den Rand.',
          en: 'With `move()` in the gap the hydra swims straight ahead five times. The pool is only five cells wide, so the last step hits the edge.',
        },
      },
      {
        code: 'pass',
        note: {
          de: '`pass` heißt in Python: „tu nichts“. Die Hydra schwimmt also einfach weiter geradeaus und kommt nie beim Fisch an.',
          en: '`pass` means "do nothing" in Python. So the hydra just keeps swimming straight on and never reaches the fish.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'for-range',
    title: { de: 'Schleife mit range', en: 'Loop with range' },
    intro: {
      de: '`for i in range(n):` wiederholt die eingerückten Zeilen darunter n-mal. So muss man eine Treppe nicht Stufe für Stufe hinschreiben.',
      en: '`for i in range(n):` repeats the indented lines below it n times. That way you do not have to write out a staircase step by step.',
    },
    map: ['...F#', '..F..', '.F...', '>....'],
    code: 'for i in range(___):\n    move()\n    turn_left()\n    move()\n    turn_right()',
    choices: [
      {
        code: '3',
        note: {
          de: 'Jeder Durchlauf der Schleife ist eine Treppenstufe: ein Feld nach rechts, ein Feld nach oben. Es gibt drei Fische auf drei Stufen, also braucht es genau drei Durchläufe: `range(3)`.\n\n`range(3)` liefert die Zahlen 0, 1 und 2, also drei Stück. Die Schleife läuft einmal pro Zahl.',
          en: 'Each pass through the loop is one stair: one cell to the right, one cell up. There are three fish on three stairs, so it takes exactly three passes: `range(3)`.\n\n`range(3)` gives the numbers 0, 1 and 2, three of them. The loop runs once per number.',
        },
      },
      {
        code: '2',
        note: {
          de: '`range(2)` liefert nur die Zahlen 0 und 1, die Schleife läuft also nur zweimal. Die Hydra hört eine Stufe zu früh auf.',
          en: '`range(2)` gives only the numbers 0 and 1, so the loop runs just twice. The hydra stops one stair too early.',
        },
      },
      {
        code: '4',
        note: {
          de: 'Mit `range(4)` läuft die Schleife viermal. Nach der letzten Stufe will die Hydra noch einmal nach rechts schwimmen, und da liegt ein Felsen.',
          en: 'With `range(4)` the loop runs four times. After the last stair the hydra tries to swim right once more, and there is a rock.',
        },
      },
      {
        code: '0',
        note: {
          de: '`range(0)` ist leer: keine einzige Zahl. Die Schleife läuft also gar nicht, und die Hydra bewegt sich nicht vom Fleck.',
          en: '`range(0)` is empty: not a single number. So the loop never runs, and the hydra does not move at all.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'loop-body',
    title: { de: 'Was die Schleife wiederholt', en: 'What the loop repeats' },
    intro: {
      de: 'Alles, was unter dem `for` eingerückt ist, gehört zur Schleife und wird jedes Mal wiederholt, auch die letzte Zeile.',
      en: 'Everything indented under the `for` belongs to the loop and is repeated every time, including the last line.',
    },
    map: ['.....', '.....', '.....', '>.F.#', 'F##F.', '.##..', '.F...'],
    code: 'for i in range(4):\n    move()\n    move()\n    move()\n    ___',
    choices: [
      {
        code: 'turn_right()',
        note: {
          de: 'Drei Schritte, dann rechts drehen, und das viermal: Das ergibt ein Quadrat rund um die Felsen, im Uhrzeigersinn. Auf jeder Seite liegt ein Fisch.\n\nDie Drehung steht in der Schleife, also passiert sie nach jeder Seite. Viermal „Seite und Ecke“ ist ein ganzes Quadrat.',
          en: 'Three steps, then turn right, four times over: that makes a square around the rocks, clockwise. There is a fish on every side.\n\nThe turn is inside the loop, so it happens after every side. Four times "side and corner" is a whole square.',
        },
      },
      {
        code: 'turn_left()',
        note: {
          de: 'Mit `turn_left()` schwimmt die Hydra auch ein schönes Quadrat, aber links herum, also nach oben ins leere Wasser. Dort liegen keine Fische.',
          en: 'With `turn_left()` the hydra also swims a neat square, but to the left, up into empty water. There are no fish up there.',
        },
      },
      {
        code: 'move()',
        note: {
          de: 'Mit einem vierten `move()` dreht sich die Hydra nie. Sie schwimmt immer geradeaus, bis sie gegen den Felsen am Ende der Reihe stößt.',
          en: 'With a fourth `move()` the hydra never turns. It keeps swimming straight until it hits the rock at the end of the row.',
        },
      },
      {
        code: 'turn_rigth()',
        note: {
          de: 'Genau hinschauen: `turn_rigth` ist falsch geschrieben. Python kennt keinen Befehl mit diesem Namen und bricht mit einem `NameError` ab. Ein Tippfehler reicht, und das Programm stoppt.',
          en: 'Look closely: `turn_rigth` is misspelled. Python knows no command with that name and stops with a `NameError`. One typo is enough to stop the program.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'while',
    title: { de: 'while: solange …', en: 'while: as long as …' },
    intro: {
      de: '`while bedingung:` wiederholt den eingerückten Teil, solange die Bedingung `True` ist. `wall_ahead()` ist `True`, wenn direkt vor der Hydra ein Felsen oder der Rand ist.',
      en: '`while condition:` repeats the indented part as long as the condition is `True`. `wall_ahead()` is `True` when there is a rock or the edge right in front of the hydra.',
    },
    map: ['#######', '>FF.FF#', '#######'],
    code: 'while ___:\n    move()',
    choices: [
      {
        code: 'not wall_ahead()',
        note: {
          de: '`not` dreht `True` und `False` um. `not wall_ahead()` heißt also: „vor mir ist frei“. Die Hydra schwimmt, solange frei ist, und hält genau vor dem Felsen an. Unterwegs frisst sie alle Fische.\n\nDas Schöne an `while`: Du musst nicht wissen, wie lang der Gang ist. Die Schleife prüft vor jedem Schritt neu.',
          en: '`not` flips `True` and `False`. So `not wall_ahead()` means "the way ahead is clear". The hydra swims while it is clear and stops right in front of the rock, eating every fish on the way.\n\nThe nice thing about `while`: you do not need to know how long the corridor is. The loop checks again before every step.',
        },
      },
      {
        code: 'wall_ahead()',
        note: {
          de: '`wall_ahead()` ist am Start `False`, denn vor der Hydra ist ja Wasser. Die Bedingung ist also gleich beim ersten Prüfen falsch, und die Schleife läuft kein einziges Mal.',
          en: 'At the start `wall_ahead()` is `False`, because there is water in front of the hydra. So the condition is false at the very first check, and the loop never runs.',
        },
      },
      {
        code: 'True',
        note: {
          de: '`while True:` prüft gar nichts: Die Bedingung ist immer wahr. Die Hydra schwimmt also stur weiter, auch als der Felsen kommt.',
          en: '`while True:` checks nothing at all: the condition is always true. So the hydra keeps swimming stubbornly, even when the rock comes.',
        },
      },
      {
        code: 'fish_ahead()',
        note: {
          de: '`fish_ahead()` ist nur `True`, solange direkt vor der Hydra ein Fisch liegt. Nach den ersten zwei Fischen kommt ein leeres Feld, und die Schleife hört auf.',
          en: '`fish_ahead()` is only `True` while there is a fish right in front of the hydra. After the first two fish comes an empty cell, and the loop stops.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'if',
    title: { de: 'if: nur manchmal', en: 'if: only sometimes' },
    intro: {
      de: '`if bedingung:` führt den eingerückten Teil nur aus, wenn die Bedingung `True` ist. Sonst wird er übersprungen.',
      en: '`if condition:` runs the indented part only when the condition is `True`. Otherwise it is skipped.',
    },
    map: ['>.F..', '.....', '....F', '...F.'],
    code: 'for i in range(8):\n    move()\n    if ___:\n        turn_right()',
    choices: [
      {
        code: 'wall_ahead()',
        note: {
          de: 'Nach jedem Schritt fragt die Hydra: „Ist vor mir eine Wand?“ Nur dann dreht sie sich nach rechts. So schwimmt sie am Rand entlang und biegt genau an den Ecken ab.\n\nDas `if` steht in der Schleife, also wird die Frage achtmal gestellt, aber nur zweimal mit `True` beantwortet.',
          en: 'After every step the hydra asks: "Is there a wall in front of me?" Only then does it turn right. So it swims along the edge and turns exactly at the corners.\n\nThe `if` is inside the loop, so the question is asked eight times, but answered `True` only twice.',
        },
      },
      {
        code: 'True',
        note: {
          de: '`if True:` ist immer erfüllt, also dreht sich die Hydra nach jedem einzelnen Schritt. Vier Schritte, vier Rechtsdrehungen: Sie schwimmt im Kreis.',
          en: '`if True:` always holds, so the hydra turns after every single step. Four steps, four right turns: it swims in a circle.',
        },
      },
      {
        code: 'not wall_ahead()',
        note: {
          de: 'Mit `not` dreht sich die Hydra immer dann, wenn der Weg frei ist, also fast immer. Ausgerechnet vor der Wand dreht sie sich nicht und schwimmt hinein.',
          en: 'With `not` the hydra turns whenever the way is clear, which is almost always. Right in front of the wall it does not turn, and swims into it.',
        },
      },
      {
        code: 'fish_ahead()',
        note: {
          de: '`fish_ahead()` ist `True`, wenn ein Fisch vor der Hydra liegt. Sie dreht also genau dann ab und weicht dem Fisch aus, statt ihn zu fressen.',
          en: '`fish_ahead()` is `True` when a fish lies in front of the hydra. So that is exactly when it turns away, dodging the fish instead of eating it.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'variables',
    title: { de: 'Variablen ändern sich', en: 'Variables change' },
    intro: {
      de: 'Eine Variable ist ein Name für einen Wert. `steps = …` gibt ihr einen neuen Wert, und rechts vom `=` darf der alte Wert vorkommen.',
      en: 'A variable is a name for a value. `steps = …` gives it a new value, and the old value may appear on the right of the `=`.',
    },
    map: ['F....F', '......', '..>F..', '......', 'F..F..', '......', '.....F'],
    code: 'steps = 1\nfor k in range(6):\n    for i in range(steps):\n        move()\n    turn_right()\n    steps = ___',
    choices: [
      {
        code: 'steps + 1',
        note: {
          de: '`steps = steps + 1` heißt: Nimm den alten Wert von `steps`, zähl 1 dazu und speichere das Ergebnis wieder unter `steps`. Jede Seite wird so um ein Feld länger: 1, 2, 3, 4, 5, 6. Das ergibt eine Spirale nach außen.\n\nIm Variablen-Feld unter dem Code siehst du `steps` nach jeder Runde wachsen.',
          en: '`steps = steps + 1` means: take the old value of `steps`, add 1 and store the result under `steps` again. So every side gets one cell longer: 1, 2, 3, 4, 5, 6. That makes a spiral outwards.\n\nIn the variables box below the code you can watch `steps` grow after every round.',
        },
      },
      {
        code: 'steps',
        note: {
          de: '`steps = steps` speichert den alten Wert einfach wieder: `steps` bleibt immer 1. Jede Seite ist ein Feld lang, und die Hydra dreht sich in einem kleinen Kreis.',
          en: '`steps = steps` simply stores the old value again: `steps` stays 1 forever. Every side is one cell long, and the hydra turns in a little circle.',
        },
      },
      {
        code: 'steps + 2',
        note: {
          de: 'Mit `+ 2` wachsen die Seiten zu schnell: 1, 3, 5 … Die Spirale wird so breit, dass die Hydra an den Rand des Beckens stößt.',
          en: 'With `+ 2` the sides grow too fast: 1, 3, 5 … The spiral gets so wide that the hydra hits the edge of the pool.',
        },
      },
      {
        code: 'steps - 1',
        note: {
          de: 'Mit `- 1` wird `steps` kleiner: 1, dann 0, dann sogar negativ. `range(0)` und `range` mit negativer Zahl sind leer, also schwimmt die Hydra nur ein einziges Feld und dreht sich danach nur noch auf der Stelle.',
          en: 'With `- 1`, `steps` shrinks: 1, then 0, then even negative. `range(0)` and `range` of a negative number are empty, so the hydra swims a single cell and then only spins on the spot.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'function-parameter',
    title: { de: 'Funktionen mit Parameter', en: 'Functions with a parameter' },
    intro: {
      de: '`def go(steps):` baut einen eigenen Befehl. Beim Aufruf `go(4)` bekommt der Parameter `steps` den Wert 4, bei `go(3)` den Wert 3.',
      en: '`def go(steps):` builds a command of your own. When you call `go(4)`, the parameter `steps` gets the value 4; with `go(3)` it gets 3.',
    },
    map: ['>...F.', '......', '....F.', '.F..F.'],
    code: 'def go(steps):\n    for i in range(___):\n        move()\n    turn_right()\n\ngo(4)\ngo(3)\ngo(3)\ngo(1)',
    choices: [
      {
        code: 'steps',
        note: {
          de: '`range(steps)` benutzt den Wert, den der Aufruf mitgibt: Bei `go(4)` schwimmt die Hydra 4 Felder, bei `go(3)` 3 Felder, bei `go(1)` eins. Dieselbe Funktion macht jedes Mal etwas anderes, je nach Parameter.\n\nDie Zeile `def` allein bewegt noch nichts: Sie merkt sich nur das Rezept. Erst die Aufrufe unten lassen es laufen.',
          en: '`range(steps)` uses the value the call passes in: with `go(4)` the hydra swims 4 cells, with `go(3)` 3 cells, with `go(1)` one. The same function does something different each time, depending on the parameter.\n\nThe `def` line alone moves nothing: it only remembers the recipe. The calls below are what run it.',
        },
      },
      {
        code: '4',
        note: {
          de: 'Mit `range(4)` ist es egal, was beim Aufruf in den Klammern steht: Die Hydra schwimmt jedes Mal 4 Felder. Beim zweiten Aufruf ist das Becken dafür zu kurz.',
          en: 'With `range(4)` it does not matter what the call puts in the brackets: the hydra swims 4 cells every time. On the second call the pool is too short for that.',
        },
      },
      {
        code: 'steps - 1',
        note: {
          de: 'Mit `steps - 1` schwimmt die Hydra bei jedem Aufruf ein Feld weniger, als dort steht. Ihre Runde wird zu klein, und sie verpasst Fische.',
          en: 'With `steps - 1` the hydra swims one cell less than each call asks for. Its lap ends up too small, and it misses fish.',
        },
      },
      {
        code: 'steps * 2',
        note: {
          de: 'Mit `steps * 2` schwimmt die Hydra doppelt so weit wie verlangt: beim ersten Aufruf 8 Felder. So breit ist das Becken nicht.',
          en: 'With `steps * 2` the hydra swims twice as far as asked: 8 cells on the first call. The pool is not that wide.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'return',
    title: { de: 'Rückgabewerte', en: 'Return values' },
    intro: {
      de: '`return` gibt einen Wert aus der Funktion zurück. Mit `n = to_wall()` landet dieser Wert in der Variablen `n`. `//` teilt und schneidet die Nachkommastellen ab.',
      en: '`return` hands a value back out of the function. With `n = to_wall()` that value ends up in the variable `n`. `//` divides and drops the decimals.',
    },
    map: ['>......', '..#F...'],
    code: 'def to_wall():\n    steps = 0\n    while not wall_ahead():\n        move()\n        steps = steps + 1\n    return steps\n\nn = to_wall()\nturn_right()\nmove()\nturn_right()\nfor i in range(___):\n    move()',
    choices: [
      {
        code: 'n // 2',
        note: {
          de: '`to_wall()` zählt die Schritte bis zur Wand (6) und gibt sie mit `return` zurück, also ist `n` gleich 6. Unten will die Hydra nur die halbe Strecke zurück: `6 // 2` ist 3, genau bis zum Fisch.\n\nSo kann eine Funktion etwas herausfinden und das Ergebnis dem Rest des Programms melden.',
          en: '`to_wall()` counts the steps to the wall (6) and hands them back with `return`, so `n` is 6. Below, the hydra only wants to go half the way back: `6 // 2` is 3, exactly to the fish.\n\nThis is how a function can find something out and report the result to the rest of the program.',
        },
      },
      {
        code: 'n',
        note: {
          de: '`n` ist 6, die ganze Strecke. Die Hydra frisst zwar den Fisch, schwimmt dann aber weiter und stößt gegen den Felsen dahinter.',
          en: '`n` is 6, the whole way. The hydra does eat the fish, but then keeps going and hits the rock behind it.',
        },
      },
      {
        code: 'steps // 2',
        note: {
          de: '`steps` gibt es nur innerhalb der Funktion: Es ist eine lokale Variable. Draußen kennt Python diesen Namen nicht und meldet einen `NameError`. Was die Funktion nach außen gibt, steckt in `n`.',
          en: '`steps` only exists inside the function: it is a local variable. Outside, Python does not know the name and reports a `NameError`. What the function hands out is stored in `n`.',
        },
      },
      {
        code: 'n % 2',
        note: {
          de: '`%` liefert den Rest beim Teilen, nicht das Ergebnis: 6 geteilt durch 2 geht glatt auf, der Rest ist 0. Also läuft die Schleife kein einziges Mal.',
          en: '`%` gives the remainder of a division, not the result: 6 divided by 2 leaves no remainder, so it is 0. The loop never runs.',
        },
      },
    ],
    answerIndex: 0,
  },
];
