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
  {
    id: 'nested-loops',
    title: { de: 'Schleife in der Schleife', en: 'A loop inside a loop' },
    intro: {
      de: 'Eine Schleife darf in einer anderen stehen. Die innere läuft bei jedem Durchlauf der äußeren einmal ganz von vorne.',
      en: 'A loop may sit inside another loop. The inner one runs all the way through, from the start, on every pass of the outer one.',
    },
    map: ['......F', '.......', '....F##', '>.F####'],
    code: 'for stair in range(3):\n    for i in range(___):\n        move()\n    turn_left()\n    move()\n    turn_right()',
    choices: [
      {
        code: '2',
        note: {
          de: 'Die äußere Schleife baut drei Stufen. In jeder Stufe läuft die innere Schleife zweimal: zwei Felder nach rechts. Danach geht es ein Feld nach oben. So landet die Hydra auf jeder Stufe beim Fisch.\n\nZähl mal mit: Das `move()` in der inneren Schleife läuft insgesamt 3 · 2 = 6-mal.',
          en: 'The outer loop builds three stairs. On every stair the inner loop runs twice: two cells to the right. Then it goes one cell up. That way the hydra reaches the fish on every stair.\n\nCount along: the `move()` in the inner loop runs 3 · 2 = 6 times in all.',
        },
      },
      {
        code: '1',
        note: {
          de: 'Mit `range(1)` ist jede Stufe nur ein Feld breit. Die Treppe wird zu steil, und die Hydra schwimmt an allen Fischen vorbei.',
          en: 'With `range(1)` every stair is only one cell wide. The staircase gets too steep, and the hydra swims past every fish.',
        },
      },
      {
        code: '3',
        note: {
          de: 'Mit `range(3)` ist schon die erste Stufe zu breit: Beim dritten Schritt nach rechts stößt die Hydra gegen den Felsen.',
          en: 'With `range(3)` the very first stair is too wide: on the third step to the right the hydra hits the rock.',
        },
      },
      {
        code: 'stair',
        note: {
          de: '`stair` ist die Variable der äußeren Schleife: erst 0, dann 1, dann 2. Die erste Stufe hat also gar kein Feld nach rechts, und alle Stufen sind zu schmal für die Fische.',
          en: '`stair` is the variable of the outer loop: first 0, then 1, then 2. So the first stair has no cell to the right at all, and every stair is too narrow for the fish.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'strings-elif',
    title: { de: 'Buchstaben als Befehle', en: 'Letters as commands' },
    intro: {
      de: 'Text in Anführungszeichen heißt String. `for c in route:` geht ihn Buchstabe für Buchstabe durch. Mit `elif` („sonst wenn“) und `else` („sonst“) wählt ein `if` zwischen mehreren Wegen.',
      en: 'Text in quotes is called a string. `for c in route:` goes through it letter by letter. With `elif` ("else if") and `else`, an `if` picks one of several ways.',
    },
    map: ['.....', '.....', '>F...', '..F..', '...F.'],
    code: 'route = "MMRMMLM"\nfor c in route:\n    if c == "M":\n        move()\n    elif c == ___:\n        turn_right()\n    else:\n        turn_left()',
    choices: [
      {
        code: '"R"',
        note: {
          de: 'Für jeden Buchstaben prüft das Programm von oben nach unten: Ist es `"M"`? Dann schwimmen. Sonst: Ist es `"R"`? Dann rechts drehen. Passt nichts, greift `else`: links drehen. So wird aus `"MMRMMLM"` der Weg zu allen drei Fischen.\n\nVon den Zweigen eines `if` läuft immer genau einer: der erste, dessen Bedingung stimmt.',
          en: 'For every letter the program checks from top to bottom: is it `"M"`? Then swim. Otherwise: is it `"R"`? Then turn right. If nothing matches, `else` takes over: turn left. That turns `"MMRMMLM"` into the way to all three fish.\n\nOf the branches of an `if`, exactly one runs: the first whose condition holds.',
        },
      },
      {
        code: '"L"',
        note: {
          de: 'Jetzt sind die Drehungen vertauscht: Beim `L` der Route dreht die Hydra rechts, und das `R` landet im `else` und dreht sie links. Sie schwimmt nach oben statt nach unten.',
          en: 'Now the turns are swapped: at the `L` of the route the hydra turns right, and the `R` ends up in the `else` and turns it left. It swims up instead of down.',
        },
      },
      {
        code: 'R',
        note: {
          de: 'Ohne Anführungszeichen ist `R` kein Text, sondern ein Variablenname. Eine Variable `R` gibt es nicht, also meldet Python beim ersten Buchstaben, der kein `M` ist, einen `NameError`.',
          en: 'Without quotes, `R` is not text but the name of a variable. There is no variable `R`, so at the first letter that is not an `M` Python reports a `NameError`.',
        },
      },
      {
        code: '"r"',
        note: {
          de: 'Python unterscheidet Groß- und Kleinbuchstaben: `"r"` ist nicht dasselbe wie das große `R` in der Route. Das `elif` passt also nie, und jede Drehung landet im `else`: immer links.',
          en: 'Python tells upper and lower case apart: `"r"` is not the same as the capital `R` in the route. So the `elif` never matches, and every turn ends up in the `else`: always left.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'for-list',
    title: { de: 'Schleife über eine Liste', en: 'Looping over a list' },
    intro: {
      de: 'Eine Liste sammelt mehrere Werte in eckigen Klammern, zum Beispiel `[5, 7]`. `for x in liste:` läuft einmal pro Wert, und `x` ist dabei nacheinander jeder Wert der Liste.',
      en: 'A list collects several values in square brackets, for example `[5, 7]`. `for x in some_list:` runs once per value, and `x` is each value of the list in turn.',
    },
    map: ['.....', '.F...', '..F..', '.....', '>.F..'],
    code: 'for steps in ___:\n    for i in range(steps):\n        move()\n    turn_left()',
    choices: [
      {
        code: '[2, 3, 1]',
        note: {
          de: 'Die Schleife läuft dreimal, und `steps` ist nacheinander 2, 3 und 1. Die Hydra schwimmt also 2 Felder, dreht sich, 3 Felder, dreht sich, 1 Feld. Die Liste ist wie ein Bauplan für den Weg.\n\nIm Variablen-Feld siehst du, wie `steps` bei jedem Durchlauf den nächsten Wert der Liste annimmt.',
          en: 'The loop runs three times, and `steps` is 2, 3 and 1 in turn. So the hydra swims 2 cells, turns, 3 cells, turns, 1 cell. The list is like a blueprint for the way.\n\nIn the variables box you can watch `steps` take the next value of the list on every pass.',
        },
      },
      {
        code: '[3, 2, 1]',
        note: {
          de: 'Dieselben Zahlen, aber in anderer Reihenfolge. Die Liste wird von vorne nach hinten abgearbeitet, also schwimmt die Hydra zuerst 3 Felder und nimmt einen ganz anderen Weg.',
          en: 'The same numbers, but in a different order. The list is worked through from front to back, so the hydra swims 3 cells first and takes a different way altogether.',
        },
      },
      {
        code: 'range(3)',
        note: {
          de: '`range(3)` liefert 0, 1 und 2. Im ersten Durchlauf schwimmt die Hydra also gar nicht und dreht sich nur. Danach geht es ein Feld nach oben und dann nach links, und links ist sofort der Rand.',
          en: '`range(3)` gives 0, 1 and 2. So on the first pass the hydra does not swim at all and only turns. Then it goes one cell up and then left, and to the left is the edge right away.',
        },
      },
      {
        code: 'len([2, 3, 1])',
        note: {
          de: '`len(…)` zählt, wie viele Werte in der Liste stehen: Das ergibt die Zahl 3. Eine einzelne Zahl kann man aber nicht durchlaufen, darum meldet Python einen `TypeError`.',
          en: '`len(…)` counts how many values are in the list: that gives the number 3. But a single number cannot be looped over, so Python reports a `TypeError`.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'list-index',
    title: { de: 'Listen und Index', en: 'Lists and indexes' },
    intro: {
      de: '`sides[0]` holt den ersten Wert aus der Liste `sides`, `sides[1]` den zweiten: Python zählt die Plätze ab 0. `sides[-1]` ist der letzte Wert.',
      en: '`sides[0]` gets the first value out of the list `sides`, `sides[1]` the second: Python counts the places from 0. `sides[-1]` is the last value.',
    },
    map: ['>..F.', '.F...', '....F', '.....'],
    code: 'sides = [4, 2, 3, 1]\nfor i in range(4):\n    for j in range(sides[___]):\n        move()\n    turn_right()',
    choices: [
      {
        code: 'i',
        note: {
          de: '`i` läuft von 0 bis 3, und `sides[i]` holt bei jedem Durchlauf den nächsten Wert: 4, 2, 3, 1. Die Hydra schwimmt eine Seite nach der anderen ab.\n\nDass der erste Platz die Nummer 0 hat, passt genau zu `range(4)`: Es liefert 0, 1, 2 und 3, also genau die vier Plätze der Liste.',
          en: '`i` runs from 0 to 3, and `sides[i]` gets the next value on every pass: 4, 2, 3, 1. The hydra swims one side after the other.\n\nThe first place being number 0 fits `range(4)` exactly: it gives 0, 1, 2 and 3, just the four places of the list.',
        },
      },
      {
        code: 'i + 1',
        note: {
          de: 'Mit `i + 1` fängt die Hydra beim zweiten Wert an, und im letzten Durchlauf fragt sie nach `sides[4]`. Die Liste hat aber nur die Plätze 0 bis 3, also meldet Python einen `IndexError`.',
          en: 'With `i + 1` the hydra starts at the second value, and on the last pass it asks for `sides[4]`. But the list only has the places 0 to 3, so Python reports an `IndexError`.',
        },
      },
      {
        code: '0',
        note: {
          de: '`sides[0]` ist immer der erste Wert, also 4. Die Hydra will jede Seite 4 Felder lang schwimmen, und auf der zweiten Seite ist das Becken zu Ende.',
          en: '`sides[0]` is always the first value, 4. The hydra tries to swim 4 cells on every side, and on the second side the pool ends.',
        },
      },
      {
        code: '-1',
        note: {
          de: '`sides[-1]` ist der letzte Wert der Liste, also 1. Jede Seite ist nur ein Feld lang, und die Hydra dreht eine winzige Runde.',
          en: '`sides[-1]` is the last value of the list, 1. Every side is only one cell long, and the hydra swims a tiny lap.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'sum',
    title: { de: 'Zusammenzählen', en: 'Adding up' },
    intro: {
      de: '`total += n` ist kurz für `total = total + n`: Zum alten Wert kommt etwas dazu. So kann eine Variable in einer Schleife mitzählen oder Werte aufsummieren.',
      en: '`total += n` is short for `total = total + n`: something is added to the old value. That way a variable can count along in a loop or add values up.',
    },
    map: ['#######', '>.....F', '#######'],
    code: 'total = 0\nfor n in [1, 2, 3]:\n    total += ___\nfor i in range(total):\n    move()',
    choices: [
      {
        code: 'n',
        note: {
          de: '`total` startet bei 0 und bekommt nacheinander 1, 2 und 3 dazu: 0 + 1 + 2 + 3 = 6. Genau sechs Felder sind es bis zum Fisch.\n\nSo eine Variable heißt Summe: Sie sammelt in der Schleife etwas an, und erst danach wird das Ergebnis benutzt.',
          en: '`total` starts at 0 and gets 1, 2 and 3 added in turn: 0 + 1 + 2 + 3 = 6. It is exactly six cells to the fish.\n\nA variable like this is called a sum: it collects something in the loop, and only afterwards is the result used.',
        },
      },
      {
        code: '1',
        note: {
          de: 'Mit `+= 1` zählt `total` nur, wie oft die Schleife läuft: 3. Das ist ein Zähler, keine Summe. Die Hydra hört nach drei Feldern auf.',
          en: 'With `+= 1`, `total` only counts how often the loop runs: 3. That is a counter, not a sum. The hydra stops after three cells.',
        },
      },
      {
        code: 'total',
        note: {
          de: '`total += total` verdoppelt den Wert. Aber 0 + 0 bleibt 0, egal wie oft. Die Hydra rührt sich nicht.',
          en: '`total += total` doubles the value. But 0 + 0 stays 0, however often. The hydra does not move.',
        },
      },
      {
        code: 'n * 2',
        note: {
          de: 'Mit `n * 2` kommt jedes Mal das Doppelte dazu: 2 + 4 + 6 = 12. So lang ist der Gang nicht: Die Hydra frisst den Fisch und stößt danach an den Rand.',
          en: 'With `n * 2` double the amount is added each time: 2 + 4 + 6 = 12. The corridor is not that long: the hydra eats the fish and then hits the edge.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'range-step',
    title: { de: 'range mit Schrittweite', en: 'range with a step' },
    intro: {
      de: '`range(start, stop, schritt)` zählt ab `start` in Sprüngen von `schritt` und hört vor `stop` auf. `range(0, 10, 5)` liefert also 0 und 5.',
      en: '`range(start, stop, step)` counts from `start` in jumps of `step` and stops before `stop`. So `range(0, 10, 5)` gives 0 and 5.',
    },
    map: ['...F..', '.^....', '......', '....F.', '......', '....F.'],
    code: 'for n in range(1, 6, ___):\n    for i in range(n):\n        move()\n    turn_right()',
    choices: [
      {
        code: '2',
        note: {
          de: '`range(1, 6, 2)` liefert 1, 3 und 5: Jede Seite wird um 2 Felder länger. Die Hydra schwimmt eine eckige Spirale nach außen.\n\nDie 6 selbst kommt nicht dran: `stop` ist bei `range` immer die erste Zahl, die nicht mehr dabei ist.',
          en: '`range(1, 6, 2)` gives 1, 3 and 5: every side gets 2 cells longer. The hydra swims a square spiral outwards.\n\nThe 6 itself is not included: with `range`, `stop` is always the first number that is left out.',
        },
      },
      {
        code: '1',
        note: {
          de: 'Mit Schrittweite 1 kommt jede Zahl dran: 1, 2, 3, 4, 5. Die Spirale wächst zu langsam, und die vierte Seite führt in den Rand.',
          en: 'With a step of 1 every number is included: 1, 2, 3, 4, 5. The spiral grows too slowly, and the fourth side runs into the edge.',
        },
      },
      {
        code: '3',
        note: {
          de: '`range(1, 6, 3)` liefert nur 1 und 4, denn die nächste Zahl 7 liegt schon hinter `stop`. Nach zwei Seiten ist Schluss.',
          en: '`range(1, 6, 3)` gives only 1 and 4, because the next number, 7, is already past `stop`. After two sides it is over.',
        },
      },
      {
        code: '0',
        note: {
          de: 'Mit Schrittweite 0 käme `range` nie voran und bliebe ewig bei 1. Darum verbietet Python das und meldet sofort einen `ValueError`.',
          en: 'With a step of 0, `range` would never get anywhere and stay at 1 forever. So Python forbids it and reports a `ValueError` straight away.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'break',
    title: { de: 'Raus aus der Schleife', en: 'Getting out of a loop' },
    intro: {
      de: '`while True:` läuft ohne Ende. Zwei Wörter steuern so eine Schleife von innen: `break` verlässt sie sofort, `continue` springt gleich zum nächsten Durchlauf.',
      en: '`while True:` runs without end. Two words steer such a loop from the inside: `break` leaves it at once, `continue` jumps straight to the next pass.',
    },
    map: ['#####', '>F.F#', '#..F#'],
    code: 'while True:\n    if wall_ahead():\n        ___\n    move()\nturn_right()\nmove()',
    choices: [
      {
        code: 'break',
        note: {
          de: 'Solange der Weg frei ist, schwimmt die Hydra. Steht sie vor dem Felsen, beendet `break` die Schleife. Dann laufen die zwei Zeilen darunter: rechts drehen und zum letzten Fisch schwimmen.\n\n`while True:` mit einem `break` darin ist ein typisches Muster: „Mach immer weiter, bis etwas Bestimmtes passiert.“',
          en: 'While the way is clear, the hydra swims. Once it faces the rock, `break` ends the loop. Then the two lines below run: turn right and swim to the last fish.\n\n`while True:` with a `break` inside is a common pattern: "keep going until something particular happens".',
        },
      },
      {
        code: 'continue',
        note: {
          de: '`continue` springt zurück zum Anfang der Schleife, ohne sie zu verlassen. Die Hydra steht vor dem Felsen, prüft, springt zurück, prüft wieder … Nichts ändert sich mehr, und das Programm hängt für immer.',
          en: '`continue` jumps back to the start of the loop without leaving it. The hydra faces the rock, checks, jumps back, checks again … Nothing changes any more, and the program hangs forever.',
        },
      },
      {
        code: 'pass',
        note: {
          de: '`pass` tut nichts. Nach dem `if` kommt also trotzdem `move()`, und die Hydra schwimmt in den Felsen.',
          en: '`pass` does nothing. So after the `if` comes `move()` anyway, and the hydra swims into the rock.',
        },
      },
      {
        code: 'turn_right()',
        note: {
          de: 'Die Hydra dreht sich vor jeder Wand und schwimmt weiter, so frisst sie sogar alle Fische. Aber die Schleife wird nie verlassen: Die Hydra zieht ewig ihre Runden, und das Programm endet nicht.',
          en: 'The hydra turns in front of every wall and swims on, and so it even eats every fish. But the loop is never left: the hydra swims its laps forever, and the program does not end.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'and-or',
    title: { de: 'Bedingungen verknüpfen', en: 'Combining conditions' },
    intro: {
      de: '`a and b` ist nur `True`, wenn beide Teile stimmen. `a or b` ist schon `True`, wenn mindestens einer stimmt. Hier ist `wall` wahr, wenn vor der Hydra eine Wand ist, und `three`, wenn sie seit der letzten Drehung 3 Schritte geschwommen ist.',
      en: '`a and b` is only `True` when both parts hold. `a or b` is already `True` when at least one of them holds. Here `wall` is true when there is a wall in front of the hydra, and `three` when it has swum 3 steps since its last turn.',
    },
    map: ['>.....', '...F..', 'FF....', '...#..', '......'],
    code: 'steps = 0\nfor i in range(10):\n    wall = wall_ahead()\n    three = steps == 3\n    if ___:\n        turn_right()\n        steps = 0\n    else:\n        move()\n        steps += 1',
    choices: [
      {
        code: 'wall or three',
        note: {
          de: 'Die Hydra dreht ab, sobald eine der beiden Sachen stimmt: Vor ihr ist eine Wand, oder sie ist schon 3 Schritte geradeaus geschwommen. Oben biegt sie nach 3 Schritten ab, danach am Felsen.\n\nIm Variablen-Feld siehst du `wall` und `three` bei jedem Durchlauf neu `True` oder `False` werden. Nach jeder Drehung setzt `steps = 0` den Zähler zurück.',
          en: 'The hydra turns as soon as one of the two things holds: there is a wall in front of it, or it has already swum 3 steps straight. At the top it turns after 3 steps, then at the rock.\n\nIn the variables box you can watch `wall` and `three` become `True` or `False` anew on every pass. After every turn `steps = 0` resets the counter.',
        },
      },
      {
        code: 'wall and three',
        note: {
          de: 'Mit `and` müssten beide Sachen gleichzeitig stimmen: Wand und genau 3 Schritte. Nach 3 Schritten ist aber noch keine Wand da, und als die Wand kommt, ist `steps` schon größer. Die Hydra dreht nie ab und schwimmt gegen den Rand.',
          en: 'With `and`, both things would have to hold at once: a wall and exactly 3 steps. But after 3 steps there is no wall yet, and when the wall comes, `steps` is already larger. The hydra never turns and swims into the edge.',
        },
      },
      {
        code: 'wall',
        note: {
          de: 'Nur auf die Wand zu achten reicht nicht: Die Hydra schwimmt jedes Mal bis ganz an den Rand, eine große Runde außen herum, und verpasst die Fische weiter innen.',
          en: 'Watching only for walls is not enough: every time the hydra swims all the way to the edge, a big lap around the outside, and misses the fish further in.',
        },
      },
      {
        code: 'three',
        note: {
          de: 'Nur Schritte zu zählen reicht nicht: Auf der zweiten Seite kommt der Felsen schon nach 2 Schritten. Die Hydra wartet auf den dritten Schritt und schwimmt hinein.',
          en: 'Only counting steps is not enough: on the second side the rock comes after just 2 steps. The hydra waits for the third step and swims into it.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'function-calls',
    title: { de: 'Funktionen rufen Funktionen auf', en: 'Functions calling functions' },
    intro: {
      de: 'Eine Funktion darf andere Funktionen aufrufen, auch selbst gebaute. `corner(3)` ruft `go(3)` auf, und wenn `go` fertig ist, geht es in `corner` weiter.',
      en: 'A function may call other functions, including ones you built. `corner(3)` calls `go(3)`, and once `go` has finished, `corner` carries on.',
    },
    map: ['.....', '.....', '.....', '>.F..', '.....', '.F.F.'],
    code: 'def go(n):\n    for i in range(n):\n        move()\n\ndef corner(n):\n    go(n)\n    ___\n\ncorner(3)\ncorner(2)\ncorner(3)',
    choices: [
      {
        code: 'turn_right()',
        note: {
          de: '`corner(n)` heißt hier: erst `n` Felder schwimmen (das erledigt `go`), dann rechts drehen. Drei Aufrufe ergeben drei Seiten eines Rechtecks.\n\nBeim Ausführen springt die markierte Zeile in `go`, danach zurück in `corner` und dann zum nächsten Aufruf unten. So baut man aus kleinen Befehlen größere.',
          en: 'Here `corner(n)` means: first swim `n` cells (`go` does that), then turn right. Three calls make three sides of a rectangle.\n\nWhile it runs, the highlighted line jumps into `go`, then back into `corner` and on to the next call below. That is how you build bigger commands out of small ones.',
        },
      },
      {
        code: 'turn_left()',
        note: {
          de: 'Mit `turn_left()` biegt die Hydra an jeder Ecke links ab. Sie schwimmt dieselbe Form, aber gespiegelt nach oben, wo keine Fische mehr liegen.',
          en: 'With `turn_left()` the hydra turns left at every corner. It swims the same shape, but mirrored upwards, where there are no more fish.',
        },
      },
      {
        code: 'go(n)',
        note: {
          de: 'Mit `go(n)` an dieser Stelle schwimmt jede Ecke ihre Strecke zweimal und dreht nie. Schon beim ersten Aufruf sind das 6 Felder geradeaus, und dafür ist das Becken zu schmal.',
          en: 'With `go(n)` in this place every corner swims its distance twice and never turns. The first call alone makes 6 cells straight ahead, and the pool is too narrow for that.',
        },
      },
      {
        code: 'turn_right(n)',
        note: {
          de: 'Der Befehl `turn_right` nimmt keinen Wert in seinen Klammern an: Er dreht immer genau einmal. Mit `n` darin meldet Python einen `TypeError`, weil die Funktion mit diesem Argument nichts anfangen kann.',
          en: 'The command `turn_right` takes no value in its brackets: it always turns exactly once. With `n` inside, Python reports a `TypeError`, because the function cannot do anything with that argument.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'default-args',
    title: { de: 'Standardwerte', en: 'Default values' },
    intro: {
      de: 'Ein Parameter kann einen Standardwert haben: Bei `def go(steps=5):` bekommt `steps` den Wert 5, wenn der Aufruf `go()` nichts mitgibt. `go(1)` gibt dagegen 1 mit.',
      en: 'A parameter can have a default value: with `def go(steps=5):`, `steps` gets the value 5 when the call `go()` passes nothing. `go(1)`, on the other hand, passes 1.',
    },
    map: ['.....', '.>.F#', '..F..'],
    code: 'def go(steps=___):\n    for i in range(steps):\n        move()\n    turn_right()\n\ngo()\ngo(1)\ngo()\ngo(1)',
    choices: [
      {
        code: '2',
        note: {
          de: '`go()` ohne Wert benutzt den Standardwert 2, `go(1)` gibt ausdrücklich 1 mit. So schwimmt die Hydra 2, 1, 2, 1 Felder: ein schmales Rechteck mit beiden Fischen am Rand.\n\nStandardwerte sind praktisch für den häufigsten Fall: Man muss ihn nicht jedes Mal hinschreiben.',
          en: '`go()` without a value uses the default 2, `go(1)` passes 1 explicitly. So the hydra swims 2, 1, 2, 1 cells: a narrow rectangle with both fish on its edge.\n\nDefault values are handy for the most common case: you do not have to write it out every time.',
        },
      },
      {
        code: '1',
        note: {
          de: 'Mit Standardwert 1 sind alle vier Seiten nur ein Feld lang, denn auch `go(1)` schwimmt 1. Die Runde ist ein kleines Quadrat, und ein Fisch bleibt übrig.',
          en: 'With a default of 1 all four sides are one cell long, since `go(1)` swims 1 as well. The lap is a little square, and one fish is left over.',
        },
      },
      {
        code: '3',
        note: {
          de: 'Mit Standardwert 3 schwimmt schon der erste Aufruf `go()` drei Felder weit, und dort liegt ein Felsen.',
          en: 'With a default of 3 the very first call `go()` swims three cells, and there is a rock there.',
        },
      },
      {
        code: 'steps',
        note: {
          de: 'Der Standardwert wird schon ausgerechnet, wenn die Zeile mit `def` läuft. Da gibt es noch keine Variable `steps` (der Parameter entsteht erst beim Aufruf), also meldet Python einen `NameError`.',
          en: 'The default value is worked out as soon as the `def` line runs. At that point there is no variable `steps` yet (the parameter only comes to life in a call), so Python reports a `NameError`.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'while-index',
    title: { de: 'Mit while durch eine Liste', en: 'Through a list with while' },
    intro: {
      de: '`len(plan)` sagt, wie viele Werte in der Liste `plan` stehen. Mit einer Zählvariablen `k` kann eine `while`-Schleife die Liste Platz für Platz durchgehen: `plan[0]`, `plan[1]`, …',
      en: '`len(plan)` tells how many values are in the list `plan`. With a counter variable `k`, a `while` loop can go through the list place by place: `plan[0]`, `plan[1]`, …',
    },
    map: ['.....', '.....', '.....', '.F.F.', '>.F..'],
    code: 'plan = [3, 1, 2]\nk = 0\nwhile k < ___:\n    for i in range(plan[k]):\n        move()\n    turn_left()\n    k += 1',
    choices: [
      {
        code: 'len(plan)',
        note: {
          de: '`len(plan)` ist 3, also läuft die Schleife für `k` = 0, 1 und 2, genau einmal pro Platz der Liste. Danach ist `k` gleich 3, die Bedingung `3 < 3` ist falsch, und die Schleife hört auf.\n\nIm Grunde erledigt `for` mit einer Liste genau das für dich. Mit `while` siehst du jeden Schritt selbst.',
          en: '`len(plan)` is 3, so the loop runs for `k` = 0, 1 and 2, exactly once per place of the list. Then `k` is 3, the condition `3 < 3` is false, and the loop stops.\n\nThis is basically what `for` over a list does for you. With `while` you see every step yourself.',
        },
      },
      {
        code: 'len(plan) - 1',
        note: {
          de: 'Mit `len(plan) - 1` hört die Schleife einen Platz zu früh auf: Die letzte Zahl der Liste kommt nie dran, und die letzte Seite fehlt.',
          en: 'With `len(plan) - 1` the loop stops one place too early: the last number of the list never gets its turn, and the last side is missing.',
        },
      },
      {
        code: 'len(plan) + 1',
        note: {
          de: 'Mit `len(plan) + 1` läuft die Schleife einmal zu oft. Im vierten Durchlauf fragt sie nach `plan[3]`, aber die Liste hat nur die Plätze 0, 1 und 2: `IndexError`. Die Fische sind zwar gefressen, aber das Programm bricht mit einem Fehler ab.',
          en: 'With `len(plan) + 1` the loop runs once too often. On the fourth pass it asks for `plan[3]`, but the list only has the places 0, 1 and 2: `IndexError`. The fish are eaten, but the program stops with an error.',
        },
      },
      {
        code: 'k',
        note: {
          de: '`k < k` ist nie wahr, denn keine Zahl ist kleiner als sie selbst. Die Schleife läuft kein einziges Mal.',
          en: '`k < k` is never true, because no number is smaller than itself. The loop does not run even once.',
        },
      },
    ],
    answerIndex: 0,
  },
];
