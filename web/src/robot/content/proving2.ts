import { CHAPTER_3 } from './chapter3.ts';
import { CHAPTER_4 } from './chapter4.ts';
import { chapter, T } from './helpers.ts';
import type { EnemyData } from './types.ts';

/** The one script that carries Chapters 3 and 4: look around, respect shields, walk, turn at walls. */
export const FINAL_SCRIPT =
  'while alive():\n    if see() == "enemy":\n        if enemy_shielded():\n            wait()\n        else:\n            fire()\n    elif see_left() == "enemy":\n        turn_left()\n    elif see_right() == "enemy":\n        turn_right()\n    elif see() == "wall" and distance() == 1:\n        turn_right()\n    else:\n        forward()';

/** An exam: the arena and enemies of the Chapter 3 or 4 enemy `like`, fought with the one general script. */
const fight = (id: string, de: string, en: string, like: string, catchDe: string, catchEn: string): Omit<EnemyData, 'chapter'> => {
  const src = [...CHAPTER_3, ...CHAPTER_4].find((e) => e.id === like)!;
  return {
    id,
    title: T(de, en),
    catchLine: T(catchDe, catchEn),
    enemies: src.enemies,
    map: src.map,
    ...(src.maxTicks ? { maxTicks: src.maxTicks } : {}),
    needs: { noWaste: true },
    solution: FINAL_SCRIPT,
    breaks: false,
    par: 14,
  };
};

/**
 * Exams ("chapter 4.5"): eight review fights and the boss Final Exam, one per frame of Chapters 3 and 4,
 * all won by the same general script.
 */
export const PROVING_2 = chapter(45, [
  fight('pg2-a', 'Prüfung 1', 'Test 1', 'right-dummy', 'Geradeaus und rechts.', 'Ahead and right.'),
  fight('pg2-b', 'Prüfung 2', 'Test 2', 'three-way', 'Auch hinter dir.', 'Behind you, too.'),
  fight('pg2-c', 'Prüfung 3', 'Test 3', 'bubble', 'Ein Gegner hat einen Schild.', 'An enemy has a shield.'),
  fight('pg2-d', 'Prüfung 4', 'Test 4', 'health-check', 'Ein Scharfschütze.', 'A sniper.'),
  fight('pg2-e', 'Prüfung 5', 'Test 5', 'far-far-dummy', 'Eine weite Halle.', 'A wide hall.'),
  fight('pg2-f', 'Prüfung 6', 'Test 6', 'regenerator', 'Der Gegner heilt sich.', 'The enemy heals itself.'),
  fight('pg2-g', 'Prüfung 7', 'Test 7', 'side-guard', 'Ein Gegner steht seitlich.', 'An enemy stands to the side.'),
  fight('final-exam', 'Abschlussprüfung', 'Final Exam', 'break-out', 'Boss: Bestehst du, bekommst du das Grundlagen-Zertifikat.', 'Boss: pass it and you earn the Basics Certificate.'),
]);
