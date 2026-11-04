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
];
