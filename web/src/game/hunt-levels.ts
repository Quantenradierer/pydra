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
    id: 'hunt-west',
    title: { de: 'Und wieder zurück', en: 'And back again' },
    intro: {
      de: 'Mit `move_west()` geht der Krieger ein Feld nach links (Westen), mit `move_north()` eins nach oben. Ist eine Hydra besiegt, ist auch ihr Kopf harmlos.',
      en: 'With `move_west()` the warrior walks one cell to the left (west), with `move_north()` one up. Once a hydra is defeated, its head is harmless too.',
    },
    map: ['G..@oH'],
    code: 'move_east()\nattack()\nfor i in range(4):\n    ___',
    choices: [
      {
        code: 'move_west()',
        note: {
          de: 'Nach dem Schlag geht der Krieger viermal nach links, zurück über den Start bis zum Gold ganz links.',
          en: 'After the blow the warrior walks left four times, back past the start to the gold at the far left.',
        },
      },
      {
        code: 'move_east()',
        note: {
          de: 'Der Krieger geht weiter nach rechts, über den harmlosen Kopf hinweg, und läuft gegen den Rand. Das Gold liegt aber links.',
          en: 'The warrior keeps walking right, over the harmless head, and walks into the edge. But the gold lies on the left.',
        },
      },
      {
        code: 'pass',
        note: {
          de: '`pass` tut nichts. Der Krieger bleibt stehen, und das Gold bleibt liegen.',
          en: '`pass` does nothing. The warrior stands still, and the gold stays where it is.',
        },
      },
      {
        code: 'move_left()',
        note: {
          de: 'Einen Befehl `move_left` gibt es nicht, also bricht Python mit einem `NameError` ab.',
          en: 'There is no command `move_left`, so Python stops with a `NameError`.',
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
  {
    id: 'hunt-else',
    title: { de: 'Sonst weitergehen', en: 'Otherwise walk on' },
    intro: {
      de: 'Nach einem `if` darf ein `else:` stehen. Seine eingerückten Zeilen laufen genau dann, wenn die Bedingung des `if` nicht `True` ist.',
      en: 'An `if` may be followed by an `else:`. Its indented lines run exactly when the condition of the `if` is not `True`.',
    },
    map: ['@..o.o', '...H.H'],
    code: 'for i in range(7):\n    if body_here():\n        attack()\n    else:\n        ___',
    choices: [
      {
        code: 'move_east()',
        note: {
          de: 'Steht der Krieger auf einer Hydra, schlägt er zu, sonst geht er einen Schritt weiter. Sieben Runden: dreimal gehen, schlagen, zweimal gehen, schlagen.',
          en: 'When the warrior stands on a hydra he strikes, otherwise he takes a step on. Seven rounds: walk three times, strike, walk twice, strike.',
        },
      },
      {
        code: 'pass',
        note: {
          de: 'Im `else` passiert nichts: Der Krieger steht am Start, dort ist keine Hydra, und er kommt nie von der Stelle.',
          en: 'Nothing happens in the `else`: the warrior stands at the start, there is no hydra there, and he never moves.',
        },
      },
      {
        code: 'move_south()',
        note: {
          de: 'Der Krieger geht nach unten statt nach rechts, bis er gegen den unteren Rand läuft.',
          en: 'The warrior walks down instead of right, until he walks into the bottom edge.',
        },
      },
      {
        code: 'attack()',
        note: {
          de: 'Im `else` steht der Krieger gerade nicht auf einer Hydra. Der Schlag geht ins Leere.',
          en: 'In the `else` the warrior is not standing on a hydra. The blow hits only air.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'hunt-break',
    title: { de: 'Die Schleife verlassen', en: 'Leaving the loop' },
    intro: {
      de: '`while True:` läuft ewig, bis eine Zeile es beendet. `break` verlässt die Schleife sofort.',
      en: '`while True:` runs forever until a line ends it. `break` leaves the loop at once.',
    },
    map: ['@..oH.'],
    code: 'while True:\n    move_east()\n    if body_here():\n        attack()\n        ___',
    choices: [
      {
        code: 'break',
        note: {
          de: 'Nach dem Schlag verlässt `break` die Schleife, und der Krieger bleibt stehen. Alle Hydras sind besiegt.',
          en: 'After the blow, `break` leaves the loop, and the warrior stops. All hydras are defeated.',
        },
      },
      {
        code: 'pass',
        note: {
          de: '`pass` tut nichts, die Schleife läuft weiter. Der Krieger geht über den harmlosen Kopf hinaus und läuft gegen den Rand.',
          en: '`pass` does nothing, so the loop goes on. The warrior walks past the harmless head and into the edge.',
        },
      },
      {
        code: 'move_east()',
        note: {
          de: 'Der Krieger geht noch einen Schritt, und die Schleife läuft weiter, bis er gegen den Rand läuft.',
          en: 'The warrior takes one more step, and the loop goes on until he walks into the edge.',
        },
      },
      {
        code: 'stop',
        note: {
          de: 'Einen Namen `stop` kennt Python nicht: `NameError`.',
          en: 'Python does not know a name `stop`: `NameError`.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'hunt-countdown',
    title: { de: 'Rückwärts zählen', en: 'Counting down' },
    intro: {
      de: '`while n > 0:` läuft, solange `n` größer als 0 ist. Damit die Schleife einmal endet, muss sich `n` in jeder Runde ändern.',
      en: '`while n > 0:` runs as long as `n` is greater than 0. For the loop to end, `n` has to change in every round.',
    },
    map: ['@..oH.'],
    code: 'n = 3\nwhile n > 0:\n    move_east()\n    ___\nattack()',
    choices: [
      {
        code: 'n = n - 1',
        note: {
          de: '`n` zählt 3, 2, 1 und dann 0: Die Schleife läuft dreimal, der Krieger steht auf der Hydra, und `attack()` besiegt sie.',
          en: '`n` counts 3, 2, 1 and then 0: the loop runs three times, the warrior stands on the hydra, and `attack()` defeats it.',
        },
      },
      {
        code: 'n = n - 2',
        note: {
          de: '`n` wird 1 und dann -1: Die Schleife läuft nur zweimal. Der Krieger steht noch auf Gras, und der Schlag geht ins Leere.',
          en: '`n` becomes 1 and then -1: the loop runs only twice. The warrior still stands on grass, and the blow hits only air.',
        },
      },
      {
        code: 'n = n - 3',
        note: {
          de: 'Schon nach der ersten Runde ist `n` 0. Der Krieger macht nur einen Schritt, und der Schlag geht ins Leere.',
          en: 'After the first round `n` is already 0. The warrior takes only one step, and the blow hits only air.',
        },
      },
      {
        code: 'n = n + 1',
        note: {
          de: '`n` wird immer größer und bleibt über 0. Die Schleife endet nie: Der Krieger geht weiter, bis er auf den Kopf der Hydra tritt, und der frisst ihn.',
          en: '`n` keeps growing and stays above 0. The loop never ends: the warrior keeps walking until he steps on the hydra\'s head, and it eats him.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'hunt-index',
    title: { de: 'Welche Runde?', en: 'Which round?' },
    intro: {
      de: 'In `for i in range(3):` zählt `i` die Runden: 0, 1, 2. Mit `==` fragt man, ob zwei Werte gleich sind, `>=` heißt "größer oder gleich".',
      en: 'In `for i in range(3):` the variable `i` counts the rounds: 0, 1, 2. `==` asks whether two values are equal, `>=` means "greater than or equal".',
    },
    map: ['@.oH.'],
    code: 'for i in range(3):\n    move_east()\n    if ___:\n        attack()',
    choices: [
      {
        code: 'i == 1',
        note: {
          de: 'In Runde 1 steht der Krieger nach dem Schritt auf dem Körper der Hydra und schlägt zu. In Runde 2 geht er über den besiegten Kopf.',
          en: "In round 1 the warrior stands on the hydra's body after the step and strikes. In round 2 he walks over the defeated head.",
        },
      },
      {
        code: 'i == 0',
        note: {
          de: 'Schon in der ersten Runde schlägt der Krieger zu, nach einem Schritt. Dort ist nur Gras: Der Schlag geht ins Leere.',
          en: 'The warrior strikes already in the first round, after one step. There is only grass: the blow hits only air.',
        },
      },
      {
        code: 'i == 2',
        note: {
          de: 'In Runde 1 wird nicht geschlagen, und in Runde 2 tritt der Krieger auf den Kopf der lebenden Hydra: Der frisst ihn.',
          en: "In round 1 there is no blow, and in round 2 the warrior steps on the living hydra's head: it eats him.",
        },
      },
      {
        code: 'i >= 1',
        note: {
          de: 'Runde 1 trifft die Hydra. Aber auch in Runde 2 wird geschlagen, und dort ist der Kopf, kein Körper: Der Schlag geht ins Leere.',
          en: 'Round 1 hits the hydra. But there is a blow in round 2 as well, and there is the head, not a body: the blow hits only air.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'hunt-guard',
    title: { de: 'Erst schauen, dann gehen', en: 'Look first, then walk' },
    intro: {
      de: 'Eine `while True:`-Schleife kann mit einem `if` prüfen, ob sie fertig ist. Läuft das `if` nicht, geht es in der Schleife weiter.',
      en: 'A `while True:` loop can use an `if` to check whether it is done. When the `if` does not run, the loop carries on.',
    },
    map: ['@..oH'],
    code: 'while True:\n    if body_here():\n        attack()\n        break\n    ___',
    choices: [
      {
        code: 'move_east()',
        note: {
          de: 'Solange der Krieger nicht auf der Hydra steht, geht er einen Schritt weiter. Dann schlägt er zu, und `break` beendet die Schleife.',
          en: 'As long as the warrior is not on the hydra, he takes a step on. Then he strikes, and `break` ends the loop.',
        },
      },
      {
        code: 'pass',
        note: {
          de: 'Nichts bewegt sich: Der Krieger steht am Start, das `if` läuft nie, und die Schleife dreht sich endlos im Kreis.',
          en: 'Nothing moves: the warrior stands at the start, the `if` never runs, and the loop goes round and round forever.',
        },
      },
      {
        code: 'attack()',
        note: {
          de: 'Der Krieger schlägt in jeder Runde zu, schon am Start. Dort ist keine Hydra, der Schlag geht ins Leere.',
          en: 'The warrior strikes in every round, right at the start. There is no hydra there, so the blow hits only air.',
        },
      },
      {
        code: 'move_south()',
        note: {
          de: 'Der Krieger geht nach unten, aber die Karte hat nur eine Reihe: Er läuft gegen den Rand.',
          en: 'The warrior goes down, but the map has only one row: he walks into the edge.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'hunt-call',
    title: { de: 'Die Funktion aufrufen', en: 'Calling the function' },
    intro: {
      de: '`def` legt eine Funktion nur an, ausgeführt wird sie erst, wenn man sie mit Klammern aufruft: `name()`.',
      en: '`def` only sets up a function; it runs only when you call it with parentheses: `name()`.',
    },
    map: ['@...', '.G..', '..G.', '...G'],
    code: 'def stair():\n    move_east()\n    move_south()\n\nfor i in range(3):\n    ___',
    choices: [
      {
        code: 'stair()',
        note: {
          de: 'Jeder Aufruf geht einen Schritt nach rechts und einen nach unten. Dreimal ergibt eine Treppe über alle drei Goldstücke.',
          en: 'Every call goes one step right and one step down. Three times makes a staircase over all three pieces of gold.',
        },
      },
      {
        code: 'stair',
        note: {
          de: 'Ohne Klammern wird die Funktion nur genannt, nicht aufgerufen. Der Krieger bleibt am Start, das Gold bleibt liegen.',
          en: 'Without parentheses the function is only named, not called. The warrior stays at the start, and the gold stays where it is.',
        },
      },
      {
        code: 'move_east()',
        note: {
          de: 'Der Krieger geht dreimal nach rechts, immer in der obersten Reihe. Das Gold liegt weiter unten.',
          en: 'The warrior walks right three times, always in the top row. The gold lies further down.',
        },
      },
      {
        code: 'stair(3)',
        note: {
          de: '`stair` hat keine Parameter, bekommt hier aber ein Argument: Python meldet einen Fehler.',
          en: '`stair` has no parameters but gets an argument here: Python reports an error.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'hunt-range-two',
    title: { de: 'Von bis', en: 'From and to' },
    intro: {
      de: '`range(1, 4)` zählt von 1 bis vor 4: 1, 2, 3. Die Schleife läuft also dreimal. Bei `range(3, 1)` gibt es keine Zahl, sie läuft gar nicht.',
      en: '`range(1, 4)` counts from 1 up to just before 4: 1, 2, 3. So the loop runs three times. With `range(3, 1)` there is no number at all, and it does not run.',
    },
    map: ['@..oH.'],
    code: 'for i in range(___):\n    move_east()\nattack()',
    choices: [
      {
        code: '1, 4',
        note: {
          de: 'Drei Zahlen, also drei Schritte: Der Krieger steht auf der Hydra, und `attack()` besiegt sie.',
          en: 'Three numbers, so three steps: the warrior stands on the hydra, and `attack()` defeats it.',
        },
      },
      {
        code: '1, 3',
        note: {
          de: 'Nur zwei Zahlen, also zwei Schritte. Der Krieger steht noch auf Gras, und der Schlag geht ins Leere.',
          en: 'Only two numbers, so two steps. The warrior still stands on grass, and the blow hits only air.',
        },
      },
      {
        code: '0, 4',
        note: {
          de: 'Vier Zahlen, also vier Schritte: Der vierte führt auf den Kopf der Hydra, und der frisst den Krieger.',
          en: "Four numbers, so four steps: the fourth leads onto the hydra's head, and it eats the warrior.",
        },
      },
      {
        code: '3, 1',
        note: {
          de: 'Von 3 aufwärts bis vor 1 gibt es keine Zahl. Der Krieger macht keinen Schritt und schlägt am Start ins Leere.',
          en: 'Counting up from 3 to just before 1 gives no number. The warrior takes no step and strikes at the start, into air.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'hunt-stairs',
    title: { de: 'Abwechselnd', en: 'Taking turns' },
    intro: {
      de: '`i % 2` ist der Rest beim Teilen durch 2: bei geraden Zahlen 0, bei ungeraden 1. So kann eine Schleife zwischen zwei Dingen abwechseln.',
      en: '`i % 2` is the remainder when dividing by 2: 0 for even numbers, 1 for odd ones. That lets a loop take turns between two things.',
    },
    map: ['@...', '.G..', '..G.', '...G'],
    code: 'for i in range(6):\n    if i % 2 == 0:\n        move_east()\n    else:\n        ___',
    choices: [
      {
        code: 'move_south()',
        note: {
          de: 'Rechts, unten, rechts, unten ...: eine Treppe, die über alle drei Goldstücke führt.',
          en: 'Right, down, right, down ...: a staircase that leads over all three pieces of gold.',
        },
      },
      {
        code: 'move_east()',
        note: {
          de: 'Der Krieger geht in jeder Runde nach rechts und läuft nach vier Schritten gegen den Rand.',
          en: 'The warrior goes right in every round and walks into the edge after four steps.',
        },
      },
      {
        code: 'move_west()',
        note: {
          de: 'Rechts, links, rechts, links: Der Krieger pendelt in der obersten Reihe hin und her und holt kein Gold.',
          en: 'Right, left, right, left: the warrior swings back and forth in the top row and picks up no gold.',
        },
      },
      {
        code: 'attack()',
        note: {
          de: 'In der zweiten Runde schlägt der Krieger zu, aber auf seinem Feld ist keine Hydra: Der Schlag geht ins Leere.',
          en: 'In the second round the warrior strikes, but there is no hydra on his cell: the blow hits only air.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'hunt-turn',
    title: { de: 'Um die Ecke', en: 'Round the corner' },
    intro: {
      de: 'In einer Schleife kann ein `if` die ersten Runden anders behandeln als die späteren: `i < 3` gilt nur in den Runden 0, 1 und 2.',
      en: 'In a loop, an `if` can treat the first rounds differently from the later ones: `i < 3` holds only in rounds 0, 1 and 2.',
    },
    map: ['@...', '....', '....', '...G'],
    code: 'for i in range(6):\n    if i < 3:\n        move_east()\n    else:\n        ___',
    choices: [
      {
        code: 'move_south()',
        note: {
          de: 'Erst dreimal nach rechts, dann dreimal nach unten: Der Krieger geht um die Ecke und steht auf dem Gold.',
          en: 'First right three times, then down three times: the warrior goes round the corner and stands on the gold.',
        },
      },
      {
        code: 'move_east()',
        note: {
          de: 'Nach den ersten drei Schritten steht der Krieger schon am rechten Rand, der vierte Schritt läuft dagegen.',
          en: 'After the first three steps the warrior is already at the right edge, and the fourth step walks into it.',
        },
      },
      {
        code: 'pass',
        note: {
          de: 'Nach den drei Schritten nach rechts tut der Krieger nichts mehr. Das Gold liegt noch unten rechts.',
          en: 'After the three steps right the warrior does nothing any more. The gold still lies at the bottom right.',
        },
      },
      {
        code: 'attack()',
        note: {
          de: 'In Runde 3 schlägt der Krieger zu, aber auf seinem Feld ist keine Hydra: Der Schlag geht ins Leere.',
          en: 'In round 3 the warrior strikes, but there is no hydra on his cell: the blow hits only air.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'hunt-break-count',
    title: { de: 'Genug gezählt', en: 'Counted enough' },
    intro: {
      de: 'Eine `while True:`-Schleife kann mitzählen und mit `break` aufhören, sobald der Zähler den richtigen Wert hat.',
      en: 'A `while True:` loop can keep count and stop with `break` as soon as the counter has the right value.',
    },
    map: ['@..G'],
    code: 'n = 0\nwhile True:\n    move_east()\n    n = n + 1\n    if n == ___:\n        break',
    choices: [
      {
        code: '3',
        note: {
          de: 'Nach dem dritten Schritt ist `n` gleich 3, und `break` hält den Krieger genau auf dem Gold an.',
          en: 'After the third step `n` equals 3, and `break` stops the warrior right on the gold.',
        },
      },
      {
        code: '2',
        note: {
          de: 'Schon nach zwei Schritten ist Schluss. Der Krieger steht noch ein Feld vor dem Gold.',
          en: 'It is over after two steps. The warrior still stands one cell short of the gold.',
        },
      },
      {
        code: '1',
        note: {
          de: 'Schon nach dem ersten Schritt ist Schluss, das Gold ist noch zwei Felder entfernt.',
          en: 'It is over after the first step, and the gold is still two cells away.',
        },
      },
      {
        code: '4',
        note: {
          de: 'Der Krieger läuft über das Gold hinaus, und der vierte Schritt führt gegen den Rand.',
          en: 'The warrior walks past the gold, and the fourth step leads into the edge.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'hunt-corner',
    title: { de: 'Zwei Schleifen', en: 'Two loops' },
    intro: {
      de: 'Zwei Schleifen hintereinander laufen nacheinander: Erst ist die erste ganz fertig, dann beginnt die zweite.',
      en: 'Two loops one after the other run one after the other: the first is completely done before the second begins.',
    },
    map: ['@...', '....', '....', 'G..G'],
    code: 'for i in range(3):\n    move_south()\nfor i in range(3):\n    ___',
    choices: [
      {
        code: 'move_east()',
        note: {
          de: 'Die erste Schleife führt nach unten auf das erste Gold, die zweite nach rechts bis zum zweiten.',
          en: 'The first loop leads down onto the first gold, the second to the right up to the second.',
        },
      },
      {
        code: 'move_west()',
        note: {
          de: 'Der Krieger steht schon am linken Rand und läuft dagegen.',
          en: 'The warrior is already at the left edge and walks into it.',
        },
      },
      {
        code: 'move_north()',
        note: {
          de: 'Der Krieger geht denselben Weg wieder hinauf. Das zweite Gold bleibt liegen.',
          en: 'The warrior walks the same way back up. The second gold stays where it is.',
        },
      },
      {
        code: 'attack()',
        note: {
          de: 'Der Krieger schlägt dreimal zu, aber auf seinem Feld ist keine Hydra: Der Schlag geht ins Leere.',
          en: 'The warrior strikes, but there is no hydra on his cell: the blow hits only air.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'hunt-hit-twice',
    title: { de: 'Zweimal zuschlagen', en: 'Strike twice' },
    intro: {
      de: 'Eine Funktion fasst mehrere Zeilen zusammen. Steht ihr Aufruf in einer Schleife, läuft sie bei jeder Runde einmal.',
      en: 'A function bundles several lines. When its call is inside a loop, it runs once per round.',
    },
    map: ['@.o.o', '..H.H'],
    code: 'def hit():\n    move_east()\n    move_east()\n    attack()\n\nfor i in range(___):\n    hit()',
    choices: [
      {
        code: '2',
        note: {
          de: 'Zweimal `hit()`: zwei Schritte, Schlag, zwei Schritte, Schlag. Beide Körper der Hydras sind getroffen.',
          en: 'Calling `hit()` twice: two steps, blow, two steps, blow. Both hydra bodies are hit.',
        },
      },
      {
        code: '1',
        note: {
          de: 'Der Krieger besiegt nur die erste Hydra. Die zweite bleibt am Leben.',
          en: 'The warrior defeats only the first hydra. The second stays alive.',
        },
      },
      {
        code: '3',
        note: {
          de: 'Nach dem zweiten Schlag geht der Krieger noch einen Schritt und läuft gegen den rechten Rand.',
          en: 'After the second blow the warrior takes one more step and walks into the right edge.',
        },
      },
      {
        code: '0',
        note: {
          de: 'Bei `range(0)` läuft die Schleife gar nicht, und der Krieger rührt sich nicht.',
          en: 'With `range(0)` the loop does not run at all, and the warrior does not move.',
        },
      },
    ],
    answerIndex: 0,
  },
];
