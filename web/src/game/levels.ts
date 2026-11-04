import type { PuzzleChoice, PuzzleLevel } from './puzzle.ts';

export { fill, GAP } from './puzzle.ts';

/** One answer for the gap: code (the same in every language) and what it does. */
export type GameChoice = PuzzleChoice;

/**
 * A level of the fishing game: a program with one gap, four answers for it
 * and the arena the hydra swims in. Only the right answer eats every fish.
 */
export interface GameLevel extends PuzzleLevel {
  /** Arena rows: `#` rock, `.` water, `F` fish, the hydra's start `^ > v <`. */
  map: string[];
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
  {
    id: 'if-else',
    title: { de: 'if und else', en: 'if and else' },
    intro: {
      de: 'Nach einem `if` darf ein `else:` stehen. Dessen eingerückter Teil läuft genau dann, wenn die Bedingung des `if` nicht stimmt. Es läuft also immer genau eines von beiden.',
      en: 'An `if` may be followed by an `else:`. Its indented part runs exactly when the condition of the `if` does not hold. So exactly one of the two always runs.',
    },
    map: ['>...', '...F', '.F..'],
    code: 'for i in range(9):\n    if wall_ahead():\n        turn_right()\n    else:\n        ___',
    choices: [
      {
        code: 'move()',
        note: {
          de: 'Steht eine Wand im Weg, dreht sich die Hydra. Sonst, im `else`, schwimmt sie ein Feld. So läuft sie an der Wand entlang und biegt an jeder Ecke ab, und dabei kommt sie an beiden Fischen vorbei.\n\nDer Computer entscheidet bei jedem Durchlauf neu: entweder drehen oder schwimmen, nie beides.',
          en: 'If a wall is in the way, the hydra turns. Otherwise, in the `else`, it swims one cell. So it follows the wall and turns at every corner, passing both fish on the way.\n\nThe computer decides anew on every pass: either turn or swim, never both.',
        },
      },
      {
        code: 'turn_left()',
        note: {
          de: 'Im `else` dreht sich die Hydra nach links, obwohl der Weg frei ist. Dann steht sie vor dem Rand, dreht nach rechts, und so wackelt sie auf der Stelle hin und her. Sie schwimmt nie.',
          en: 'In the `else` the hydra turns left even though the way is clear. Then it faces the edge, turns right, and so it wobbles back and forth on the spot. It never swims.',
        },
      },
      {
        code: 'pass',
        note: {
          de: 'Der Weg ist frei, also läuft der `else`-Teil, und der tut mit `pass` nichts. Die Hydra bleibt am Start stehen und alle Durchläufe vergehen.',
          en: 'The way is clear, so the `else` part runs, and with `pass` it does nothing. The hydra stays at the start and all the passes go by.',
        },
      },
      {
        code: 'stop()',
        note: {
          de: 'Einen Befehl `stop()` gibt es nicht. Sobald der `else`-Teil läuft, meldet Python einen `NameError`, und das Programm bricht ab.',
          en: 'There is no command `stop()`. As soon as the `else` part runs, Python reports a `NameError` and the program stops.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'count-down',
    title: { de: 'Rückwärts zählen', en: 'Counting down' },
    intro: {
      de: '`n -= 1` zieht 1 von `n` ab, das Gegenstück zu `n += 1`. Die `while`-Schleife läuft, solange `n > 0` stimmt, und hört auf, sobald `n` die 0 erreicht oder unterschreitet.',
      en: '`n -= 1` subtracts 1 from `n`, the counterpart of `n += 1`. The `while` loop runs as long as `n > 0` holds and stops once `n` reaches 0 or goes below it.',
    },
    map: ['>...', '...F', '..F.'],
    code: 'n = 3\nwhile n > 0:\n    for i in range(n):\n        move()\n    turn_right()\n    n -= ___',
    choices: [
      {
        code: '1',
        note: {
          de: '`n` zählt 3, 2, 1 und dann 0, wo die Schleife endet. Die Seiten werden kürzer: 3, 2, 1 Felder. Das ergibt eine Spirale nach innen, die beide Fische trifft.\n\nIm Variablen-Feld siehst du `n` nach jeder Runde schrumpfen.',
          en: '`n` counts 3, 2, 1 and then 0, where the loop ends. The sides get shorter: 3, 2, 1 cells. That makes a spiral inwards that hits both fish.\n\nIn the variables box you can watch `n` shrink after every round.',
        },
      },
      {
        code: '2',
        note: {
          de: 'Mit `n -= 2` ist `n` erst 3, dann 1, dann -1. Die Schleife endet nach zwei Seiten, und der letzte Fisch bleibt liegen.',
          en: 'With `n -= 2`, `n` is first 3, then 1, then -1. The loop ends after two sides, and the last fish is left behind.',
        },
      },
      {
        code: '3',
        note: {
          de: 'Mit `n -= 3` ist `n` nach der ersten Seite schon 0. Die Schleife endet sofort, und die Hydra hat nur eine Seite geschwommen.',
          en: 'With `n -= 3`, `n` is already 0 after the first side. The loop ends at once, and the hydra has swum only one side.',
        },
      },
      {
        code: '0',
        note: {
          de: 'Mit `n -= 0` bleibt `n` für immer 3. Die Bedingung `n > 0` stimmt immer, jede Seite ist drei Felder lang, und schon auf der zweiten Seite stößt die Hydra an den Rand.',
          en: 'With `n -= 0`, `n` stays 3 forever. The condition `n > 0` always holds, every side is three cells long, and on the second side the hydra already hits the edge.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'variable-use',
    title: { de: 'Variable benutzen', en: 'Using a variable' },
    intro: {
      de: 'Eine Variable merkt sich eine Zahl, und du kannst sie überall benutzen, wo eine Zahl stehen darf, zum Beispiel in `range(...)`. Ändert sich die Variable oben, ändert sich alles, was sie benutzt.',
      en: 'A variable remembers a number, and you can use it anywhere a number may stand, for example in `range(...)`. If the variable at the top changes, everything that uses it changes too.',
    },
    map: ['>...', '...F'],
    code: 'steps = 3\nfor i in range(___):\n    move()\nturn_right()\nmove()',
    choices: [
      {
        code: 'steps',
        note: {
          de: '`steps` ist 3, also schwimmt die Hydra drei Felder nach rechts, dreht sich nach unten und frisst den Fisch.\n\nDen Namen der Variablen setzt du einfach dorthin, wo die Zahl hin soll.',
          en: '`steps` is 3, so the hydra swims three cells to the right, turns down and eats the fish.\n\nYou simply put the name of the variable where the number should go.',
        },
      },
      {
        code: 'steps + 1',
        note: {
          de: '`steps + 1` ist 4. Nach drei Feldern ist die Hydra schon am Rand, das vierte `move()` stößt an die Wand.',
          en: '`steps + 1` is 4. After three cells the hydra is already at the edge, and the fourth `move()` hits the wall.',
        },
      },
      {
        code: 'steps - 1',
        note: {
          de: '`steps - 1` ist 2. Die Hydra dreht sich ein Feld zu früh nach unten und schwimmt am Fisch vorbei.',
          en: '`steps - 1` is 2. The hydra turns down one cell too early and swims past the fish.',
        },
      },
      {
        code: 'step',
        note: {
          de: 'Eine Variable `step` gibt es nicht. Die Variable heißt anders. Python meldet einen `NameError`, und das Programm bricht ab, bevor die Hydra schwimmt.',
          en: 'There is no variable `step`; the variable is named differently. Python reports a `NameError`, and the program stops before the hydra swims.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'reassign',
    title: { de: 'Variable neu setzen', en: 'Changing a variable' },
    intro: {
      de: 'Eine Variable darf sich selbst neu berechnen: `n = n * 3` nimmt den alten Wert von `n`, rechnet damit und speichert das Ergebnis wieder in `n`. Danach hat `n` den neuen Wert.',
      en: 'A variable may recalculate itself: `n = n * 3` takes the old value of `n`, calculates with it and stores the result in `n` again. After that `n` has the new value.',
    },
    map: ['#######', '>.....F', '#######'],
    code: 'n = 2\nn = n * ___\nfor i in range(n):\n    move()',
    choices: [
      {
        code: '3',
        note: {
          de: '`n` ist erst 2, dann `2 * 3`, also 6. Sechs Felder bringen die Hydra genau zum Fisch.',
          en: '`n` is 2 first, then `2 * 3`, which is 6. Six cells take the hydra exactly to the fish.',
        },
      },
      {
        code: '2',
        note: {
          de: 'Dann ist `n` gleich 4, und die Hydra schwimmt nur vier Felder. Der Fisch ist noch zwei Felder weg.',
          en: 'Then `n` is 4, and the hydra swims only four cells. The fish is still two cells away.',
        },
      },
      {
        code: '4',
        note: {
          de: 'Dann ist `n` gleich 8. Die Hydra schwimmt am Fisch vorbei und stößt auf das Ende des Beckens.',
          en: 'Then `n` is 8. The hydra swims past the fish and bumps into the end of the pool.',
        },
      },
      {
        code: '1',
        note: {
          de: 'Dann bleibt `n` gleich 2, denn `2 * 1` ist wieder 2. Die Hydra schwimmt nur zwei Felder.',
          en: 'Then `n` stays 2, because `2 * 1` is 2 again. The hydra swims only two cells.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'fish-ahead',
    title: { de: 'Ist ein Fisch vor mir?', en: 'Is there a fish ahead?' },
    intro: {
      de: '`fish_ahead()` ist wahr, wenn direkt vor der Hydra ein Fisch liegt. Mit `not` kehrst du das um. So kann eine `while`-Schleife sich drehen, bis sie den Fisch sieht.',
      en: '`fish_ahead()` is true when a fish lies right in front of the hydra. `not` turns that around. So a `while` loop can keep turning until it sees the fish.',
    },
    map: ['...', '.>.', '.F.'],
    code: 'while ___:\n    turn_left()\nmove()',
    choices: [
      {
        code: 'not fish_ahead()',
        note: {
          de: 'Solange kein Fisch vor ihr liegt, dreht sich die Hydra nach links: nach oben, nach links, nach unten. Dort liegt der Fisch, die Schleife endet, und `move()` frisst ihn.',
          en: 'As long as no fish lies ahead, the hydra turns left: up, left, down. There the fish is, the loop ends, and `move()` eats it.',
        },
      },
      {
        code: 'fish_ahead()',
        note: {
          de: 'Am Anfang liegt kein Fisch vor der Hydra, die Bedingung ist falsch, und die Schleife läuft gar nicht. Das `move()` bringt sie nach rechts, weg vom Fisch.',
          en: 'At the start no fish lies ahead of the hydra, so the condition is false and the loop does not run at all. The `move()` takes it to the right, away from the fish.',
        },
      },
      {
        code: 'not wall_ahead()',
        note: {
          de: 'Hier ist nirgends eine Wand vor der Hydra, die Bedingung bleibt immer wahr. Die Hydra dreht sich für immer im Kreis.',
          en: 'There is no wall ahead of the hydra anywhere here, so the condition stays true. The hydra turns around in circles forever.',
        },
      },
      {
        code: 'not fish()',
        note: {
          de: 'Einen Befehl `fish()` gibt es nicht, nur `fish_ahead()`. Python meldet einen `NameError`.',
          en: 'There is no command `fish()`, only `fish_ahead()`. Python reports a `NameError`.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'modulo',
    title: { de: 'Gerade und ungerade', en: 'Even and odd' },
    intro: {
      de: '`i % 2` ist der Rest, wenn du `i` durch 2 teilst: abwechselnd 0, 1, 0, 1, … So kannst du jeden zweiten Durchlauf etwas Besonderes tun lassen.',
      en: '`i % 2` is the remainder when you divide `i` by 2: alternately 0, 1, 0, 1, … So you can make every second pass do something special.',
    },
    map: ['>.F', '...', 'F..'],
    code: 'for i in range(8):\n    move()\n    if i % 2 == ___:\n        turn_right()',
    choices: [
      {
        code: '1',
        note: {
          de: 'Der Rest ist bei `i` = 1, 3, 5, 7 gleich 1, also dreht sich die Hydra nach jedem zweiten Schritt. Sie schwimmt ein Quadrat mit Seitenlänge 2 und kommt an beiden Fischen vorbei.',
          en: 'The remainder is 1 for `i` = 1, 3, 5, 7, so the hydra turns after every second step. It swims a square with sides of 2 and passes both fish.',
        },
      },
      {
        code: '0',
        note: {
          de: 'Der Rest ist bei `i` = 0, 2, 4, 6 gleich 0, also dreht sich die Hydra schon nach dem ersten Schritt und gerät aus dem Takt. Bald stößt sie an den Rand.',
          en: 'The remainder is 0 for `i` = 0, 2, 4, 6, so the hydra already turns after the first step and gets out of rhythm. Soon it hits the edge.',
        },
      },
      {
        code: '2',
        note: {
          de: 'Ein Rest durch 2 ist nie 2, nur 0 oder 1. Die Hydra dreht sich nie, schwimmt geradeaus und stößt an den Rand.',
          en: 'A remainder after dividing by 2 is never 2, only 0 or 1. The hydra never turns, swims straight ahead and hits the edge.',
        },
      },
      {
        code: 'i',
        note: {
          de: '`i % 2 == i` stimmt nur für `i` = 0 und 1. Die Hydra dreht sich also nur in den ersten beiden Durchläufen und schwimmt dann geradeaus in die Wand.',
          en: '`i % 2 == i` is true only for `i` = 0 and 1. So the hydra turns only in the first two passes and then swims straight into the wall.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'range-start',
    title: { de: 'range mit Start', en: 'range with a start' },
    intro: {
      de: '`range(2, 5)` zählt 2, 3, 4: Es fängt beim ersten Wert an und hört vor dem zweiten auf. Hier wird `n` so zur Länge der Seiten, die immer länger werden.',
      en: '`range(2, 5)` counts 2, 3, 4: it starts at the first value and stops before the second. Here `n` becomes the length of the sides, which get longer and longer.',
    },
    map: ['>F.', '...', '...', '..F'],
    code: 'for n in range(2, ___):\n    for i in range(n):\n        move()\n    turn_right()',
    choices: [
      {
        code: '4',
        note: {
          de: '`n` ist 2 und 3: erst zwei Felder nach rechts, dann drei nach unten. Beide Fische liegen auf dem Weg.',
          en: '`n` is 2 and 3: first two cells to the right, then three down. Both fish lie on the way.',
        },
      },
      {
        code: '3',
        note: {
          de: 'Dann ist `n` nur 2: eine einzige Seite. Der Fisch unten bleibt liegen.',
          en: 'Then `n` is only 2: a single side. The fish at the bottom is left behind.',
        },
      },
      {
        code: '5',
        note: {
          de: 'Dann ist `n` 2, 3 und 4. Die vierte Seite ist zu lang: Nach links stößt die Hydra an den Rand.',
          en: 'Then `n` is 2, 3 and 4. The last side is too long: going left, the hydra hits the edge.',
        },
      },
      {
        code: '2',
        note: {
          de: '`range(2, 2)` ist leer, denn es hört auf, bevor es anfängt. Die Hydra rührt sich nicht.',
          en: '`range(2, 2)` is empty, because it stops before it starts. The hydra does not move.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'while-step',
    title: { de: 'In Zweierschritten', en: 'In steps of two' },
    intro: {
      de: '`steps += 2` zählt in Zweierschritten: 0, 2, 4, 6, … Die Schleife läuft, solange `steps` kleiner als die Grenze ist. Die Zahl der Durchläufe ist also nicht die Grenze selbst.',
      en: '`steps += 2` counts in twos: 0, 2, 4, 6, … The loop runs as long as `steps` is smaller than the limit. So the number of passes is not the limit itself.',
    },
    map: ['>..F'],
    code: 'steps = 0\nwhile steps < ___:\n    move()\n    steps += 2',
    choices: [
      {
        code: '6',
        note: {
          de: '`steps` ist 0, 2, 4 beim Eintritt, danach 6 und Schluss: drei Durchläufe, drei Felder, und der Fisch ist gefressen.',
          en: '`steps` is 0, 2, 4 on entering, then 6 and done: three passes, three cells, and the fish is eaten.',
        },
      },
      {
        code: '4',
        note: {
          de: 'Bei 4 endet die Schleife nach zwei Durchläufen (`steps` ist 0 und 2). Die Hydra bleibt ein Feld vor dem Fisch stehen.',
          en: 'At 4 the loop ends after two passes (`steps` is 0 and 2). The hydra stops one cell before the fish.',
        },
      },
      {
        code: '8',
        note: {
          de: 'Bei 8 gibt es vier Durchläufe (0, 2, 4, 6). Das vierte `move()` stößt an den Rand.',
          en: 'At 8 there are four passes (0, 2, 4, 6). The fourth `move()` hits the edge.',
        },
      },
      {
        code: '2',
        note: {
          de: 'Bei 2 gibt es nur einen Durchlauf (nur bei `steps` = 0). Die Hydra schwimmt ein einziges Feld.',
          en: 'At 2 there is only one pass (only for `steps` = 0). The hydra swims a single cell.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'equals-if',
    title: { de: 'Genau beim dritten Mal', en: 'Exactly the third time' },
    intro: {
      de: 'Mit `i == 2` drehst du nur in dem einen Durchlauf, in dem `i` genau 2 ist. Weil `i` bei 0 anfängt, ist das der dritte Durchlauf. Zwei Gleichheitszeichen vergleichen, eines speichert.',
      en: 'With `i == 2` you turn only in the one pass where `i` is exactly 2. Because `i` starts at 0, that is the third pass. Two equals signs compare, one stores.',
    },
    map: ['>.....', '......', '...F..', '......'],
    code: 'for i in range(5):\n    move()\n    if i == ___:\n        turn_right()',
    choices: [
      {
        code: '2',
        note: {
          de: 'Im dritten Durchlauf (`i` = 2) steht die Hydra drei Felder rechts. Sie dreht sich nach unten, schwimmt zwei Felder und frisst den Fisch.',
          en: 'In the third pass (`i` = 2) the hydra is three cells to the right. It turns down, swims two cells and eats the fish.',
        },
      },
      {
        code: '1',
        note: {
          de: 'Schon nach zwei Feldern dreht sie sich nach unten und schwimmt damit am Fisch vorbei, in der Spalte daneben.',
          en: 'It turns down after only two cells and so swims past the fish, in the column next to it.',
        },
      },
      {
        code: '0',
        note: {
          de: 'Schon nach dem ersten Feld dreht sie sich nach unten und stößt nach drei Feldern unten an den Rand.',
          en: 'It turns down after the first cell and hits the bottom edge after three cells.',
        },
      },
      {
        code: '4',
        note: {
          de: 'Im letzten Durchlauf ist es zu spät: Die Hydra hat schon fünf Felder geradeaus geschwommen, und die Drehung am Ende bringt nichts mehr.',
          en: 'The last pass is too late: the hydra has already swum five cells straight ahead, and the turn at the end achieves nothing.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'function-loop',
    title: { de: 'Funktion wiederholen', en: 'Repeating a function' },
    intro: {
      de: 'Eine Funktion fasst mehrere Befehle unter einem Namen zusammen. Mit einer Schleife rufst du sie so oft auf, wie du willst. Hier macht jeder Aufruf einen Schritt nach rechts und einen nach unten, wie eine Treppenstufe.',
      en: 'A function bundles several commands under one name. With a loop you call it as often as you like. Here each call makes one step to the right and one down, like a stair step.',
    },
    map: ['>...', '.F..', '..F.', '...F'],
    code: 'def zigzag():\n    move()\n    turn_right()\n    move()\n    turn_left()\n\nfor i in range(___):\n    zigzag()',
    choices: [
      {
        code: '3',
        note: {
          de: 'Drei Stufen führen genau über alle drei Fische, bis in die Ecke unten rechts.',
          en: 'Three steps lead exactly over all three fish, down to the bottom right corner.',
        },
      },
      {
        code: '2',
        note: {
          de: 'Zwei Stufen reichen nur für die ersten beiden Fische. Der dritte bleibt liegen.',
          en: 'Two steps only reach the first two fish. The third is left behind.',
        },
      },
      {
        code: '4',
        note: {
          de: 'Die vierte Stufe geht aus dem Becken hinaus: Das `move()` stößt an den Rand.',
          en: 'The fourth step leads out of the pool: the `move()` hits the edge.',
        },
      },
      {
        code: '1',
        note: {
          de: 'Eine Stufe frisst nur den ersten Fisch.',
          en: 'One step eats only the first fish.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'swap',
    title: { de: 'Werte tauschen', en: 'Swapping values' },
    intro: {
      de: 'Um zwei Variablen zu tauschen, brauchst du einen Zwischenspeicher: Merke dir zuerst einen der Werte in `temp`, bevor du ihn überschreibst. Sonst ist er für immer weg.',
      en: 'To swap two variables you need a temporary store: remember one of the values in `temp` first, before you overwrite it. Otherwise it is gone for good.',
    },
    map: ['>..', '.F.', '...', '.F.'],
    code: 'a = 3\nb = 1\ntemp = a\na = b\nb = ___\nfor i in range(a):\n    move()\nturn_right()\nfor i in range(b):\n    move()',
    choices: [
      {
        code: 'temp',
        note: {
          de: '`temp` merkt sich das alte `a`, also 3. Nach dem Tausch ist `a` gleich 1 und `b` gleich 3: ein Feld nach rechts, drei nach unten, über beide Fische.',
          en: '`temp` remembers the old `a`, which is 3. After the swap `a` is 1 and `b` is 3: one cell to the right, three down, over both fish.',
        },
      },
      {
        code: 'a',
        note: {
          de: '`a` ist schon überschrieben und gleich 1, also ist auch `b` gleich 1. Die Hydra schwimmt nur ein Feld nach unten und frisst nur einen Fisch.',
          en: '`a` has already been overwritten and is 1, so `b` is 1 as well. The hydra swims only one cell down and eats only one fish.',
        },
      },
      {
        code: 'a + 1',
        note: {
          de: 'Das ergibt 2 für `b`. Die Hydra schwimmt zwei Felder nach unten und bleibt vor dem zweiten Fisch stehen.',
          en: 'That makes `b` equal to 2. The hydra swims two cells down and stops short of the second fish.',
        },
      },
      {
        code: 'tmp',
        note: {
          de: 'Eine Variable `tmp` gibt es nicht. Die Variable heißt anders. Python meldet einen `NameError`.',
          en: 'There is no variable `tmp`; the variable is named differently. Python reports a `NameError`.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'spiral',
    title: { de: 'Wachsende Spirale', en: 'A growing spiral' },
    intro: {
      de: 'Eine Funktion kann eine Zahl bekommen, und eine Schleife kann ihr bei jedem Aufruf eine größere Zahl geben. So wird jede Seite der Spirale um ein Feld länger als die vorige.',
      en: 'A function can take a number, and a loop can give it a larger number on every call. So each side of the spiral is one cell longer than the one before.',
    },
    map: ['.....', '.....', '#.>..', '...F.', '.F...'],
    code: 'def side(n):\n    for i in range(n):\n        move()\n    turn_right()\n\nfor n in range(1, ___):\n    side(n)',
    choices: [
      {
        code: '4',
        note: {
          de: 'Die Seiten sind 1, 2 und 3 lang: erst nach rechts, dann nach unten über den ersten Fisch, dann nach links über den zweiten.',
          en: 'The sides are 1, 2 and 3 long: first right, then down over the first fish, then left over the second.',
        },
      },
      {
        code: '3',
        note: {
          de: 'Dann gibt es nur zwei Seiten. Der Fisch unten links bleibt liegen.',
          en: 'Then there are only two sides. The fish at the bottom left is left behind.',
        },
      },
      {
        code: '5',
        note: {
          de: 'Dann kommt noch eine vierte Seite nach oben. Nach zwei Feldern steht dort ein Felsen, und die Hydra stößt dagegen.',
          en: 'Then a fourth side goes up. After two cells there is a rock, and the hydra bumps into it.',
        },
      },
      {
        code: '2',
        note: {
          de: 'Dann gibt es nur eine einzige Seite, ein Feld nach rechts. Beide Fische bleiben liegen.',
          en: 'Then there is just a single side, one cell to the right. Both fish are left behind.',
        },
      },
    ],
    answerIndex: 0,
  },
];
