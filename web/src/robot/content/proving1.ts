import { chapter, T } from './helpers.ts';

const ARMY = 'shots = 12\nforward(4)\nfor side in range(2):\n    for i in range(shots):\n        fire()\n    turn_right()';
const fight = (id: string, de: string, en: string, mix: string[], catchDe: string, catchEn: string) => ({
  id,
  title: T(de, en),
  catchLine: T(catchDe, catchEn),
  idea: T('Dein bester Code aus Kapitel 2 sollte alle Kämpfe schaffen. Prüfe, ob er auch für andere Attrappen allgemein genug ist.', 'Your best Chapter 2 code should win every fight. Check that it is general enough for other dummies too.'),
  skeleton: ARMY,
  enemies: [],
  maps: [],
  mix,
  solution: ARMY,
  breaks: false,
  par: 6,
});

/**
 * Proving Grounds I ("chapter 2.5"): mixed fights. Each takes one layout from
 * each of the listed Chapter 2 enemies (all share one arena frame, so one
 * general script can win them all). Boss: Drill Sergeant.
 */
export const PROVING_1 = chapter(25, [
  fight('pg1-a', 'Übungsplatz 1', 'Practice Field 1', ['tank-dummy', 'dummy-row'], 'Zwei Kämpfe hintereinander: Panzer und Reihe.', 'Two fights in a row: tank and row.'),
  fight('pg1-b', 'Übungsplatz 2', 'Practice Field 2', ['dummy-row', 'step-counter'], 'Reihe und Schrittzähler.', 'Row and step counter.'),
  fight('pg1-c', 'Übungsplatz 3', 'Practice Field 3', ['step-counter', 'after-the-loop'], 'Schrittzähler und Nach der Schleife.', 'Step counter and after the loop.'),
  fight('pg1-d', 'Übungsplatz 4', 'Practice Field 4', ['after-the-loop', 'double-loop'], 'Nach der Schleife und Doppelschleife.', 'After the loop and double loop.'),
  fight('pg1-e', 'Übungsplatz 5', 'Practice Field 5', ['tank-dummy', 'double-loop', 'dummy-army'], 'Panzer, Doppelschleife und Armee.', 'Tank, double loop and army.'),
  fight(
    'drill-sergeant',
    'Ausbilder',
    'Drill Sergeant',
    ['tank-dummy', 'dummy-row', 'step-counter', 'after-the-loop', 'double-loop', 'dummy-army'],
    'Boss: Alle Attrappen der Kapitel 0 bis 2 dieses Rahmens, sechs Kämpfe am Stück.',
    'Boss: all the dummies of this frame in six fights in a row.',
  ),
]);
