import type { PuzzleLevel } from './puzzle.ts';

/**
 * A level of "Hydra hunt": a program with one gap, four answers for it and
 * the map the warrior walks. Only the right answer slays every hydra and
 * picks up all the gold.
 */
export interface HuntLevel extends PuzzleLevel {
  /** Map rows: `#` rock, `.` grass, `@` the warrior's start, `G` gold, `H` a hydra's head, `o` its body. */
  map: string[];
}

export const HUNT_LEVELS: readonly HuntLevel[] = [
  {
    id: 'hunt-steps',
    title: { de: 'Schritt für Schritt', en: 'Step by step' },
    intro: {
      de: 'Der Krieger geht mit `move_east()` ein Feld nach rechts (Osten), mit `move_south()` eins nach unten (Süden). Steht er auf dem Körper einer Hydra, schlägt `attack()` sie in zwei Teile.',
      en: "The warrior walks one cell to the right (east) with `move_east()`, one cell down (south) with `move_south()`. When he stands on a hydra's body, `attack()` cuts it in two.",
    },
    map: ['@.oH', '....'],
    code: 'move_east()\n___\nattack()',
    choices: [
      {
        code: 'move_east()',
        note: {
          de: 'Zweimal `move_east()` bringt den Krieger genau auf den Körper der Hydra, und `attack()` besiegt sie.\n\nPython führt die Zeilen von oben nach unten aus, eine nach der anderen.',
          en: "Two `move_east()` take the warrior right onto the hydra's body, and `attack()` defeats it.\n\nPython runs the lines from top to bottom, one after the other.",
        },
      },
      {
        code: 'move_south()',
        note: {
          de: '`move_south()` führt nach unten. Dort ist nur Gras, und der Schlag geht ins Leere.',
          en: '`move_south()` goes down. There is only grass there, and the blow hits only air.',
        },
      },
      {
        code: 'attack()',
        note: {
          de: 'Der Krieger schlägt zu, bevor er bei der Hydra ist: Auf seinem Feld ist nichts, der Schlag geht ins Leere.',
          en: 'The warrior strikes before he has reached the hydra: there is nothing on his cell, so the blow hits only air.',
        },
      },
      {
        code: 'move_north()',
        note: {
          de: '`move_north()` führt nach oben. Der Krieger steht aber schon in der obersten Reihe und läuft gegen den Rand.',
          en: '`move_north()` goes up. But the warrior is already in the top row, so he walks into the edge.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'hunt-head',
    title: { de: 'Vorsicht, Kopf!', en: 'Mind the head!' },
    intro: {
      de: 'Auf den Körper einer Hydra darf der Krieger treten, auf ihren Kopf nicht: Der frisst ihn. Ist die Hydra besiegt, kann er auch über den Kopf gehen. Gold sammelt er ein, indem er auf das Feld geht.',
      en: "The warrior may step on a hydra's body, but not on its head: that eats him. Once the hydra is defeated, he can walk over the head too. He picks up gold by walking onto its cell.",
    },
    map: ['@oHG', '....'],
    code: 'move_east()\n___\nmove_east()\nmove_east()',
    choices: [
      {
        code: 'attack()',
        note: {
          de: 'Erst schlägt der Krieger die Hydra auf ihrem Körper, dann ist ihr Kopf harmlos. Er geht darüber hinweg und holt das Gold.',
          en: 'First the warrior strikes the hydra on its body, then its head is harmless. He walks over it and gets the gold.',
        },
      },
      {
        code: 'move_east()',
        note: {
          de: 'Der Krieger geht weiter, solange die Hydra lebt, und tritt direkt auf ihren Kopf. Der frisst ihn.',
          en: 'The warrior walks on while the hydra is alive and steps right onto its head. It eats him.',
        },
      },
      {
        code: 'pass',
        note: {
          de: '`pass` tut nichts. Die Hydra lebt also noch, als der Krieger auf ihren Kopf tritt.',
          en: '`pass` does nothing. So the hydra is still alive when the warrior steps onto its head.',
        },
      },
      {
        code: 'Attack()',
        note: {
          de: 'Python unterscheidet Groß- und Kleinschreibung: `Attack` ist ein anderer Name als `attack`, und den kennt Python nicht. Es bricht mit einem `NameError` ab.',
          en: 'Python is case-sensitive: `Attack` is a different name from `attack`, and Python does not know it. It stops with a `NameError`.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'hunt-for',
    title: { de: 'Wiederholen mit for', en: 'Repeating with for' },
    intro: {
      de: '`for i in range(n):` führt die eingerückten Zeilen darunter `n`-mal aus. So muss man `move_east()` nicht immer wieder hinschreiben.',
      en: '`for i in range(n):` runs the indented lines below it `n` times. That way you need not write `move_east()` again and again.',
    },
    map: ['@...oH', '....o.'],
    code: 'for i in range(___):\n    move_east()\nattack()',
    choices: [
      {
        code: '4',
        note: {
          de: '`range(4)` zählt 0, 1, 2, 3: Der Krieger geht viermal und steht genau auf dem Körper der Hydra.',
          en: "`range(4)` counts 0, 1, 2, 3: the warrior walks four times and stands right on the hydra's body.",
        },
      },
      {
        code: '3',
        note: {
          de: 'Drei Schritte reichen nicht bis zur Hydra. Der Schlag geht ins Leere.',
          en: 'Three steps do not reach the hydra. The blow hits only air.',
        },
      },
      {
        code: '5',
        note: {
          de: 'Ein Schritt zu viel: Der Krieger geht über den Körper hinaus auf den Kopf, und der frisst ihn.',
          en: 'One step too many: the warrior walks past the body onto the head, and it eats him.',
        },
      },
      {
        code: '"4"',
        note: {
          de: 'Mit Anführungszeichen ist das ein Text, keine Zahl. Mit einem Text kann `range` nicht zählen: `TypeError`.',
          en: 'With quotes this is a text, not a number. `range` cannot count with a text: `TypeError`.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'hunt-loop-body',
    title: { de: 'Zwei Zeilen in der Schleife', en: 'Two lines in the loop' },
    intro: {
      de: 'Alle eingerückten Zeilen gehören zur Schleife und laufen bei jeder Runde, eine nach der anderen.',
      en: 'All the indented lines belong to the loop and run in every round, one after the other.',
    },
    map: ['@...', '.G..', '..G.', '...G'],
    code: 'for i in range(3):\n    move_east()\n    ___',
    choices: [
      {
        code: 'move_south()',
        note: {
          de: 'In jeder Runde ein Schritt nach rechts und einer nach unten: So geht der Krieger die Treppe hinab und sammelt jedes Gold ein.',
          en: 'In every round one step right and one step down: that way the warrior walks down the stairs and picks up every piece of gold.',
        },
      },
      {
        code: 'move_north()',
        note: {
          de: 'Nach oben geht es nicht, der Krieger steht schon in der obersten Reihe und läuft gegen den Rand.',
          en: 'There is no way up: the warrior is already in the top row and walks into the edge.',
        },
      },
      {
        code: 'move_east()',
        note: {
          de: 'Zwei Schritte nach rechts pro Runde: Der Krieger bleibt in der obersten Reihe und läuft bald gegen den Rand.',
          en: 'Two steps right per round: the warrior stays in the top row and soon walks into the edge.',
        },
      },
      {
        code: 'pass',
        note: {
          de: 'Mit `pass` geht der Krieger nur nach rechts, immer in der obersten Reihe. Das Gold liegt aber weiter unten.',
          en: 'With `pass` the warrior only walks right, always in the top row. But the gold lies further down.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'hunt-function',
    title: { de: 'Eine eigene Funktion', en: 'A function of your own' },
    intro: {
      de: 'Mit `def` gibst du mehreren Zeilen einen Namen. Sie laufen erst, wenn du die Funktion mit Klammern aufrufst, zum Beispiel `strike()`.',
      en: 'With `def` you give several lines a name. They only run when you call the function with brackets, for example `strike()`.',
    },
    map: ['@....', '.o.o.', '.H.H.'],
    code: 'def strike():\n    move_south()\n    attack()\n    move_north()\n\nmove_east()\nstrike()\nmove_east()\nmove_east()\n___',
    choices: [
      {
        code: 'strike()',
        note: {
          de: 'Jeder Aufruf `strike()` führt die drei Zeilen der Funktion aus: hinunter, zuschlagen, wieder hinauf. Zweimal aufgerufen, für zwei Hydras.',
          en: 'Every call `strike()` runs the three lines of the function: down, strike, back up. Called twice, for two hydras.',
        },
      },
      {
        code: 'strike',
        note: {
          de: 'Ohne Klammern nennt die Zeile nur den Namen der Funktion, sie ruft sie nicht auf. Die zweite Hydra bleibt am Leben.',
          en: 'Without brackets the line only names the function, it does not call it. The second hydra stays alive.',
        },
      },
      {
        code: 'attack()',
        note: {
          de: 'Der Krieger steht oben auf dem Gras, nicht auf der Hydra. Der Schlag geht ins Leere.',
          en: 'The warrior stands up on the grass, not on the hydra. The blow hits only air.',
        },
      },
      {
        code: 'Strike()',
        note: {
          de: 'Die Funktion heißt klein geschrieben. `Strike` mit großem S kennt Python nicht: `NameError`.',
          en: 'The function is named in lower case. Python does not know `Strike` with a capital S: `NameError`.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'hunt-parameter',
    title: { de: 'Ein Parameter', en: 'A parameter' },
    intro: {
      de: 'Ein Parameter wie `n` ist ein Platzhalter: Bei `walk(3)` ist `n` in der Funktion 3, bei `walk(2)` ist es 2.',
      en: 'A parameter such as `n` is a placeholder: for `walk(3)`, `n` is 3 inside the function, for `walk(2)` it is 2.',
    },
    map: ['@.oH.G', '..o...'],
    code: 'def walk(n):\n    for i in range(n):\n        move_east()\n\nwalk(2)\nattack()\nwalk(___)',
    choices: [
      {
        code: '3',
        note: {
          de: 'Nach dem Schlag ist der Kopf harmlos. Drei Schritte führen über ihn hinweg bis zum Gold.',
          en: 'After the blow the head is harmless. Three steps lead over it to the gold.',
        },
      },
      {
        code: '2',
        note: {
          de: 'Zwei Schritte enden ein Feld vor dem Gold.',
          en: 'Two steps end one cell before the gold.',
        },
      },
      {
        code: '4',
        note: {
          de: 'Vier Schritte führen über das Gold hinaus, und der Krieger läuft gegen den Rand.',
          en: 'Four steps lead past the gold, and the warrior walks into the edge.',
        },
      },
      {
        code: 'n',
        note: {
          de: '`n` gibt es nur innerhalb der Funktion. Draußen kennt Python diesen Namen nicht: `NameError`.',
          en: '`n` exists only inside the function. Outside, Python does not know that name: `NameError`.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'hunt-while',
    title: { de: 'Bis zur Hydra', en: 'Until the hydra' },
    intro: {
      de: '`body_here()` ist `True`, wenn der Krieger auf dem Körper einer lebenden Hydra steht. `while bedingung:` wiederholt, solange die Bedingung `True` ist; `not` dreht `True` und `False` um.',
      en: '`body_here()` is `True` when the warrior stands on the body of a living hydra. `while condition:` repeats as long as the condition is `True`; `not` turns `True` and `False` around.',
    },
    map: ['@....oH', '.....o.'],
    code: 'while ___:\n    move_east()\nattack()',
    choices: [
      {
        code: 'not body_here()',
        note: {
          de: 'Solange der Krieger noch nicht auf dem Körper steht, geht er weiter. Sobald er dort ist, wird die Bedingung `False`, die Schleife endet, und er schlägt zu. Das klappt bei jeder Entfernung.',
          en: 'As long as the warrior is not on the body yet, he walks on. As soon as he is there, the condition is `False`, the loop ends, and he strikes. That works for any distance.',
        },
      },
      {
        code: 'body_here()',
        note: {
          de: 'Am Start steht der Krieger nicht auf der Hydra, die Bedingung ist also gleich `False`. Die Schleife läuft kein einziges Mal, und der Schlag geht ins Leere.',
          en: 'At the start the warrior is not on the hydra, so the condition is `False` right away. The loop does not run even once, and the blow hits only air.',
        },
      },
      {
        code: 'True',
        note: {
          de: '`True` ist immer wahr: Der Krieger hört nie auf zu gehen, läuft über den Körper hinweg auf den Kopf und wird gefressen.',
          en: '`True` is always true: the warrior never stops walking, goes past the body onto the head and gets eaten.',
        },
      },
      {
        code: 'not body()',
        note: {
          de: 'Eine Funktion `body` gibt es nicht, also bricht Python mit einem `NameError` ab.',
          en: 'There is no function `body`, so Python stops with a `NameError`.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'hunt-if',
    title: { de: 'Nur wenn da einer ist', en: 'Only if there is one' },
    intro: {
      de: '`if bedingung:` führt die eingerückten Zeilen nur aus, wenn die Bedingung `True` ist. Sonst überspringt Python sie.',
      en: '`if condition:` runs the indented lines only when the condition is `True`. Otherwise Python skips them.',
    },
    map: ['@o.o.', '.H.H.'],
    code: 'for i in range(4):\n    move_east()\n    if ___:\n        attack()',
    choices: [
      {
        code: 'body_here()',
        note: {
          de: 'Auf jedem Feld schaut der Krieger nach: Steht er auf einer Hydra? Nur dann schlägt er zu, auf dem Gras geht er einfach weiter.',
          en: 'On every cell the warrior checks: is he standing on a hydra? Only then does he strike; on grass he just walks on.',
        },
      },
      {
        code: 'True',
        note: {
          de: '`True` ist immer wahr, der Krieger schlägt also auf jedem Feld zu. Auf dem ersten Feld mit Gras geht der Schlag ins Leere.',
          en: '`True` is always true, so the warrior strikes on every cell. On the first grass cell the blow hits only air.',
        },
      },
      {
        code: 'False',
        note: {
          de: '`False` ist nie wahr: Der Krieger schlägt nie zu und geht an beiden Hydras vorbei.',
          en: '`False` is never true: the warrior never strikes and walks past both hydras.',
        },
      },
      {
        code: 'not body_here()',
        note: {
          de: '`not` dreht die Frage um: Der Krieger schlägt genau dort zu, wo keine Hydra ist, und trifft nur Luft.',
          en: '`not` turns the question around: the warrior strikes exactly where there is no hydra, and hits only air.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'hunt-nested',
    title: { de: 'Schleife in der Schleife', en: 'A loop inside a loop' },
    intro: {
      de: 'Eine Schleife kann in einer anderen stecken: Hier läuft die innere Schleife bei jeder Runde der äußeren ganz durch.',
      en: 'One loop can sit inside another: here the inner loop runs all the way through in every round of the outer one.',
    },
    map: ['@.G....', '..G.G..', '....G.G', '......G'],
    code: 'for i in range(3):\n    for j in range(2):\n        move_east()\n    ___',
    choices: [
      {
        code: 'move_south()',
        note: {
          de: 'Jede Runde der äußeren Schleife: zwei Schritte nach rechts (die innere Schleife), dann einer nach unten. Dreimal, eine große Treppe.',
          en: 'Every round of the outer loop: two steps right (the inner loop), then one down. Three times, a big staircase.',
        },
      },
      {
        code: 'move_north()',
        note: {
          de: 'Nach zwei Schritten will der Krieger nach oben, aber er ist schon in der obersten Reihe: Er läuft gegen den Rand.',
          en: 'After two steps the warrior tries to go up, but he is already in the top row: he walks into the edge.',
        },
      },
      {
        code: 'move_east()',
        note: {
          de: 'Drei Schritte nach rechts pro Runde, immer in der obersten Reihe: Nach sieben Schritten ist der Rand erreicht.',
          en: 'Three steps right per round, always in the top row: after seven steps the warrior hits the edge.',
        },
      },
      {
        code: 'pass',
        note: {
          de: 'Ohne Schritt nach unten bleibt der Krieger in der obersten Reihe und verpasst fast das ganze Gold.',
          en: 'With no step down the warrior stays in the top row and misses nearly all the gold.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'hunt-list',
    title: { de: 'Eine Liste von Zahlen', en: 'A list of numbers' },
    intro: {
      de: '`for n in [2, 5]:` läuft einmal pro Wert der Liste: erst ist `n` 2, dann 5.',
      en: '`for n in [2, 5]:` runs once per value in the list: first `n` is 2, then 5.',
    },
    map: ['@o.o..o', '.H.H..H'],
    code: 'def walk(n):\n    for i in range(n):\n        move_east()\n\nfor n in ___:\n    walk(n)\n    attack()',
    choices: [
      {
        code: '[1, 2, 3]',
        note: {
          de: 'Die Liste nennt die Abstände zwischen den Hydras: 1 Feld, dann 2, dann 3. Bei jedem Wert geht der Krieger so weit und schlägt zu.',
          en: 'The list gives the distances between the hydras: 1 cell, then 2, then 3. For every value the warrior walks that far and strikes.',
        },
      },
      {
        code: '[1, 2, 2]',
        note: {
          de: 'Der letzte Weg ist ein Feld zu kurz. Der Krieger steht auf dem Gras, und der Schlag geht ins Leere.',
          en: 'The last walk is one cell too short. The warrior stands on grass, and the blow hits only air.',
        },
      },
      {
        code: '[1, 2]',
        note: {
          de: 'Die Liste hat nur zwei Werte, also läuft die Schleife nur zweimal. Die dritte Hydra erreicht der Krieger nie.',
          en: 'The list has only two values, so the loop runs only twice. The warrior never reaches the third hydra.',
        },
      },
      {
        code: '[1, 2, 4]',
        note: {
          de: 'Der letzte Weg ist zu lang: Der Krieger will über die letzte Hydra hinaus und läuft gegen den Rand.',
          en: 'The last walk is too long: the warrior tries to go past the last hydra and walks into the edge.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'hunt-variable',
    title: { de: 'Eine Variable wächst', en: 'A growing variable' },
    intro: {
      de: 'Eine Variable kann sich in der Schleife ändern. `steps = steps + 1` rechnet erst `steps + 1` aus und speichert das Ergebnis wieder in `steps`.',
      en: 'A variable can change inside the loop. `steps = steps + 1` first works out `steps + 1` and stores the result back in `steps`.',
    },
    map: ['@o.o..o', '.o.H..H', '.H.....'],
    code: 'steps = 1\nfor i in range(3):\n    for s in range(steps):\n        move_east()\n    attack()\n    ___',
    choices: [
      {
        code: 'steps = steps + 1',
        note: {
          de: 'Die Abstände werden immer größer: 1 Feld, dann 2, dann 3. Weil `steps` nach jedem Schlag um 1 wächst, passt jeder Weg genau.',
          en: 'The gaps get bigger each time: 1 cell, then 2, then 3. Because `steps` grows by 1 after every blow, each walk fits exactly.',
        },
      },
      {
        code: 'steps = 2',
        note: {
          de: 'Ab der zweiten Runde ist `steps` immer 2. Bis zur zweiten Hydra passt das, zur dritten sind es aber 3 Felder: Der Schlag geht ins Leere.',
          en: 'From the second round on, `steps` is always 2. That fits the walk to the second hydra, but the third one is 3 cells away: the blow hits only air.',
        },
      },
      {
        code: 'steps + 1',
        note: {
          de: '`steps + 1` rechnet zwar, speichert das Ergebnis aber nirgends. `steps` bleibt 1, und der zweite Schlag trifft nur Gras.',
          en: '`steps + 1` does work it out, but stores the result nowhere. `steps` stays 1, and the second blow hits only grass.',
        },
      },
      {
        code: 'steps = steps * 2',
        note: {
          de: 'Verdoppeln ergibt 1, 2, 4. Die ersten zwei Wege passen, beim dritten will der Krieger 4 Felder weit gehen und läuft gegen den Rand.',
          en: 'Doubling gives 1, 2, 4. The first two walks fit, but on the third the warrior tries to go 4 cells and walks into the edge.',
        },
      },
    ],
    answerIndex: 0,
  },
];
