import type { HeadsLevel } from './heads.ts';

/**
 * The levels of the heads game, easy ones for beginners, in play order.
 * Every call of a function grows the hydra a head; the goal is a value or
 * what the program prints.
 */
export const HEADS_LEVELS: readonly HeadsLevel[] = [
  {
    id: 'call',
    title: { de: 'Eine Funktion aufrufen', en: 'Calling a function' },
    intro: {
      de: '`def greet():` baut eine eigene Funktion, führt sie aber noch nicht aus. Erst ein Aufruf mit Klammern lässt sie laufen: Dann wächst der Hydra ein neuer Kopf, der die Zeilen der Funktion abarbeitet.',
      en: '`def greet():` builds a function of your own, but does not run it yet. Only a call with brackets runs it: then the hydra grows a new head that works through the lines of the function.',
    },
    goal: { output: ['Hi!'] },
    code: 'def greet():\n    print("Hi!")\n\n___',
    choices: [
      {
        code: 'greet()',
        note: {
          de: 'Mit `greet()` wird die Funktion aufgerufen: Ein Kopf wächst, führt `print("Hi!")` aus und verschwindet wieder, wenn die Funktion fertig ist.\n\nDie Klammern sind der Befehl „jetzt ausführen“. Ohne sie ist `greet` nur der Name der Funktion.',
          en: 'With `greet()` the function is called: a head grows, runs `print("Hi!")` and disappears again when the function has finished.\n\nThe brackets are the command "run it now". Without them, `greet` is just the name of the function.',
        },
      },
      {
        code: 'greet',
        note: {
          de: 'Ohne Klammern nennt die Zeile nur den Namen der Funktion, sie ruft sie aber nicht auf. Es wächst kein Kopf, und nichts wird ausgegeben.',
          en: 'Without brackets the line only names the function, it does not call it. No head grows, and nothing is printed.',
        },
      },
      {
        code: 'print(greet())',
        note: {
          de: 'Die Funktion gibt zwar „Hi!“ aus, gibt aber selbst keinen Wert zurück. Ohne `return` bekommt man `None`, „nichts“. Das äußere `print` gibt dieses `None` dann auch noch aus.',
          en: 'The function does print "Hi!", but hands back no value itself. Without `return` you get `None`, "nothing". The outer `print` then prints that `None` as well.',
        },
      },
      {
        code: 'Greet()',
        note: {
          de: 'Python unterscheidet Groß- und Kleinschreibung: `Greet` ist ein anderer Name als die Funktion oben. Den gibt es nicht, also meldet Python einen `NameError`.',
          en: 'Python tells upper and lower case apart: `Greet` is a different name from the function above. It does not exist, so Python reports a `NameError`.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'parameter',
    title: { de: 'Ein Wert für den Kopf', en: 'A value for the head' },
    intro: {
      de: 'Was beim Aufruf in den Klammern steht, bekommt der neue Kopf mit: Bei `double(5)` steht auf dem Kopf `x = 5`. `return` gibt das Ergebnis zurück an die Stelle des Aufrufs.',
      en: 'Whatever is in the brackets of the call goes along to the new head: with `double(5)` the head shows `x = 5`. `return` hands the result back to where the call was.',
    },
    goal: { vars: { result: '8' } },
    code: 'def double(x):\n    return x * 2\n\nresult = double(___)',
    choices: [
      {
        code: '4',
        note: {
          de: 'Der Kopf bekommt `x = 4`, rechnet `4 * 2` und gibt 8 zurück. Diese 8 landet in `result`.\n\nDer Parameter `x` ist wie ein Platzhalter: Bei jedem Aufruf steht dort der Wert, der in den Klammern mitkommt.',
          en: 'The head gets `x = 4`, works out `4 * 2` and hands back 8. That 8 ends up in `result`.\n\nThe parameter `x` is like a placeholder: on every call it holds the value that comes along in the brackets.',
        },
      },
      {
        code: '8',
        note: {
          de: 'Die Funktion verdoppelt, was sie bekommt. Mit 8 in den Klammern kommt also 16 heraus, doppelt so viel wie das Ziel.',
          en: 'The function doubles whatever it gets. With 8 in the brackets the result is 16, twice the goal.',
        },
      },
      {
        code: 'x',
        note: {
          de: '`x` gibt es nur auf dem Kopf der Funktion, und der ist noch gar nicht gewachsen. Im Hauptprogramm kennt Python keine Variable `x` und meldet einen `NameError`.',
          en: '`x` only exists on the head of the function, and that has not even grown yet. In the main program Python knows no variable `x` and reports a `NameError`.',
        },
      },
      {
        code: '4, 2',
        note: {
          de: 'Zwei Werte, aber die Funktion hat nur einen Parameter `x`. Python weiß nicht, wohin mit dem zweiten, und meldet einen `TypeError`. Es wächst gar kein Kopf.',
          en: 'Two values, but the function has only one parameter, `x`. Python does not know where to put the second one and reports a `TypeError`. No head grows at all.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'return',
    title: { de: 'return statt print', en: 'return, not print' },
    intro: {
      de: '`print(...)` zeigt einen Wert nur an. `return ...` gibt ihn an das Programm zurück, das die Funktion aufgerufen hat, und beendet die Funktion. Ohne `return` gibt eine Funktion `None` zurück, „nichts“.',
      en: '`print(...)` only shows a value. `return ...` hands it back to the program that called the function, and ends the function. Without `return` a function hands back `None`, "nothing".',
    },
    goal: { vars: { result: '8' } },
    code: 'def double(x):\n    ___\n\nresult = double(4)',
    choices: [
      {
        code: 'return x * 2',
        note: {
          de: 'Der Kopf rechnet `4 * 2` und reicht die 8 mit `return` nach unten weiter. Dort wird sie in `result` gespeichert.\n\nMerke: Mit `print` sieht man einen Wert, mit `return` kann das Programm mit ihm weiterarbeiten.',
          en: 'The head works out `4 * 2` and passes the 8 down with `return`. There it is stored in `result`.\n\nRemember: with `print` you see a value, with `return` the program can keep working with it.',
        },
      },
      {
        code: 'print(x * 2)',
        note: {
          de: 'Die 8 erscheint zwar in der Ausgabe, aber sie wird nur angezeigt, nicht zurückgegeben. Die Funktion endet ohne `return`, also landet `None` in `result`.',
          en: 'The 8 does appear in the output, but it is only shown, not handed back. The function ends without `return`, so `None` ends up in `result`.',
        },
      },
      {
        code: 'x = x * 2',
        note: {
          de: 'Der Kopf rechnet die 8 aus und speichert sie in seinem eigenen `x`. Wenn der Kopf verschwindet, ist auch sein `x` weg. Zurückgegeben wird nichts, also ist `result` gleich `None`.',
          en: 'The head works out the 8 and stores it in its own `x`. When the head disappears, its `x` is gone too. Nothing is handed back, so `result` is `None`.',
        },
      },
      {
        code: 'return x + 2',
        note: {
          de: 'Hier wird zurückgegeben, aber das Falsche gerechnet: `4 + 2` ist 6. Verdoppeln heißt mal 2, nicht plus 2.',
          en: 'This does hand something back, but works out the wrong thing: `4 + 2` is 6. Doubling means times 2, not plus 2.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'use-result',
    title: { de: 'Mit dem Ergebnis weiterrechnen', en: 'Working with the result' },
    intro: {
      de: 'Ein Aufruf wie `double(5)` steht in der Rechnung für seinen Rückgabewert. Python ruft erst die Funktion auf und rechnet dann mit dem Wert weiter, den der Kopf zurückgibt.',
      en: 'A call like `double(5)` stands in a calculation for the value it hands back. Python calls the function first, then carries on calculating with the value the head hands back.',
    },
    goal: { vars: { result: '7' } },
    code: 'def double(x):\n    return x * 2\n\nresult = ___ + 1',
    choices: [
      {
        code: 'double(3)',
        note: {
          de: 'Zuerst wächst ein Kopf für `double(3)` und gibt 6 zurück. Dann rechnet Python `6 + 1`, und 7 landet in `result`.\n\nWenn du Schritt für Schritt gehst, siehst du: Die Zeile mit `result` wartet, bis der Kopf fertig ist.',
          en: 'First a head grows for `double(3)` and hands back 6. Then Python works out `6 + 1`, and 7 ends up in `result`.\n\nIf you go step by step you can see it: the line with `result` waits until the head has finished.',
        },
      },
      {
        code: 'double',
        note: {
          de: 'Ohne Klammern wird die Funktion nicht aufgerufen. Python soll also „Funktion plus 1“ rechnen, und das geht nicht: Es meldet einen `TypeError`.',
          en: 'Without brackets the function is not called. So Python is asked to work out "function plus 1", which cannot be done: it reports a `TypeError`.',
        },
      },
      {
        code: 'double(6)',
        note: {
          de: '`double(6)` gibt 12 zurück, und `12 + 1` ist 13. Die 6 ist schon das Ergebnis, das du brauchst, nicht der Wert, der hineingehört.',
          en: '`double(6)` hands back 12, and `12 + 1` is 13. The 6 is already the result you need, not the value that goes in.',
        },
      },
      {
        code: 'double(3 + 1)',
        note: {
          de: 'Das `+ 1` steht jetzt in den Klammern: Erst wird `3 + 1` zu 4, dann verdoppelt zu 8, und dann kommt noch einmal 1 dazu. Das ergibt 9.',
          en: 'The `+ 1` is now inside the brackets: first `3 + 1` becomes 4, then it is doubled to 8, and then 1 more is added. That makes 9.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'locals',
    title: { de: 'Was auf dem Kopf bleibt', en: 'What stays on the head' },
    intro: {
      de: 'Variablen, die in einer Funktion entstehen, gehören nur ihrem Kopf: Man nennt sie lokal. Wenn der Kopf verschwindet, sind sie weg. Nur der Rückgabewert kommt unten an.',
      en: 'Variables made inside a function belong only to its head: they are called local. When the head disappears, they are gone. Only the value handed back arrives below.',
    },
    goal: { vars: { result: '6' } },
    code: 'def triple(x):\n    y = x * 3\n    return y\n\nz = triple(2)\nresult = ___',
    choices: [
      {
        code: 'z',
        note: {
          de: 'Der Kopf rechnet `y = 6` und gibt die 6 zurück. Unten wird sie in `z` gespeichert, und von dort kommt sie in `result`.\n\nAchte auf den Körper der Hydra: Dort stehen nur die Variablen des Hauptprogramms, `y` taucht da nie auf.',
          en: 'The head works out `y = 6` and hands back the 6. Below, it is stored in `z`, and from there it goes into `result`.\n\nWatch the body of the hydra: only the variables of the main program are shown there, `y` never appears.',
        },
      },
      {
        code: 'y',
        note: {
          de: '`y` gab es nur auf dem Kopf von `triple`. Der ist schon verschwunden, und mit ihm `y`. Im Hauptprogramm meldet Python einen `NameError`.',
          en: '`y` only existed on the head of `triple`. That head has already disappeared, and `y` with it. In the main program Python reports a `NameError`.',
        },
      },
      {
        code: 'triple(z)',
        note: {
          de: 'Jetzt wächst noch ein Kopf, diesmal mit `x = 6`. Er verdreifacht das Ergebnis noch einmal: 18.',
          en: 'Now another head grows, this time with `x = 6`. It triples the result once more: 18.',
        },
      },
      {
        code: '"z"',
        note: {
          de: 'In Anführungszeichen ist `"z"` ein Text, der Buchstabe z, und nicht die Variable. `result` bekommt also den Text statt der Zahl.',
          en: 'In quotes, `"z"` is text, the letter z, and not the variable. So `result` gets the text instead of the number.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'nested-calls',
    title: { de: 'Ein Kopf ruft den nächsten', en: 'One head calls the next' },
    intro: {
      de: 'Eine Funktion darf eine andere aufrufen. Dann wächst auf dem Kopf ein weiterer Kopf. Der obere arbeitet, der untere wartet, bis er die Antwort bekommt.',
      en: 'A function may call another one. Then another head grows on top of the head. The upper one works, the lower one waits until it gets the answer.',
    },
    goal: { vars: { result: '12' } },
    code: 'def double(x):\n    return x * 2\n\ndef quadruple(x):\n    return double(___)\n\nresult = quadruple(3)',
    choices: [
      {
        code: 'double(x)',
        note: {
          de: '`quadruple(3)` ruft zuerst `double(3)` auf: Ein Kopf wächst obendrauf und gibt 6 zurück. Dann wird `double(6)` aufgerufen, gibt 12 zurück, und `quadruple` reicht die 12 nach unten weiter.\n\nJeder Kopf hat sein eigenes `x`: Sie heißen gleich, sind aber verschiedene Variablen.',
          en: '`quadruple(3)` first calls `double(3)`: a head grows on top and hands back 6. Then `double(6)` is called, hands back 12, and `quadruple` passes the 12 down.\n\nEvery head has its own `x`: they share a name, but they are different variables.',
        },
      },
      {
        code: 'x',
        note: {
          de: 'So wird nur einmal verdoppelt: `double(3)` gibt 6 zurück. Für das Vierfache fehlt noch ein Verdoppeln.',
          en: 'This doubles only once: `double(3)` hands back 6. For four times the value, one more doubling is missing.',
        },
      },
      {
        code: 'quadruple(x)',
        note: {
          de: '`quadruple` ruft sich selbst auf, immer wieder mit derselben 3. Kopf um Kopf wächst, keiner wird je fertig, bis Python mit einem `RecursionError` abbricht: zu viele Köpfe.',
          en: '`quadruple` calls itself, again and again with the same 3. Head after head grows, none ever finishes, until Python stops with a `RecursionError`: too many heads.',
        },
      },
      {
        code: 'x, x',
        note: {
          de: '`double` hat nur einen Parameter, bekommt hier aber zwei Werte. Python meldet einen `TypeError`, und der zweite Kopf wächst gar nicht erst.',
          en: '`double` has only one parameter, but gets two values here. Python reports a `TypeError`, and the second head never grows.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'two-parameters',
    title: { de: 'Zwei Parameter', en: 'Two parameters' },
    intro: {
      de: 'Hat eine Funktion zwei Parameter, werden die Werte beim Aufruf der Reihe nach verteilt: Bei `minus(9, 4)` bekommt `a` die 9 und `b` die 4.',
      en: 'When a function has two parameters, the values of the call are handed out in order: with `minus(9, 4)`, `a` gets the 9 and `b` gets the 4.',
    },
    goal: { vars: { result: '3' } },
    code: 'def minus(a, b):\n    return a - b\n\nresult = minus(___)',
    choices: [
      {
        code: '5, 2',
        note: {
          de: 'Der Kopf bekommt `a = 5` und `b = 2` und rechnet `5 - 2`, also 3.\n\nDie Reihenfolge entscheidet, welcher Wert in welchen Parameter kommt: der erste Wert in den ersten Parameter.',
          en: 'The head gets `a = 5` and `b = 2` and works out `5 - 2`, which is 3.\n\nThe order decides which value goes into which parameter: the first value into the first parameter.',
        },
      },
      {
        code: '2, 5',
        note: {
          de: 'Vertauscht: Jetzt ist `a = 2` und `b = 5`, und `2 - 5` ist -3. Beim Minus kommt es auf die Reihenfolge an.',
          en: 'Swapped: now `a = 2` and `b = 5`, and `2 - 5` is -3. With minus, the order matters.',
        },
      },
      {
        code: '5 - 2',
        note: {
          de: '`5 - 2` wird schon vor dem Aufruf ausgerechnet, es ist also nur ein Wert: 3. Für `b` bleibt nichts übrig, und Python meldet einen `TypeError`.',
          en: '`5 - 2` is worked out before the call, so it is just one value: 3. Nothing is left for `b`, and Python reports a `TypeError`.',
        },
      },
      {
        code: '5, 3',
        note: {
          de: '`5 - 3` ist 2, nicht 3. Die Funktion zieht den zweiten Wert vom ersten ab.',
          en: '`5 - 3` is 2, not 3. The function subtracts the second value from the first.',
        },
      },
    ],
    answerIndex: 0,
  },
  {
    id: 'countdown',
    title: { de: 'Kopf um Kopf: Rekursion', en: 'Head after head: recursion' },
    intro: {
      de: 'Eine Funktion darf sich sogar selbst aufrufen. Das heißt Rekursion: Jeder Aufruf bekommt einen eigenen Kopf mit eigenem `n`. Wichtig ist, dass die Köpfe irgendwann aufhören zu wachsen.',
      en: 'A function may even call itself. That is called recursion: every call gets its own head with its own `n`. What matters is that the heads stop growing at some point.',
    },
    goal: { output: ['3', '2', '1'] },
    code: 'def countdown(n):\n    print(n)\n    if n > 1:\n        countdown(___)\n\ncountdown(3)',
    choices: [
      {
        code: 'n - 1',
        note: {
          de: 'Jeder Kopf gibt sein `n` aus und ruft dann einen Kopf mit `n - 1` auf: 3, 2, 1. Bei 1 ist `n > 1` falsch, es wächst kein Kopf mehr, und alle verschwinden wieder, von oben nach unten.\n\nDie Bedingung `if n > 1` ist der Stopp. Ohne sie würden die Köpfe ewig wachsen.',
          en: 'Every head prints its `n` and then calls a head with `n - 1`: 3, 2, 1. At 1, `n > 1` is false, no more heads grow, and they all disappear again, from the top down.\n\nThe condition `if n > 1` is the stop. Without it the heads would grow forever.',
        },
      },
      {
        code: 'n - 2',
        note: {
          de: 'Mit `n - 2` springt der Countdown in Zweierschritten: 3, dann 1. Die 2 wird übersprungen.',
          en: 'With `n - 2` the countdown jumps in twos: 3, then 1. The 2 is skipped.',
        },
      },
      {
        code: 'n + 1',
        note: {
          de: 'Mit `n + 1` zählt die Hydra nach oben: 3, 4, 5 … `n > 1` bleibt immer wahr, also wächst Kopf um Kopf, bis Python mit einem `RecursionError` abbricht.',
          en: 'With `n + 1` the hydra counts upwards: 3, 4, 5 … `n > 1` stays true forever, so head after head grows until Python stops with a `RecursionError`.',
        },
      },
      {
        code: 'n',
        note: {
          de: 'Jeder neue Kopf bekommt wieder dieselbe 3. Der Countdown kommt nie voran: 3, 3, 3 … bis zu viele Köpfe gewachsen sind und Python mit einem `RecursionError` abbricht.',
          en: 'Every new head gets the same 3 again. The countdown never gets anywhere: 3, 3, 3 … until too many heads have grown and Python stops with a `RecursionError`.',
        },
      },
    ],
    answerIndex: 0,
  },
];
