import type { Localized } from '../content/types.ts';

/**
 * A level of "What does the hydra say?": a short program that prints a few
 * lines. Every printed line is a head of the hydra; the player types what
 * each line will be, then the program runs step by step. A right line costs
 * the hydra its head, a wrong one grows back.
 */
export interface PredictLevel {
  /** Stable, saved in the progress. */
  id: string;
  /** The concept the level practises, shown as its title. */
  title: Localized;
  /** One or two sentences that introduce the concept. */
  intro: Localized;
  /** The program, the same in every language; it only uses what game/python.ts runs, plus print(). */
  code: string;
  /** What the program prints, line by line: checked against the interpreter (and real Python). */
  output: string[];
  /** Shown after a wrong prediction; helps without giving the output away. */
  hint: Localized;
  /** Shown once the level is solved: why the program prints this. */
  explain: Localized;
}

export const PREDICT_LEVELS: readonly PredictLevel[] = [
  {
    id: 'predict-text',
    title: { de: 'print zeigt Text', en: 'print shows text' },
    intro: {
      de: '`print(…)` schreibt eine Zeile auf den Bildschirm. Jede Zeile, die das Programm ausgibt, ist ein Kopf der Hydra: Schreib in jedes Feld, was dort stehen wird.',
      en: '`print(…)` writes one line to the screen. Every line the program prints is a head of the hydra: type into each box what that line will say.',
    },
    code: 'print("Python")\nprint("Hydra")',
    output: ['Python', 'Hydra'],
    hint: {
      de: 'Die Anführungszeichen sagen Python nur, wo der Text anfängt und aufhört. Ausgegeben werden sie nicht.',
      en: 'The quotes only tell Python where the text starts and ends. They are not printed.',
    },
    explain: {
      de: 'Jedes `print` gibt eine eigene Zeile aus, in der Reihenfolge des Programms, und zwar den Text ohne Anführungszeichen.',
      en: 'Each `print` prints a line of its own, in the order of the program, and it prints the text without its quotes.',
    },
  },
  {
    id: 'predict-math',
    title: { de: 'Erst rechnen, dann zeigen', en: 'Compute first, then show' },
    intro: {
      de: 'Steht in `print(…)` eine Rechnung, rechnet Python sie zuerst aus und gibt nur das Ergebnis aus.',
      en: 'When there is a calculation inside `print(…)`, Python works it out first and prints only the result.',
    },
    code: 'print(3 + 4)\nprint(2 * 5)\nprint(10 - 7)',
    output: ['7', '10', '3'],
    hint: {
      de: '`*` heißt „mal“. Die Rechnung selbst erscheint nicht in der Ausgabe, nur ihr Ergebnis.',
      en: '`*` means "times". The calculation itself does not appear in the output, only its result.',
    },
    explain: {
      de: '`3 + 4` ist 7, `2 * 5` ist 10 und `10 - 7` ist 3. `print` bekommt jeweils nur die fertige Zahl.',
      en: '`3 + 4` is 7, `2 * 5` is 10 and `10 - 7` is 3. Each `print` only gets the finished number.',
    },
  },
  {
    id: 'predict-text-or-number',
    title: { de: 'Text oder Rechnung?', en: 'Text or calculation?' },
    intro: {
      de: 'Anführungszeichen machen aus allem Text, auch aus einer Rechnung. Python rechnet nur, was nicht in Anführungszeichen steht.',
      en: 'Quotes turn anything into text, even a calculation. Python only calculates what is not in quotes.',
    },
    code: 'print("3 + 4")\nprint(3 + 4)',
    output: ['3 + 4', '7'],
    hint: {
      de: 'Schau genau, welche Zeile Anführungszeichen hat. Text wird Zeichen für Zeichen ausgegeben, wie er dasteht.',
      en: 'Look closely at which line has quotes. Text is printed character by character, exactly as it is written.',
    },
    explain: {
      de: '`"3 + 4"` ist ein Text aus fünf Zeichen und wird genau so ausgegeben. `3 + 4` ohne Anführungszeichen ist eine Rechnung: 7.',
      en: '`"3 + 4"` is a text of five characters and is printed just like that. `3 + 4` without quotes is a calculation: 7.',
    },
  },
  {
    id: 'predict-compare',
    title: { de: 'Wahr oder falsch', en: 'True or false' },
    intro: {
      de: 'Ein Vergleich wie `5 > 3` ergibt `True` (wahr) oder `False` (falsch). `==` fragt, ob zwei Werte gleich sind.',
      en: 'A comparison such as `5 > 3` gives `True` or `False`. `==` asks whether two values are equal.',
    },
    code: 'print(5 > 3)\nprint(2 == 3)',
    output: ['True', 'False'],
    hint: {
      de: 'Python schreibt `True` und `False` auf Englisch und mit großem Anfangsbuchstaben.',
      en: 'Python writes `True` and `False` with a capital first letter.',
    },
    explain: {
      de: '5 ist größer als 3, also `True`. 2 ist nicht gleich 3, also `False`. `print` zeigt den Wahrheitswert so, wie Python ihn schreibt.',
      en: '5 is greater than 3, so `True`. 2 is not equal to 3, so `False`. `print` shows the truth value the way Python writes it.',
    },
  },
  {
    id: 'predict-variable',
    title: { de: 'Variablen ändern sich', en: 'Variables change' },
    intro: {
      de: 'Eine Variable ist ein Name für einen Wert. `print(heads)` zeigt den Wert, den `heads` genau in diesem Moment hat.',
      en: 'A variable is a name for a value. `print(heads)` shows the value `heads` has at exactly that moment.',
    },
    code: 'heads = 3\nprint(heads)\nheads = heads + 2\nprint(heads)',
    output: ['3', '5'],
    hint: {
      de: 'Geh Zeile für Zeile vor und merk dir, welchen Wert `heads` gerade hat. Ausgegeben wird der Wert, nicht der Name.',
      en: 'Go line by line and keep track of the value `heads` has right now. The value is printed, not the name.',
    },
    explain: {
      de: 'Zuerst ist `heads` 3, das zeigt das erste `print`. Dann rechnet `heads + 2` mit dem alten Wert 5 aus und speichert ihn unter `heads`.',
      en: 'First `heads` is 3, which the first `print` shows. Then `heads + 2` works out 5 from the old value and stores it in `heads`.',
    },
  },
  {
    id: 'predict-copy',
    title: { de: 'Einmal ausgerechnet', en: 'Worked out once' },
    intro: {
      de: '`y = x + 2` rechnet sofort und speichert das Ergebnis in `y`. Was später mit `x` passiert, ändert `y` nicht mehr.',
      en: '`y = x + 2` calculates right away and stores the result in `y`. Whatever happens to `x` later does not change `y`.',
    },
    code: 'x = 5\ny = x + 2\nx = 10\nprint(x)\nprint(y)',
    output: ['10', '7'],
    hint: {
      de: 'Welchen Wert hatte `x`, als die Zeile `y = x + 2` lief?',
      en: 'What value did `x` have when the line `y = x + 2` ran?',
    },
    explain: {
      de: 'Als `y = x + 2` lief, war `x` noch 5, also bekam `y` den Wert 7. Danach bekommt nur `x` den neuen Wert 10; `y` bleibt 7.',
      en: 'When `y = x + 2` ran, `x` was still 5, so `y` got the value 7. After that only `x` gets the new value 10; `y` stays 7.',
    },
  },
  {
    id: 'predict-divide',
    title: { de: 'Teilen mit Rest', en: 'Division with remainder' },
    intro: {
      de: '`//` teilt und lässt die Kommastellen weg, `%` gibt den Rest. Und wie in Mathe gilt: Punkt vor Strich.',
      en: '`//` divides and drops the fraction, `%` gives the remainder. And just like in maths, `*` comes before `+`.',
    },
    code: 'print(7 // 2)\nprint(7 % 2)\nprint(2 + 3 * 4)',
    output: ['3', '1', '14'],
    hint: {
      de: 'Wie oft passt 2 ganz in 7, und was bleibt übrig? In der letzten Zeile rechnet Python das Malnehmen zuerst.',
      en: 'How many times does 2 fit into 7 completely, and what is left over? In the last line Python multiplies first.',
    },
    explain: {
      de: '2 passt dreimal ganz in 7 (`7 // 2` ist 3), und 1 bleibt übrig (`7 % 2` ist 1). `2 + 3 * 4` ist 2 + 12, also 14.',
      en: '2 fits into 7 three times (`7 // 2` is 3), and 1 is left over (`7 % 2` is 1). `2 + 3 * 4` is 2 + 12, so 14.',
    },
  },
  {
    id: 'predict-concat',
    title: { de: 'Texte zusammenkleben', en: 'Gluing texts together' },
    intro: {
      de: '`+` zwischen zwei Texten klebt sie aneinander. Ein Leerzeichen entsteht nur, wenn eins in einem der Texte steht.',
      en: '`+` between two texts glues them together. There is only a space if one of the texts contains it.',
    },
    code: 'name = "Hydra"\nprint("Hi " + name)\nprint(name + name)',
    output: ['Hi Hydra', 'HydraHydra'],
    hint: {
      de: 'Achte auf die Leerzeichen: Wo genau steht eins, und wo nicht?',
      en: 'Watch the spaces: where exactly is there one, and where not?',
    },
    explain: {
      de: '`"Hi "` endet mit einem Leerzeichen, darum steht eins zwischen „Hi“ und „Hydra“. `name + name` klebt zweimal „Hydra“ ohne Lücke aneinander.',
      en: '`"Hi "` ends with a space, so there is one between "Hi" and "Hydra". `name + name` glues "Hydra" to itself with no gap.',
    },
  },
  {
    id: 'predict-commas',
    title: { de: 'Mehrere Werte in einem print', en: 'Several values in one print' },
    intro: {
      de: '`print` kann mehrere Werte bekommen, durch Kommas getrennt. Es gibt sie in einer Zeile aus, mit je einem Leerzeichen dazwischen.',
      en: '`print` can take several values, separated by commas. It prints them on one line, with one space between each.',
    },
    code: 'heads = 9\nprint("heads:", heads)\nprint(heads, heads - 1)',
    output: ['heads: 9', '9 8'],
    hint: {
      de: 'Die Kommas selbst werden nicht ausgegeben. An ihrer Stelle setzt `print` ein Leerzeichen.',
      en: 'The commas themselves are not printed. In their place `print` puts a space.',
    },
    explain: {
      de: 'Das erste `print` gibt den Text „heads:“, ein Leerzeichen und den Wert 9 aus. Das zweite gibt 9 und `heads - 1`, also 8, mit einem Leerzeichen dazwischen aus.',
      en: 'The first `print` prints the text "heads:", a space and the value 9. The second prints 9 and `heads - 1`, which is 8, with a space in between.',
    },
  },
  {
    id: 'predict-if-else',
    title: { de: 'Nur ein Weg', en: 'Only one way' },
    intro: {
      de: 'Bei `if`/`else` läuft genau einer der beiden Blöcke: der unter `if`, wenn die Bedingung wahr ist, sonst der unter `else`. Danach geht es normal weiter.',
      en: 'With `if`/`else` exactly one of the two blocks runs: the one under `if` when the condition is true, otherwise the one under `else`. Then the program carries on.',
    },
    code: 'x = 7\nif x > 5:\n    print("big")\nelse:\n    print("small")\nprint("done")',
    output: ['big', 'done'],
    hint: {
      de: 'Ist `x > 5` wahr oder falsch? Und die letzte Zeile ist nicht eingerückt: Gehört sie zum `else`?',
      en: 'Is `x > 5` true or false? And the last line is not indented: does it belong to the `else`?',
    },
    explain: {
      de: '7 ist größer als 5, also läuft nur der `if`-Block und gibt „big“ aus; der `else`-Block wird übersprungen. `print("done")` ist nicht eingerückt und läuft immer.',
      en: '7 is greater than 5, so only the `if` block runs and prints "big"; the `else` block is skipped. `print("done")` is not indented and always runs.',
    },
  },
  {
    id: 'predict-range',
    title: { de: 'Zählen mit range', en: 'Counting with range' },
    intro: {
      de: '`for i in range(3):` wiederholt den eingerückten Block, und `i` zählt dabei mit. Jede Runde gibt hier eine Zeile aus.',
      en: '`for i in range(3):` repeats the indented block, and `i` counts along. Each round prints one line here.',
    },
    code: 'for i in range(3):\n    print(i)',
    output: ['0', '1', '2'],
    hint: {
      de: 'Bei welcher Zahl fängt `range` an zu zählen? Und ist die 3 selbst noch dabei?',
      en: 'Which number does `range` start counting at? And is 3 itself included?',
    },
    explain: {
      de: '`range(3)` zählt 0, 1, 2: Es beginnt bei 0 und hört vor der 3 auf. Das sind genau drei Runden.',
      en: '`range(3)` counts 0, 1, 2: it starts at 0 and stops before 3. That is exactly three rounds.',
    },
  },
  {
    id: 'predict-loop-total',
    title: { de: 'Nach der Schleife', en: 'After the loop' },
    intro: {
      de: 'Die Schleife geht die Liste durch und zählt alles in `total` zusammen. Das `print` ist nicht eingerückt: Es läuft erst nach der Schleife, einmal.',
      en: 'The loop goes through the list and adds everything up in `total`. The `print` is not indented: it runs only after the loop, once.',
    },
    code: 'total = 0\nfor n in [2, 4, 6]:\n    total += n\nprint(total)',
    output: ['12'],
    hint: {
      de: '`total += n` heißt: Zähl `n` zu `total` dazu. Rechne jede Runde mit, bis die Liste zu Ende ist.',
      en: '`total += n` means: add `n` to `total`. Work out every round until the list is done.',
    },
    explain: {
      de: '`total` wird 0 + 2 = 2, dann 2 + 4 = 6, dann 6 + 6 = 12. Erst danach läuft `print` und zeigt 12.',
      en: '`total` becomes 0 + 2 = 2, then 2 + 4 = 6, then 6 + 6 = 12. Only then does `print` run and show 12.',
    },
  },
  {
    id: 'predict-loop-inside',
    title: { de: 'In der Schleife', en: 'Inside the loop' },
    intro: {
      de: 'Jetzt ist das `print` eingerückt und gehört zur Schleife: Es läuft in jeder Runde und zeigt, wie weit `total` gerade ist.',
      en: 'Now the `print` is indented and belongs to the loop: it runs every round and shows how far `total` has got.',
    },
    code: 'total = 0\nfor n in [1, 2, 3]:\n    total += n\n    print(total)',
    output: ['1', '3', '6'],
    hint: {
      de: 'Ausgegeben wird nicht `n`, sondern `total`, und zwar erst, nachdem `n` dazugezählt wurde.',
      en: 'It is not `n` that is printed but `total`, and only after `n` has been added.',
    },
    explain: {
      de: 'Runde 1: 0 + 1 = 1. Runde 2: 1 + 2 = 3. Runde 3: 3 + 3 = 6. Nach jedem Dazuzählen zeigt `print` den neuen Stand.',
      en: 'Round 1: 0 + 1 = 1. Round 2: 1 + 2 = 3. Round 3: 3 + 3 = 6. After each addition `print` shows the new total.',
    },
  },
  {
    id: 'predict-countdown',
    title: { de: 'Countdown', en: 'Countdown' },
    intro: {
      de: '`while` wiederholt seinen Block, solange die Bedingung wahr ist. `n -= 1` macht `n` um eins kleiner.',
      en: '`while` repeats its block as long as the condition is true. `n -= 1` makes `n` one smaller.',
    },
    code: 'n = 3\nwhile n > 0:\n    print(n)\n    n -= 1\nprint("Go!")',
    output: ['3', '2', '1', 'Go!'],
    hint: {
      de: 'Wird `print(n)` vor oder nach dem Kleinermachen ausgeführt? Und was passiert, wenn `n` 0 ist?',
      en: 'Does `print(n)` run before or after `n` gets smaller? And what happens when `n` is 0?',
    },
    explain: {
      de: 'Die Schleife zeigt 3, 2 und 1 und zählt jedes Mal danach herunter. Bei 0 ist `n > 0` falsch, die Schleife endet, und „Go!“ kommt.',
      en: 'The loop shows 3, 2 and 1 and counts down after each one. At 0, `n > 0` is false, the loop ends, and "Go!" comes.',
    },
  },
  {
    id: 'predict-string-index',
    title: { de: 'Buchstaben zählen', en: 'Counting letters' },
    intro: {
      de: '`len(word)` sagt, wie viele Zeichen ein Text hat. `word[0]` ist das erste Zeichen, `word[-1]` das letzte.',
      en: '`len(word)` tells how many characters a text has. `word[0]` is the first character, `word[-1]` the last.',
    },
    code: 'word = "Hydra"\nprint(len(word))\nprint(word[0])\nprint(word[-1])',
    output: ['5', 'H', 'a'],
    hint: {
      de: 'Python zählt die Stellen ab 0. Und Groß- und Kleinbuchstaben sind für Python verschiedene Zeichen.',
      en: 'Python counts positions from 0. And upper and lower case letters are different characters to Python.',
    },
    explain: {
      de: '„Hydra“ hat 5 Buchstaben. Stelle 0 ist das große „H“, und `-1` zählt von hinten: das kleine „a“.',
      en: '"Hydra" has 5 letters. Position 0 is the capital "H", and `-1` counts from the back: the small "a".',
    },
  },
  {
    id: 'predict-function',
    title: { de: 'Eine Funktion gibt zurück', en: 'A function returns' },
    intro: {
      de: '`def` legt eine Funktion an; sie läuft erst, wenn sie aufgerufen wird. `return` gibt ihr Ergebnis an die Stelle des Aufrufs zurück.',
      en: '`def` defines a function; it only runs when it is called. `return` hands its result back to where it was called.',
    },
    code: 'def double(x):\n    return x * 2\n\nprint(double(4))\nprint(double(double(1)))',
    output: ['8', '4'],
    hint: {
      de: 'Bei `double(double(1))` läuft zuerst der innere Aufruf. Sein Ergebnis geht dann in den äußeren.',
      en: 'In `double(double(1))` the inner call runs first. Its result then goes into the outer one.',
    },
    explain: {
      de: '`double(4)` gibt 8 zurück. Bei `double(double(1))` ergibt der innere Aufruf 2, und `double(2)` ergibt 4.',
      en: '`double(4)` returns 8. In `double(double(1))` the inner call gives 2, and `double(2)` gives 4.',
    },
  },
];
