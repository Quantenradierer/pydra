import { T } from './helpers.ts';
import type { Text } from './types.ts';

/** A short card: one idea, one tiny example, one "try it". Chapter cards open a chapter, part cards show when a new part first appears. */
export interface Card {
  id: string;
  /** Shown with the first step of this chapter (25 / 45 are not used). */
  chapter: number;
  kind: 'chapter' | 'part';
  title: Text;
  idea: Text;
  example: string;
  tryIt: Text;
}

export const CARDS: readonly Card[] = [
  {
    id: 'ch0',
    chapter: 0,
    kind: 'chapter',
    title: T('Befehle nacheinander', 'Commands in a row'),
    idea: T('Ein Skript ist eine Liste von Befehlen. Der Roboter führt sie von oben nach unten aus, einen pro Zeile. Die Klammern gehören dazu: forward() ruft den Befehl auf.', 'A script is a list of commands. The robot runs them from top to bottom, one per line. The brackets matter: forward() calls the command.'),
    example: 'forward()\nfire()',
    tryIt: T('Füge eine zweite Zeile fire() hinzu und sieh, was sich ändert.', 'Add a second fire() line and see what changes.'),
  },
  {
    id: 'ch1',
    chapter: 1,
    kind: 'chapter',
    title: T('Zahlen und Variablen', 'Numbers and variables'),
    idea: T('Eine Variable ist ein Name für einen Wert: power = 3. Danach schreibst du den Namen statt der Zahl. Ändert sich der Wert, änderst du ihn nur an einer Stelle.', 'A variable is a name for a value: power = 3. After that you write the name instead of the number. If the value changes, you change it in one place only.'),
    example: 'power = 3\nfire(power)',
    tryIt: T('Ändere power auf 2 und sieh, ob der Gegner noch fällt.', 'Change power to 2 and see whether the enemy still falls.'),
  },
  {
    id: 'ch2',
    chapter: 2,
    kind: 'chapter',
    title: T('for-Schleifen', 'for loops'),
    idea: T('Eine for-Schleife wiederholt die eingerückten Zeilen. range(5) zählt 0 bis 4, die Schleife läuft also fünf Mal. Was nicht mehr eingerückt ist, kommt danach.', 'A for loop repeats the indented lines. range(5) counts 0 to 4, so the loop runs five times. Whatever is not indented comes after it.'),
    example: 'for i in range(5):\n    fire()',
    tryIt: T('Ändere die 5 und zähle die Schüsse im Replay.', 'Change the 5 and count the shots in the replay.'),
  },
  {
    id: 'ch3',
    chapter: 3,
    kind: 'chapter',
    title: T('if / elif / else', 'if / elif / else'),
    idea: T('if entscheidet: Der eingerückte Block läuft nur, wenn die Bedingung stimmt. elif ist ein weiteres „oder wenn“, else fängt alles andere auf. Es läuft nur der erste Zweig, dessen Bedingung stimmt.', 'if decides: the indented block only runs if the condition is true. elif is another "or if", else catches everything else. Only the first branch whose condition is true runs.'),
    example: 'if see() == "enemy":\n    fire()\nelse:\n    turn_right()',
    tryIt: T('Tausche das else gegen ein elif see_left() == "enemy": und eine Drehung nach links.', 'Replace the else with an elif see_left() == "enemy": and a turn to the left.'),
  },
  {
    id: 'ch4',
    chapter: 4,
    kind: 'chapter',
    title: T('while-Schleifen', 'while loops'),
    idea: T('while wiederholt, solange die Bedingung stimmt, und du musst vorher nicht wissen, wie oft. while alive(): ist die Hauptschleife deines Roboters. Achtung: Die Schleife muss etwas tun, das die Bedingung irgendwann ändert, sonst läuft sie endlos.', 'while repeats as long as the condition is true, and you do not need to know in advance how often. while alive(): is your robot\'s main loop. Careful: the loop must do something that eventually changes the condition, or it never stops.'),
    example: 'while see() != "enemy":\n    forward()\nfire()',
    tryIt: T('Ersetze forward() durch wait() und sieh, warum der Roboter nie ankommt.', 'Replace forward() with wait() and see why the robot never arrives.'),
  },
  {
    id: 'part-cannon',
    chapter: 1,
    kind: 'part',
    title: T('Neu: Kanone', 'New: Cannon'),
    idea: T('Die Kanone schießt mit Stärke 1 bis 3 und braucht danach so viele Ticks zum Laden. Gegen Panzerung brauchst du Stärke.', 'The cannon shoots with power 1 to 3 and then needs that many ticks to recharge. Against armor you need power.'),
    example: 'fire(3)\nwait()\nwait()\nfire(3)',
    tryIt: T('Probiere fire(3) zweimal direkt hintereinander: Der zweite Schuss verpufft.', 'Try fire(3) twice in a row: the second shot fizzles.'),
  },
  {
    id: 'part-legs',
    chapter: 1,
    kind: 'part',
    title: T('Neu: Spinnenbeine', 'New: Spider legs'),
    idea: T('Spinnenbeine gehen in feste Himmelsrichtungen und über Geröll. Sie schießen dorthin, wohin der Roboter schaut.', 'Spider legs walk in fixed compass directions and over rubble. They shoot where the robot is looking.'),
    example: 'move_north(2)\nmove_east()\nrotate_right()',
    tryIt: T('Baue die Beine ein und gehe über das Geröll der Treppe.', 'Equip the legs and cross the rubble of the staircase.'),
  },
  {
    id: 'part-wide',
    chapter: 3,
    kind: 'part',
    title: T('Neu: Weitwinkel und Schild-Scanner', 'New: Wide-angle and shield scanner'),
    idea: T('Die Augen bekommen Zusätze ohne extra Platz: see_left() und see_right() schauen zur Seite, enemy_shielded() verrät, ob das Schild des Gegners oben ist.', 'The eyes get add-ons without an extra slot: see_left() and see_right() look sideways, enemy_shielded() tells you whether the enemy\'s shield is up.'),
    example: 'if see_right() == "enemy":\n    turn_right()',
    tryIt: T('Frag see_left() ab, bevor du dich drehst.', 'Ask see_left() before you turn.'),
  },
  {
    id: 'part-hammer',
    chapter: 3,
    kind: 'part',
    title: T('Neu: Hammer', 'New: Hammer'),
    idea: T('Der Hammer trifft nur das Feld direkt vor dir, dafür mit 3 Schaden; danach lädt er 2 Ticks. Er ist ein Gegenstand: hammer.smash() oder kurz smash().', 'The hammer only hits the tile right in front of you, but for 3 damage; then it recharges for 2 ticks. It is an object: hammer.smash(), or smash() for short.'),
    example: 'if distance() == 1:\n    smash()',
    tryIt: T('Teste den Hammer gegen den Stürmer.', 'Test the hammer against the Charger.'),
  },
  {
    id: 'part-shield',
    chapter: 3,
    kind: 'part',
    title: T('Neu: Schildgenerator und Mittelklasse-Chassis', 'New: Shield generator and medium chassis'),
    idea: T('shield.activate() hebt das Schild für den nächsten Tick und blockt einen Treffer; danach lädt es 2 Ticks. Das mittlere Chassis hat 12 Leben und 3 Plätze.', 'shield.activate() raises the shield for the next tick and blocks one hit; then it recharges for 2 ticks. The medium chassis has 12 HP and 3 slots.'),
    example: 'shield.activate()',
    tryIt: T('Aktiviere das Schild, wenn der Gegner schießen kann.', 'Activate the shield when the enemy can shoot.'),
  },
  {
    id: 'part-gps',
    chapter: 4,
    kind: 'part',
    title: T('Neu: GPS', 'New: GPS'),
    idea: T('gps.position() gibt (x, y) zurück, gps.facing() eine Himmelsrichtung. Das Feld links oben ist (0, 0). Mit [1] holst du den zweiten Wert.', 'gps.position() returns (x, y), gps.facing() a compass direction. The tile at the top left is (0, 0). [1] picks the second value.'),
    example: 'while gps.position()[1] > 0:\n    forward()',
    tryIt: T('Lass den Roboter sagen, wo er steht: say(gps.position()).', 'Let the robot say where it stands: say(gps.position()).'),
  },
  {
    id: 'part-treads',
    chapter: 4,
    kind: 'part',
    title: T('Neu: Ketten', 'New: Treads'),
    idea: T('Ketten fahren wie Räder, geben +3 Panzerung und kommen über Geröll. Dafür dauert eine Drehung 2 Ticks. push() schiebt einen Gegner ein Feld weiter.', 'Treads drive like wheels, give +3 armor and cross rubble. A turn takes 2 ticks, though. push() shoves an enemy one tile further.'),
    example: 'forward()\npush()',
    tryIt: T('Gegen Blaster-Schüsse bist du jetzt fast unverwundbar.', 'Against blaster shots you are almost invulnerable now.'),
  },
  {
    id: 'part-burst',
    chapter: 4,
    kind: 'part',
    title: T('Neu: Burst-Blaster (Mk II)', 'New: Burst blaster (Mk II)'),
    idea: T('Der Burst-Blaster schießt mit fire(n) bis zu dreimal pro Befehl, wird dabei aber heiß: blaster.heat() zeigt es. Bei Hitze 10 überhitzt er.', 'The burst blaster shoots up to three times per command with fire(n), but gets hot: blaster.heat() shows it. At heat 10 it overheats.'),
    example: 'fire(2)',
    tryIt: T('Beobachte blaster.heat() im Replay.', 'Watch blaster.heat() in the replay.'),
  },
];

export const cardsOfChapter = (chapter: number): Card[] => CARDS.filter((c) => c.chapter === chapter);
