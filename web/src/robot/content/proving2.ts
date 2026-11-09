import { chapter, T } from './helpers.ts';
import type { EnemyData } from './types.ts';

/** The one script that carries Chapters 3 and 4: look around, respect shields, walk, turn at walls. */
const FINAL =
  'while alive():\n    if see() == "enemy":\n        if enemy_shielded():\n            shield.activate()\n        else:\n            fire()\n    elif see_left() == "enemy":\n        turn_left()\n    elif see_right() == "enemy":\n        turn_right()\n    elif see() == "wall" and distance() == 1:\n        turn_right()\n    else:\n        forward()';
const BUILD = { gear: ['blaster', 'eyes', 'shield'] as ('blaster' | 'eyes' | 'shield')[], addons: ['wide', 'scanner'] as ('wide' | 'scanner')[] };

const fight = (id: string, de: string, en: string, mix: string[], catchDe: string, catchEn: string, boss = false): Omit<EnemyData, 'chapter'> => ({
  id,
  title: T(de, en),
  catchLine: T(catchDe, catchEn),
  enemies: [],
  maps: [],
  mix,
  needs: { noWaste: true },
  solutionBuild: BUILD,
  solution: FINAL,
  breaks: false,
  par: 14,
});

/**
 * Practice Field II / Exams ("chapter 4.5"): eight mixed fights and the boss Final Exam.
 * Each fight takes one layout from each of the listed Chapter 3 and 4 enemies
 * ("id#2" = the second layout), so the same general script has to win them all.
 */
export const PROVING_2 = chapter(45, [
  fight('pg2-a', 'Prüfung 1', 'Test 1', ['peekaboo#2', 'three-way#3'], 'Rechts und links: Guck-guck und Drei Wege.', 'Right and left: Peekaboo and Three-Way.'),
  fight('pg2-b', 'Prüfung 2', 'Test 2', ['bubble#1', 'bubble#2', 'bubble#3'], 'Drei Mal Blase, von allen Seiten.', 'Bubble three times, from every side.'),
  fight('pg2-c', 'Prüfung 3', 'Test 3', ['charger#1', 'far-far-dummy#1'], 'Ein Stürmer und eine ferne Attrappe.', 'A charger and a far dummy.'),
  fight('pg2-d', 'Prüfung 4', 'Test 4', ['regenerator#1', 'maze-runner#2'], 'Heiler und Labyrinth.', 'Regenerator and maze.'),
  fight('pg2-e', 'Prüfung 5', 'Test 5', ['gatekeeper#2', 'hide-and-seek#1'], 'Torwächter und Versteckspiel.', 'Gatekeeper and hide and seek.'),
  fight('pg2-f', 'Prüfung 6', 'Test 6', ['three-way#2', 'maze-runner#3', 'regenerator#3'], 'Sieh nach rechts, lauf durchs Labyrinth, schieß ohne Pause.', 'Look right, run the maze, shoot without a break.'),
  fight('pg2-g', 'Prüfung 7', 'Test 7', ['bubble#3', 'charger#2', 'hide-and-seek#2'], 'Schild, Stürmer, Nische.', 'Shield, charger, niche.'),
  fight('pg2-h', 'Prüfung 8', 'Test 8', ['gatekeeper#3', 'far-far-dummy#3', 'hide-and-seek#3'], 'Torwächter links, weite Halle, Versteck hinter der Kurve.', 'Gatekeeper on the left, a wide hall, a hideout around the bend.'),
  fight(
    'final-exam',
    'Abschlussprüfung',
    'Final Exam',
    ['peekaboo#1', 'peekaboo#2', 'three-way#3', 'bubble#1', 'bubble#2', 'charger#1', 'charger#3', 'gatekeeper#1', 'gatekeeper#2', 'gatekeeper#3', 'far-far-dummy#2', 'regenerator#2', 'maze-runner#1', 'maze-runner#2', 'maze-runner#3', 'hide-and-seek#1', 'hide-and-seek#2', 'hide-and-seek#3'],
    'Boss: achtzehn Kämpfe am Stück aus den Kapiteln 3 und 4. Bestehst du, bekommst du das Grundlagen-Zertifikat.',
    'Boss: eighteen fights in a row from Chapters 3 and 4. Pass them all and you earn the Basics Certificate.',
    true,
  ),
]);
