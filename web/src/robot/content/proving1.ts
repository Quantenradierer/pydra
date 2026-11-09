import { CHAPTER_2 } from './chapter2.ts';
import { chapter, T } from './helpers.ts';

/** The one script that wins every Chapter 2 frame: the solution of the last Chapter 2 challenge. */
const ARMY = CHAPTER_2[CHAPTER_2.length - 1]!.solution;

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
    par: 12,
  };
};

/**
 * Practice Field I ("chapter 2.5"): one review fight per Chapter 2 frame, all won by one general script.
 * Boss: Drill Sergeant.
 */
export const PROVING_1 = chapter(25, [
  fight('pg1-a', 'Übungsplatz 1', 'Practice Field 1', 'tank-dummy', 'Eine Attrappe vorn.', 'A dummy ahead.'),
  fight('pg1-b', 'Übungsplatz 2', 'Practice Field 2', 'dummy-right', 'Rechts steht noch eine.', 'Another one on the right.'),
  fight('pg1-c', 'Übungsplatz 3', 'Practice Field 3', 'after-the-loop', 'Etwas passiert nach der Schleife.', 'Something happens after the loop.'),
  fight('pg1-d', 'Übungsplatz 4', 'Practice Field 4', 'dummy-left', 'Auch links steht eine.', 'One on the left too.'),
  fight('drill-sergeant', 'Ausbilder', 'Drill Sergeant', 'dummy-army', 'Boss: die Armee, ohne Pause.', 'Boss: the army, no breaks.'),
]);
