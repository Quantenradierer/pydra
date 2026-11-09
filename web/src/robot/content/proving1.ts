import { CHAPTER_2 } from './chapter2.ts';
import { chapter, T } from './helpers.ts';

const ARMY = 'shots = 12\nforward(4)\nfor side in range(2):\n    for i in range(shots):\n        fire()\n    turn_right()';
/** A review fight: the arena and enemies of the Chapter 2 enemy `like`, fought with the one general script. */
const fight = (id: string, de: string, en: string, like: string, catchDe: string, catchEn: string) => {
  const src = CHAPTER_2.find((e) => e.id === like)!;
  return {
    id,
    title: T(de, en),
    catchLine: T(catchDe, catchEn),
    enemies: src.enemies,
    map: src.map,
    ...(src.maxTicks ? { maxTicks: src.maxTicks } : {}),
    solution: ARMY,
    breaks: false,
    par: 6,
  };
};

/**
 * Practice Field I ("chapter 2.5"): one review fight per Chapter 2 frame, all won by one general script.
 * Boss: Drill Sergeant.
 */
export const PROVING_1 = chapter(25, [
  fight('pg1-a', 'Übungsplatz 1', 'Practice Field 1', 'dummy-row', 'Eine Reihe Attrappen.', 'A row of dummies.'),
  fight('pg1-b', 'Übungsplatz 2', 'Practice Field 2', 'step-counter', 'Zähle deine Schritte.', 'Count your steps.'),
  fight('pg1-c', 'Übungsplatz 3', 'Practice Field 3', 'after-the-loop', 'Etwas passiert nach der Schleife.', 'Something happens after the loop.'),
  fight('pg1-d', 'Übungsplatz 4', 'Practice Field 4', 'double-loop', 'Eine Schleife in der Schleife.', 'A loop inside a loop.'),
  fight('pg1-e', 'Übungsplatz 5', 'Practice Field 5', 'dummy-army', 'Eine ganze Armee.', 'A whole army.'),
  fight('drill-sergeant', 'Ausbilder', 'Drill Sergeant', 'dummy-army', 'Boss: die Armee, ohne Pause.', 'Boss: the army, no breaks.'),
]);
