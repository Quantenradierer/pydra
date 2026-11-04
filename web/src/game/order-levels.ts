import type { Localized } from '../content/types.ts';

/**
 * A level of "Code puzzle": a program for the warrior of Hydra hunt whose
 * lines are all there but shuffled. The player puts them in order and runs
 * the program; any order that slays every hydra and takes all the gold
 * solves the level. Indentation belongs to a line and moves with it.
 */
export interface OrderLevel {
  /** Stable, saved in the progress. */
  id: string;
  /** The concept the level practises, shown as its title. */
  title: Localized;
  /** One or two sentences that introduce the concept. */
  intro: Localized;
  /** Map rows as in Hydra hunt: `#` rock, `.` grass, `@` start, `G` gold, `H` head, `o` body. */
  map: string[];
  /** The program's lines in a right order. */
  lines: string[];
  /** The order the lines are shown in at first: indices into `lines`. It must not solve the level. */
  start: number[];
  /** Shown after a run that did not solve the level; helps without giving the order away. */
  hint: Localized;
  /** Shown once the level is solved: why this order works. */
  explain: Localized;
}

/** A level's program with its lines in the given order. */
export function arrange(level: OrderLevel, order: readonly number[]): string {
  return order.map((i) => level.lines[i]!).join('\n');
}

export const ORDER_LEVELS: readonly OrderLevel[] = [
  {
    id: 'order-steps',
    title: { de: 'Erst gehen, dann schlagen', en: 'Walk first, then strike' },
    intro: {
      de: 'Alle Zeilen sind schon da, nur in der falschen Reihenfolge. Schieb sie mit ▲ und ▼ an ihren Platz und drück auf „Ausführen“.',
      en: 'All the lines are there already, just in the wrong order. Move them into place with ▲ and ▼ and press "Run".',
    },
    map: ['@.oH', '....'],
    lines: ['move_east()', 'move_east()', 'attack()'],
    start: [2, 0, 1],
    hint: {
      de: 'Python führt die Zeilen von oben nach unten aus. Wo muss der Krieger stehen, wenn er zuschlägt?',
      en: 'Python runs the lines from top to bottom. Where must the warrior stand when he strikes?',
    },
    explain: {
      de: 'Erst zwei Schritte bis auf den Körper der Hydra, dann der Schlag. Die Reihenfolge der Zeilen ist die Reihenfolge der Taten.',
      en: "First two steps onto the hydra's body, then the blow. The order of the lines is the order of the deeds.",
    },
  },
  {
    id: 'order-head',
    title: { de: 'Am Kopf vorbei', en: 'Past the head' },
    intro: {
      de: 'Auf den Kopf einer lebenden Hydra darf der Krieger nicht treten. Ist sie besiegt, ist der Weg frei bis zum Gold.',
      en: 'The warrior must not step on the head of a living hydra. Once it is defeated, the way to the gold is free.',
    },
    map: ['@oHG'],
    lines: ['move_east()', 'attack()', 'move_east()', 'move_east()'],
    start: [0, 2, 1, 3],
    hint: {
      de: 'Der Kopf ist nur gefährlich, solange die Hydra lebt. Wann muss also `attack()` kommen?',
      en: 'The head is only dangerous while the hydra lives. So when must `attack()` come?',
    },
    explain: {
      de: 'Ein Schritt auf den Körper, zuschlagen, und erst dann über den harmlosen Kopf zum Gold.',
      en: 'One step onto the body, strike, and only then over the harmless head to the gold.',
    },
  },
  {
    id: 'order-corner',
    title: { de: 'Um die Ecke', en: 'Round the corner' },
    intro: {
      de: '`move_north()` geht nach oben, `move_south()` nach unten. Der Krieger muss die Hydra von der Seite erwischen.',
      en: '`move_north()` goes up, `move_south()` goes down. The warrior has to catch the hydra from the side.',
    },
    map: ['@.G', '.oH'],
    lines: ['move_south()', 'move_east()', 'attack()', 'move_east()', 'move_north()'],
    start: [1, 0, 3, 2, 4],
    hint: {
      de: 'Zeichne den Weg mit dem Finger nach: Über welches Feld kommt der Krieger auf den Körper, ohne den Kopf zu berühren?',
      en: "Trace the way with your finger: over which cell does the warrior reach the body without touching the head?",
    },
    explain: {
      de: 'Erst nach unten, dann nach rechts auf den Körper, zuschlagen. Jetzt ist der Kopf harmlos: darüber und hinauf zum Gold.',
      en: 'First down, then right onto the body, strike. Now the head is harmless: over it and up to the gold.',
    },
  },
  {
    id: 'order-for',
    title: { de: 'Was gehört in die Schleife?', en: 'What goes in the loop?' },
    intro: {
      de: 'Die eingerückten Zeilen unter `for …:` gehören zur Schleife. Die Einrückung wandert mit ihrer Zeile mit.',
      en: 'The indented lines below `for …:` belong to the loop. The indentation moves with its line.',
    },
    map: ['@..oH'],
    lines: ['for i in range(3):', '    move_east()', 'attack()'],
    start: [1, 0, 2],
    hint: {
      de: 'Eine eingerückte Zeile braucht darüber eine Zeile mit Doppelpunkt, zu der sie gehört.',
      en: 'An indented line needs a line with a colon above it that it belongs to.',
    },
    explain: {
      de: 'Die Schleife kommt zuerst, ihr eingerückter Schritt läuft dreimal, und danach, nicht eingerückt, einmal der Schlag.',
      en: 'The loop comes first, its indented step runs three times, and after it, not indented, the blow once.',
    },
  },
  {
    id: 'order-loop-body',
    title: { de: 'Treppe hinab', en: 'Down the stairs' },
    intro: {
      de: 'Auch innerhalb einer Schleife zählt die Reihenfolge: Jede Runde führt ihre Zeilen von oben nach unten aus.',
      en: 'Order matters inside a loop too: every round runs its lines from top to bottom.',
    },
    map: ['@G..', '..G.', '...G', '....'],
    lines: ['for i in range(3):', '    move_east()', '    move_south()'],
    start: [0, 2, 1],
    hint: {
      de: 'Schau, wo das erste Gold liegt: Muss der Krieger zuerst nach rechts oder nach unten?',
      en: 'Look where the first gold lies: must the warrior go right or down first?',
    },
    explain: {
      de: 'In jeder Runde erst nach rechts auf das Gold, dann nach unten. So trifft jede Stufe der Treppe ein Gold.',
      en: 'In every round first right onto the gold, then down. That way every step of the stairs hits a gold.',
    },
  },
  {
    id: 'order-function',
    title: { de: 'Erst definieren, dann aufrufen', en: 'Define first, then call' },
    intro: {
      de: 'Eine Funktion gibt es erst, wenn Python ihr `def` gelesen hat. Erst danach kann man sie aufrufen.',
      en: 'A function only exists once Python has read its `def`. Only after that can it be called.',
    },
    map: ['@.G', '.o.', '.H.'],
    lines: ['def strike():', '    move_south()', '    attack()', '    move_north()', 'move_east()', 'strike()', 'move_east()'],
    start: [4, 5, 6, 0, 2, 1, 3],
    hint: {
      de: 'Ein `NameError` heißt: Python kennt den Namen an dieser Stelle noch nicht. Und in der Funktion: hinunter, zuschlagen, wieder hinauf.',
      en: 'A `NameError` means: Python does not know the name at that point yet. And inside the function: down, strike, back up.',
    },
    explain: {
      de: 'Ganz oben steht `def` mit seinen drei eingerückten Zeilen. Erst danach läuft das Hauptprogramm: ein Schritt, `strike()`, und weiter zum Gold.',
      en: 'At the very top stands `def` with its three indented lines. Only after it does the main program run: one step, `strike()`, and on to the gold.',
    },
  },
  {
    id: 'order-while',
    title: { de: 'Laufen bis zur Hydra', en: 'Walk up to the hydra' },
    intro: {
      de: '`body_here()` ist `True`, wenn der Krieger auf dem Körper einer lebenden Hydra steht. `while not body_here():` läuft, bis er dort ist.',
      en: '`body_here()` is `True` when the warrior stands on the body of a living hydra. `while not body_here():` runs until he is there.',
    },
    map: ['@..oHG'],
    lines: ['while not body_here():', '    move_east()', 'attack()', 'move_east()', 'move_east()'],
    start: [3, 0, 1, 4, 2],
    hint: {
      de: 'Die Schleife bringt den Krieger von selbst genau auf den Körper. Was muss gleich danach passieren?',
      en: 'The loop takes the warrior right onto the body by itself. What has to happen straight after?',
    },
    explain: {
      de: 'Die Schleife läuft genau bis auf den Körper, dann kommt der Schlag. Erst danach sind die zwei Schritte über den Kopf zum Gold sicher.',
      en: 'The loop walks exactly onto the body, then comes the blow. Only after that are the two steps over the head to the gold safe.',
    },
  },
  {
    id: 'order-if',
    title: { de: 'Erst gehen, dann nachsehen', en: 'Walk first, then look' },
    intro: {
      de: '`if body_here():` schlägt nur zu, wenn der Krieger auf einer Hydra steht. Hier zählt auch, wie tief jede Zeile eingerückt ist.',
      en: '`if body_here():` strikes only when the warrior stands on a hydra. Here it also matters how deep each line is indented.',
    },
    map: ['@o..o', '.H..H'],
    lines: ['for i in range(4):', '    move_east()', '    if body_here():', '        attack()'],
    start: [0, 2, 3, 1],
    hint: {
      de: 'Nachsehen hilft nur, wenn der Krieger schon auf dem neuen Feld steht. Was passiert mit der Hydra ganz rechts?',
      en: 'Looking only helps once the warrior stands on the new cell. What happens to the hydra on the far right?',
    },
    explain: {
      de: 'In jeder Runde erst ein Schritt, dann die Frage, ob hier eine Hydra ist. So wird auch auf dem letzten Feld noch nachgesehen.',
      en: 'In every round first a step, then the question whether there is a hydra here. That way the last cell gets checked too.',
    },
  },
  {
    id: 'order-west',
    title: { de: 'Der andere Weg', en: 'The other way' },
    intro: {
      de: '`move_west()` geht nach links. Die Hydra liegt diesmal links vom Krieger, der Kopf hinten.',
      en: '`move_west()` goes left. This time the hydra lies to the left of the warrior, its head at the far end.',
    },
    map: ['GHo@'],
    lines: ['move_west()', 'attack()', 'move_west()', 'move_west()'],
    start: [0, 2, 1, 3],
    hint: {
      de: 'Der Krieger trifft zuerst den Körper. Erst wenn die Hydra besiegt ist, darf er über den Kopf gehen.',
      en: 'The warrior meets the body first. Only once the hydra is defeated may he walk over the head.',
    },
    explain: {
      de: 'Ein Schritt nach links auf den Körper, zuschlagen, dann zwei Schritte nach links über den Kopf zum Gold.',
      en: 'One step left onto the body, strike, then two steps left over the head to the gold.',
    },
  },
  {
    id: 'order-two',
    title: { de: 'Zwei Hydras', en: 'Two hydras' },
    intro: {
      de: 'Zwei Hydras, ein Weg. Eine Schleife zählt die Schritte zwischen den Schlägen.',
      en: 'Two hydras, one path. A loop counts the steps between the blows.',
    },
    map: ['@oH.oH'],
    lines: ['move_east()', 'attack()', 'for i in range(3):', '    move_east()', 'attack()'],
    start: [0, 2, 3, 4, 1],
    hint: {
      de: 'Zuerst die erste Hydra besiegen. Dann bringt die Schleife den Krieger zur zweiten. Welche Zeile gehört nicht in die Schleife?',
      en: 'Defeat the first hydra first. Then the loop takes the warrior to the second. Which line is not part of the loop?',
    },
    explain: {
      de: 'Ein Schritt und Schlag für die erste Hydra, danach läuft die Schleife dreimal weiter bis auf den zweiten Körper, und der letzte Schlag steht außerhalb der Schleife.',
      en: 'One step and blow for the first hydra, then the loop walks three times to the second body, and the last blow stands outside the loop.',
    },
  },
  {
    id: 'order-rock',
    title: { de: 'Um den Felsen', en: 'Round the rock' },
    intro: {
      de: 'Ein `#` ist ein Fels. Der Krieger kann nicht hindurch, er muss darum herum gehen.',
      en: 'A `#` is a rock. The warrior cannot pass through it, he has to go round it.',
    },
    map: ['@#G', '...'],
    lines: ['move_south()', 'move_east()', 'move_east()', 'move_north()'],
    start: [1, 0, 3, 2],
    hint: {
      de: 'Rechts vom Krieger liegt ein Fels. In welche Richtung muss er also zuerst gehen?',
      en: 'There is a rock right of the warrior. So which way must he go first?',
    },
    explain: {
      de: 'Erst nach unten, unter dem Felsen durch zwei Schritte nach rechts, und dann hinauf zum Gold.',
      en: 'First down, two steps right beneath the rock, and then up to the gold.',
    },
  },
  {
    id: 'order-down',
    title: { de: 'Nach unten', en: 'Downwards' },
    intro: {
      de: 'Diesmal liegt die Hydra unter dem Krieger: Ihr Kopf ist unten, das Gold noch weiter unten.',
      en: 'This time the hydra lies below the warrior: its head is further down, the gold even further.',
    },
    map: ['@', 'o', 'H', 'G'],
    lines: ['move_south()', 'attack()', 'move_south()', 'move_south()'],
    start: [0, 2, 1, 3],
    hint: {
      de: 'Der Krieger trifft zuerst den Körper. Wann darf er auf den Kopf treten?',
      en: 'The warrior meets the body first. When may he step on the head?',
    },
    explain: {
      de: 'Ein Schritt nach unten auf den Körper, zuschlagen, dann zwei Schritte nach unten über den Kopf zum Gold.',
      en: 'One step down onto the body, strike, then two steps down over the head to the gold.',
    },
  },
  {
    id: 'order-over',
    title: { de: 'Erst schlagen, dann hinauf', en: 'Strike, then climb' },
    intro: {
      de: 'Das Gold liegt oben rechts, die Hydra unten. Der Krieger muss sie besiegen, bevor er das Gold holt.',
      en: 'The gold lies at the top right, the hydra below. The warrior has to defeat it before he fetches the gold.',
    },
    map: ['..G', '@oH'],
    lines: ['move_east()', 'attack()', 'move_north()', 'move_east()'],
    start: [0, 2, 3, 1],
    hint: {
      de: 'Zuschlagen geht nur auf dem Körper. Wo steht der Krieger, wenn er nach oben gegangen ist?',
      en: 'Striking only works on the body. Where does the warrior stand once he has gone up?',
    },
    explain: {
      de: 'Ein Schritt auf den Körper, zuschlagen, dann hinauf und nach rechts zum Gold.',
      en: 'One step onto the body, strike, then up and right to the gold.',
    },
  },
  {
    id: 'order-gold-row',
    title: { de: 'Gold in einer Reihe', en: 'A row of gold' },
    intro: {
      de: 'Die Schleife läuft die Gold-Reihe ab. Eine Zeile ohne Einrückung gehört nicht zur Schleife.',
      en: 'The loop walks along the row of gold. A line without indentation is not part of the loop.',
    },
    map: ['@GGG', '...G'],
    lines: ['for i in range(3):', '    move_east()', 'move_south()'],
    start: [2, 0, 1],
    hint: {
      de: 'Das Gold unten liegt am Ende der Reihe. Was soll zuerst geschehen: laufen oder nach unten gehen?',
      en: 'The gold below lies at the end of the row. What should happen first: walking or going down?',
    },
    explain: {
      de: 'Die Schleife sammelt das Gold der oberen Reihe in drei Schritten ein, dann geht es einmal nach unten zum letzten Gold.',
      en: 'The loop collects the gold of the top row in three steps, then one step down to the last gold.',
    },
  },
  {
    id: 'order-two-loops',
    title: { de: 'Zwei Schleifen', en: 'Two loops' },
    intro: {
      de: 'Ein Programm darf mehrere Schleifen hintereinander haben. Jede nimmt nur ihre eigene eingerückte Zeile mit.',
      en: 'A program may have several loops one after another. Each takes only its own indented line.',
    },
    map: ['@..', '##.', '..G'],
    lines: ['for i in range(2):', '    move_east()', 'for i in range(2):', '    move_south()'],
    start: [2, 3, 0, 1],
    hint: {
      de: 'Unter dem Krieger liegen Felsen. Welche Schleife muss zuerst laufen?',
      en: 'There are rocks below the warrior. Which loop has to run first?',
    },
    explain: {
      de: 'Erst zwei Schritte nach rechts über den Felsen hinweg, dann zwei nach unten bis zum Gold.',
      en: 'First two steps right, past the rocks, then two down to the gold.',
    },
  },
  {
    id: 'order-count',
    title: { de: 'Mitzählen', en: 'Keep count' },
    intro: {
      de: '`x = 0` legt eine Zahl ab, `x = x + 1` zählt eins hoch. `while x < 3:` läuft, solange x kleiner als 3 ist.',
      en: '`x = 0` stores a number, `x = x + 1` counts one up. `while x < 3:` runs as long as x is less than 3.',
    },
    map: ['@..G'],
    lines: ['x = 0', 'while x < 3:', '    move_east()', '    x = x + 1'],
    start: [1, 0, 2, 3],
    hint: {
      de: 'Python muss `x` kennen, bevor die Schleife es prüft. Und gezählt wird in jeder Runde.',
      en: 'Python has to know `x` before the loop checks it. And the counting happens in every round.',
    },
    explain: {
      de: 'Zuerst bekommt x den Wert 0. Dann geht der Krieger in jeder Runde einen Schritt und zählt hoch, bis x 3 erreicht hat.',
      en: 'First x gets the value 0. Then in every round the warrior takes a step and counts up, until x reaches 3.',
    },
  },
  {
    id: 'order-hop',
    title: { de: 'Ein Sprung, zweimal', en: 'One hop, twice' },
    intro: {
      de: 'Eine Funktion fasst Zeilen unter einem Namen zusammen. Jeder Aufruf führt sie noch einmal aus.',
      en: 'A function bundles lines under one name. Every call runs them once more.',
    },
    map: ['@...oH'],
    lines: ['def hop():', '    move_east()', '    move_east()', 'hop()', 'hop()', 'attack()'],
    start: [3, 0, 1, 2, 4, 5],
    hint: {
      de: 'Zuerst kommt die Definition mit ihren eingerückten Zeilen. Zwei Aufrufe bringen den Krieger vier Felder weit.',
      en: 'The definition with its indented lines comes first. Two calls take the warrior four cells.',
    },
    explain: {
      de: 'Erst `def hop()`, dann zwei Aufrufe: zusammen vier Schritte bis auf den Körper. Dort folgt der Schlag.',
      en: 'First `def hop()`, then two calls: four steps together, onto the body. There comes the blow.',
    },
  },
  {
    id: 'order-else',
    title: { de: 'Sonst weitergehen', en: 'Otherwise keep walking' },
    intro: {
      de: '`else:` gehört zu dem `if` darüber und steht genauso weit eingerückt. Es läuft, wenn die Bedingung nicht stimmt.',
      en: '`else:` belongs to the `if` above it and is indented just as far. It runs when the condition is not true.',
    },
    map: ['@.oHG'],
    lines: ['for i in range(5):', '    if body_here():', '        attack()', '    else:', '        move_east()'],
    start: [0, 3, 4, 1, 2],
    hint: {
      de: 'Erst die Frage `if`, mit ihrer Antwort darunter, dann `else:` mit seiner. Wie tief steht jede Zeile?',
      en: 'First the question `if`, with its answer below it, then `else:` with its own. How deep is each line?',
    },
    explain: {
      de: 'In jeder Runde gilt: Steht der Krieger auf einem Körper, schlägt er zu, sonst geht er einen Schritt weiter.',
      en: 'In every round: if the warrior stands on a body he strikes, otherwise he takes a step.',
    },
  },
  {
    id: 'order-def-loop',
    title: { de: 'Schleife in der Funktion', en: 'A loop in a function' },
    intro: {
      de: 'Eine Funktion kann eine Schleife enthalten. Dann ist die Schleifenzeile doppelt eingerückt.',
      en: 'A function can contain a loop. Then the loop body is indented twice.',
    },
    map: ['@..oH'],
    lines: ['def walk():', '    for i in range(3):', '        move_east()', 'walk()', 'attack()'],
    start: [3, 0, 1, 2, 4],
    hint: {
      de: 'Die Funktion muss stehen, bevor man sie aufruft. Danach braucht der Krieger den Körper unter den Füßen.',
      en: 'The function has to exist before it is called. After that the warrior needs the body under his feet.',
    },
    explain: {
      de: '`def walk()` mit seiner Schleife steht oben. Der Aufruf läuft drei Schritte bis auf den Körper, danach kommt der Schlag.',
      en: '`def walk()` with its loop stands at the top. The call walks three steps onto the body, after that comes the blow.',
    },
  },
  {
    id: 'order-hit-twice',
    title: { de: 'Zweimal zuschlagen', en: 'Strike twice' },
    intro: {
      de: 'Zwei Hydras, eine Funktion für Schritt und Schlag. Sie wird für jede Hydra einmal aufgerufen.',
      en: 'Two hydras, one function for step and blow. It is called once for each hydra.',
    },
    map: ['@oH.oH'],
    lines: ['def hit():', '    move_east()', '    attack()', 'hit()', 'move_east()', 'move_east()', 'hit()'],
    start: [3, 4, 5, 6, 0, 1, 2],
    hint: {
      de: 'Zuerst die Definition. Zwischen den beiden Aufrufen muss der Krieger über Kopf und Lücke zur nächsten Hydra gehen.',
      en: 'The definition first. Between the two calls the warrior must cross the head and the gap to the next hydra.',
    },
    explain: {
      de: 'Nach `def hit()` schlägt der erste Aufruf die erste Hydra. Zwei Schritte bringen den Krieger zur zweiten, und der zweite Aufruf erledigt sie.',
      en: 'After `def hit()` the first call defeats the first hydra. Two steps take the warrior to the second, and the second call finishes it.',
    },
  },
];
