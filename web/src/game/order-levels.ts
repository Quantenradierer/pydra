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
  {
    id: 'order-up',
    title: { de: 'Nach oben', en: 'Upwards' },
    intro: {
      de: 'Die Hydra liegt über dem Krieger, das Gold ganz oben. `move_north()` geht nach oben.',
      en: 'The hydra lies above the warrior, the gold at the very top. `move_north()` goes up.',
    },
    map: ['G', 'H', 'o', '@'],
    lines: ['move_north()', 'attack()', 'move_north()', 'move_north()'],
    start: [0, 2, 1, 3],
    hint: {
      de: 'Der Krieger trifft zuerst den Körper. Wann darf er auf den Kopf treten?',
      en: 'The warrior meets the body first. When may he step on the head?',
    },
    explain: {
      de: 'Ein Schritt hinauf auf den Körper, zuschlagen, dann zwei Schritte hinauf über den Kopf zum Gold.',
      en: 'One step up onto the body, strike, then two steps up over the head to the gold.',
    },
  },
  {
    id: 'order-back',
    title: { de: 'Hin und zurück', en: 'There and back' },
    intro: {
      de: 'Das Gold liegt hinter dem Krieger. Er muss erst die Hydra besiegen und dann denselben Weg zurückgehen.',
      en: 'The gold lies behind the warrior. He has to defeat the hydra first and then walk the same way back.',
    },
    map: ['G@oH'],
    lines: ['move_east()', 'attack()', 'move_west()', 'move_west()'],
    start: [0, 2, 1, 3],
    hint: {
      de: 'Zuschlagen geht nur auf dem Körper. Wo steht der Krieger, wenn er schon zurückgegangen ist?',
      en: 'Striking only works on the body. Where does the warrior stand once he has already gone back?',
    },
    explain: {
      de: 'Ein Schritt auf den Körper, zuschlagen, dann zwei Schritte zurück nach links bis zum Gold.',
      en: 'One step onto the body, strike, then two steps back to the left, to the gold.',
    },
  },
  {
    id: 'order-uturn',
    title: { de: 'Die Kehrtwende', en: 'The U-turn' },
    intro: {
      de: 'Felsen versperren den kurzen Weg. Der Krieger geht außen herum und kehrt dann um.',
      en: 'Rocks block the short way. The warrior goes round the outside and then turns back.',
    },
    map: ['@.', '#.', 'G.'],
    lines: ['move_east()', 'move_south()', 'move_south()', 'move_west()'],
    start: [1, 0, 2, 3],
    hint: {
      de: 'Unter dem Krieger liegt ein Fels. Welche Richtung ist als erste frei?',
      en: 'There is a rock below the warrior. Which direction is free first?',
    },
    explain: {
      de: 'Nach rechts, zwei Schritte nach unten und links zurück zum Gold. Der Weg führt wie ein U um den Felsen.',
      en: 'Right, two steps down and back left to the gold. The way runs round the rock like a U.',
    },
  },
  {
    id: 'order-zigzag',
    title: { de: 'Im Zickzack', en: 'Zigzag' },
    intro: {
      de: 'Zwei Felsen legen den Weg fest. Der Krieger muss Schritt für Schritt abbiegen.',
      en: 'Two rocks fix the way. The warrior has to turn step by step.',
    },
    map: ['@.#', '#.#', '..G'],
    lines: ['move_east()', 'move_south()', 'move_south()', 'move_east()'],
    start: [1, 0, 2, 3],
    hint: {
      de: 'Links unter dem Krieger ist ein Fels. Wohin geht der erste Schritt?',
      en: 'There is a rock below-left of the warrior. Where does the first step go?',
    },
    explain: {
      de: 'Rechts, zweimal nach unten, und dann rechts zum Gold: ein Zickzack durch die Felsen.',
      en: 'Right, down twice, and then right to the gold: a zigzag between the rocks.',
    },
  },
  {
    id: 'order-both-sides',
    title: { de: 'Auf beiden Seiten', en: 'On both sides' },
    intro: {
      de: 'Links und rechts vom Krieger liegt je eine Hydra. Er erledigt erst die eine, dann die andere.',
      en: 'There is a hydra on each side of the warrior. He deals with one, then the other.',
    },
    map: ['Ho@oH'],
    lines: ['move_west()', 'attack()', 'move_east()', 'move_east()', 'attack()'],
    start: [0, 2, 1, 3, 4],
    hint: {
      de: 'Schlagen geht nur auf einem Körper. Wo steht der Krieger nach einem Schritt links?',
      en: 'Striking only works on a body. Where does the warrior stand after one step left?',
    },
    explain: {
      de: 'Ein Schritt nach links, Schlag, dann zwei Schritte nach rechts auf den anderen Körper und noch ein Schlag.',
      en: 'One step left, a blow, then two steps right onto the other body and another blow.',
    },
  },
  {
    id: 'order-long-body',
    title: { de: 'Ein langer Körper', en: 'A long body' },
    intro: {
      de: 'Manche Hydras haben einen langen Körper. Der Krieger darf auf jedem Körperfeld zuschlagen.',
      en: 'Some hydras have a long body. The warrior may strike on any cell of the body.',
    },
    map: ['@.ooHG'],
    lines: ['move_east()', 'move_east()', 'attack()', 'move_east()', 'move_east()', 'move_east()'],
    start: [0, 2, 1, 3, 4, 5],
    hint: {
      de: 'Die Hydra liegt zwei Felder entfernt. Wo muss der Krieger stehen, bevor er zuschlägt?',
      en: 'The hydra begins two cells away. Where must the warrior stand before he strikes?',
    },
    explain: {
      de: 'Zwei Schritte bis auf das erste Körperfeld, zuschlagen, dann drei Schritte über Körper und Kopf bis zum Gold.',
      en: 'Two steps onto the first cell of the body, strike, then three steps over body and head to the gold.',
    },
  },
  {
    id: 'order-bent',
    title: { de: 'Um die Kurve', en: 'Round the bend' },
    intro: {
      de: 'Diese Hydra liegt in einer Kurve. Der Kopf ist rechts, der Krieger trifft sie oben am Körper.',
      en: 'This hydra lies in a bend. Its head is on the right, and the warrior meets it at the top of the body.',
    },
    map: ['@o.', '.oH', '..G'],
    lines: ['move_east()', 'attack()', 'move_south()', 'move_east()', 'move_south()'],
    start: [0, 2, 3, 1, 4],
    hint: {
      de: 'Schlag zuerst, danach ist die ganze Hydra besiegt. Welches Feld ist vorher gefährlich?',
      en: 'Strike first, after that the whole hydra is defeated. Which cell is dangerous before that?',
    },
    explain: {
      de: 'Ein Schritt auf das obere Körperfeld, zuschlagen. Dann nach unten, nach rechts über den harmlosen Kopf und nach unten zum Gold.',
      en: 'One step onto the upper body cell, strike. Then down, right over the harmless head, and down to the gold.',
    },
  },
  {
    id: 'order-stair-rocks',
    title: { de: 'Treppe zwischen Felsen', en: 'Stairs between rocks' },
    intro: {
      de: 'Die Schleife nimmt zwei Zeilen mit. Die Felsen zeigen, welche Zeile zuerst kommt.',
      en: 'The loop takes two lines along. The rocks show which line comes first.',
    },
    map: ['@.#', '#..', '.#G'],
    lines: ['for i in range(2):', '    move_east()', '    move_south()'],
    start: [0, 2, 1],
    hint: {
      de: 'Unter dem Krieger liegt ein Fels. Was muss in jeder Runde zuerst geschehen?',
      en: 'There is a rock below the warrior. What must happen first in every round?',
    },
    explain: {
      de: 'In jeder Runde erst nach rechts, dann nach unten: so führt die Treppe an allen Felsen vorbei zum Gold.',
      en: 'In every round first right, then down: that way the stairs lead past all the rocks to the gold.',
    },
  },
  {
    id: 'order-there-back',
    title: { de: 'Hin und her', en: 'Back and forth' },
    intro: {
      de: 'Zwei Schleifen bringen den Krieger zu beiden Goldstücken. Die zweite läuft weiter als die erste.',
      en: 'Two loops take the warrior to both pieces of gold. The second runs further than the first.',
    },
    map: ['G.@.G'],
    lines: ['for i in range(2):', '    move_west()', 'for i in range(4):', '    move_east()'],
    start: [2, 3, 0, 1],
    hint: {
      de: 'Der Krieger steht in der Mitte. Welche Schleife darf er zuerst laufen, ohne vom Feld zu fallen?',
      en: 'The warrior stands in the middle. Which loop can he run first without falling off the field?',
    },
    explain: {
      de: 'Erst zwei Schritte nach links zum ersten Gold, dann vier nach rechts: zurück über die Mitte zum anderen Gold.',
      en: 'First two steps left to the first gold, then four right: back over the middle to the other gold.',
    },
  },
  {
    id: 'order-north-loop',
    title: { de: 'Hinauf in der Schleife', en: 'Up in a loop' },
    intro: {
      de: 'Eine Schleife läuft ein Stück, dann kommt der Schlag. Danach geht es einzeln weiter.',
      en: 'A loop walks a stretch, then comes the blow. After that it goes on step by step.',
    },
    map: ['G', 'H', 'o', '.', '@'],
    lines: ['for i in range(2):', '    move_north()', 'attack()', 'move_north()', 'move_north()'],
    start: [3, 4, 0, 1, 2],
    hint: {
      de: 'Die Schleife läuft genau bis auf den Körper. Was kommt gleich danach?',
      en: 'The loop walks exactly onto the body. What comes right after it?',
    },
    explain: {
      de: 'Die Schleife geht zwei Schritte hinauf auf den Körper, dann der Schlag, und zwei einzelne Schritte führen über den Kopf zum Gold.',
      en: 'The loop goes two steps up onto the body, then the blow, and two single steps lead over the head to the gold.',
    },
  },
  {
    id: 'order-while-west',
    title: { de: 'Nach links bis zur Hydra', en: 'Left up to the hydra' },
    intro: {
      de: '`while not body_here():` funktioniert in jede Richtung. Hier läuft der Krieger nach links.',
      en: '`while not body_here():` works in every direction. Here the warrior walks left.',
    },
    map: ['GHo..@'],
    lines: ['while not body_here():', '    move_west()', 'attack()', 'move_west()', 'move_west()'],
    start: [2, 0, 1, 3, 4],
    hint: {
      de: 'Zuerst die Schleife, die den Krieger auf den Körper bringt. Dann erst der Schlag.',
      en: 'The loop first, which takes the warrior onto the body. Only then the blow.',
    },
    explain: {
      de: 'Die Schleife läuft nach links, bis der Krieger auf dem Körper steht. Dann kommt der Schlag und zwei Schritte über Kopf und Gold.',
      en: 'The loop walks left until the warrior stands on the body. Then comes the blow and two steps over head and gold.',
    },
  },
  {
    id: 'order-steps-var',
    title: { de: 'Schritte merken', en: 'Remember the steps' },
    intro: {
      de: 'Eine Zahl in einer Variable kann sagen, wie oft eine Schleife läuft: `range(steps)`.',
      en: 'A number in a variable can say how often a loop runs: `range(steps)`.',
    },
    map: ['@...oH'],
    lines: ['steps = 4', 'for i in range(steps):', '    move_east()', 'attack()'],
    start: [1, 2, 0, 3],
    hint: {
      de: 'Python muss `steps` kennen, bevor die Schleife es braucht.',
      en: 'Python has to know `steps` before the loop needs it.',
    },
    explain: {
      de: 'Erst bekommt `steps` den Wert 4, dann läuft die Schleife viermal bis auf den Körper, und danach kommt der Schlag.',
      en: 'First `steps` gets the value 4, then the loop runs four times onto the body, and after that comes the blow.',
    },
  },
  {
    id: 'order-countdown',
    title: { de: 'Rückwärts zählen', en: 'Count down' },
    intro: {
      de: '`n = n - 1` zählt eins herunter. `while n > 0:` läuft, solange n größer als 0 ist.',
      en: '`n = n - 1` counts one down. `while n > 0:` runs as long as n is greater than 0.',
    },
    map: ['@', '.', '.', 'G'],
    lines: ['n = 3', 'while n > 0:', '    move_south()', '    n = n - 1'],
    start: [1, 0, 2, 3],
    hint: {
      de: 'Der Zähler muss einen Wert haben, bevor die Schleife ihn prüft. Und in jeder Runde sinkt er.',
      en: 'The counter needs a value before the loop checks it. And it drops in every round.',
    },
    explain: {
      de: 'n startet bei 3. In jeder Runde geht der Krieger einen Schritt nach unten und n sinkt, bis es 0 erreicht: genau drei Schritte.',
      en: 'n starts at 3. In every round the warrior takes a step down and n drops until it reaches 0: exactly three steps.',
    },
  },
  {
    id: 'order-two-vars',
    title: { de: 'Zwei Variablen', en: 'Two variables' },
    intro: {
      de: 'Zwei Variablen sagen, wie weit der Krieger in jede Richtung geht. Jede Schleife braucht ihre eigene.',
      en: 'Two variables say how far the warrior goes in each direction. Each loop needs its own.',
    },
    map: ['@..', '##G'],
    lines: ['a = 2', 'b = 1', 'for i in range(a):', '    move_east()', 'for i in range(b):', '    move_south()'],
    start: [0, 1, 4, 5, 2, 3],
    hint: {
      de: 'Unter dem Krieger liegen Felsen. Welche Schleife muss zuerst laufen?',
      en: 'There are rocks below the warrior. Which loop has to run first?',
    },
    explain: {
      de: 'Erst zwei Schritte nach rechts, dann einer nach unten zum Gold. Die Variablen stehen ganz oben.',
      en: 'First two steps right, then one down to the gold. The variables stand at the very top.',
    },
  },
  {
    id: 'order-maze',
    title: { de: 'Durch das Labyrinth', en: 'Through the maze' },
    intro: {
      de: 'Drei Schleifen führen den Krieger durch ein kleines Labyrinth: erst um den Felsen, dann wieder hinauf.',
      en: 'Three loops lead the warrior through a small maze: round the rock first, then back up.',
    },
    map: ['@.#G', '#.#.', '#...'],
    lines: ['move_east()', 'for i in range(2):', '    move_south()', 'for i in range(2):', '    move_east()', 'for i in range(2):', '    move_north()'],
    start: [1, 2, 0, 3, 4, 5, 6],
    hint: {
      de: 'Links unter dem Krieger ist ein Fels. Was muss er als Allererstes tun?',
      en: 'There is a rock below-left of the warrior. What must he do first of all?',
    },
    explain: {
      de: 'Ein Schritt nach rechts, zwei nach unten, zwei nach rechts und zwei hinauf zum Gold: jede Schleife nimmt nur ihre eigene Zeile mit.',
      en: 'One step right, two down, two right and two up to the gold: each loop takes only its own line.',
    },
  },
  {
    id: 'order-stairs-def',
    title: { de: 'Die Treppe als Funktion', en: 'The stairs as a function' },
    intro: {
      de: 'Eine Funktion kann eine ganze Treppenstufe sein. Zwei Aufrufe bauen zwei Stufen.',
      en: 'A function can be a whole step of a staircase. Two calls make two steps.',
    },
    map: ['..G', '.G.', '@..'],
    lines: ['def stair():', '    move_east()', '    move_north()', 'stair()', 'stair()'],
    start: [3, 0, 1, 2, 4],
    hint: {
      de: 'Die Definition muss stehen, bevor `stair()` aufgerufen wird. Eine Stufe geht erst nach rechts, dann hinauf.',
      en: 'The definition has to stand before `stair()` is called. One step goes right first, then up.',
    },
    explain: {
      de: '`def stair()` steht oben. Jeder Aufruf geht einen Schritt nach rechts und einen hinauf und trifft so ein Gold.',
      en: '`def stair()` stands at the top. Every call goes one step right and one up and so hits a gold.',
    },
  },
  {
    id: 'order-two-defs',
    title: { de: 'Zwei Funktionen', en: 'Two functions' },
    intro: {
      de: 'Ein Programm darf mehrere Funktionen haben. Jede wird definiert, bevor man sie aufruft.',
      en: 'A program may have several functions. Each is defined before it is called.',
    },
    map: ['@.', '#.', '#G'],
    lines: ['def right():', '    move_east()', 'def down():', '    move_south()', 'right()', 'down()', 'down()'],
    start: [4, 0, 1, 2, 3, 5, 6],
    hint: {
      de: 'Die Aufrufe kommen erst, wenn beide Funktionen definiert sind. Unter dem Krieger ist ein Fels.',
      en: 'The calls only come once both functions are defined. There is a rock below the warrior.',
    },
    explain: {
      de: 'Oben stehen beide Definitionen. Dann ein Schritt nach rechts und zwei nach unten am Felsen vorbei zum Gold.',
      en: 'Both definitions stand at the top. Then one step right and two down past the rock to the gold.',
    },
  },
  {
    id: 'order-check-func',
    title: { de: 'Prüfen als Funktion', en: 'Checking as a function' },
    intro: {
      de: 'Eine Funktion kann ein `if` enthalten. Die Schleife ruft sie nach jedem Schritt auf.',
      en: 'A function can contain an `if`. The loop calls it after every step.',
    },
    map: ['@oH.oHG'],
    lines: ['def check():', '    if body_here():', '        attack()', 'for i in range(6):', '    move_east()', '    check()'],
    start: [3, 4, 5, 0, 1, 2],
    hint: {
      de: 'Die Funktion muss definiert sein, bevor die Schleife sie aufruft. Erst gehen, dann prüfen.',
      en: 'The function has to be defined before the loop calls it. Walk first, then check.',
    },
    explain: {
      de: '`check()` steht oben und schlägt nur zu, wenn der Krieger auf einem Körper steht. Die Schleife ruft es nach jedem der sechs Schritte auf, so fallen beide Hydras.',
      en: '`check()` stands at the top and strikes only when the warrior stands on a body. The loop calls it after each of the six steps, so both hydras fall.',
    },
  },
  {
    id: 'order-else-down',
    title: { de: 'Sonst nach unten', en: 'Otherwise downwards' },
    intro: {
      de: '`if` und `else` in einer Schleife: auf dem Körper wird geschlagen, sonst geht der Krieger nach unten.',
      en: '`if` and `else` in a loop: on the body he strikes, otherwise the warrior goes down.',
    },
    map: ['@', '.', 'o', 'H', '.', 'G'],
    lines: ['for i in range(6):', '    if body_here():', '        attack()', '    else:', '        move_south()'],
    start: [0, 2, 1, 3, 4],
    hint: {
      de: 'Erst die Frage `if`, mit ihrer Antwort darunter, dann `else:` mit seiner. Wie tief steht jede Zeile?',
      en: 'First the question `if`, with its answer below it, then `else:` with its own. How deep is each line?',
    },
    explain: {
      de: 'In jeder Runde: auf dem Körper zuschlagen, sonst einen Schritt hinunter. Nach dem Schlag geht der Krieger über den Kopf bis zum Gold.',
      en: 'In every round: strike on the body, otherwise one step down. After the blow the warrior walks over the head to the gold.',
    },
  },
  {
    id: 'order-else-func',
    title: { de: 'Entscheiden in einer Funktion', en: 'Deciding in a function' },
    intro: {
      de: 'Die ganze Entscheidung steckt in einer Funktion. Die Schleife ruft sie nur noch auf.',
      en: 'The whole decision sits in a function. The loop only calls it.',
    },
    map: ['@.oHG'],
    lines: ['def act():', '    if body_here():', '        attack()', '    else:', '        move_east()', 'for i in range(5):', '    act()'],
    start: [5, 6, 0, 1, 2, 3, 4],
    hint: {
      de: 'Zuerst die Funktion mit ihrem `if` und `else`, dann erst die Schleife, die sie aufruft.',
      en: 'First the function with its `if` and `else`, only then the loop that calls it.',
    },
    explain: {
      de: '`act()` schlägt auf dem Körper zu und geht sonst einen Schritt nach rechts. Fünfmal aufgerufen führt es den Krieger über die besiegte Hydra bis zum Gold.',
      en: '`act()` strikes on the body and otherwise steps right. Called five times it takes the warrior over the beaten hydra to the gold.',
    },
  },
];
