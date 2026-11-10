/** The challenges of Robot Battler in play order, by chapter (the ids of web/src/robot/content). */
export const CH0 = ['first-contact', 'one-more-line', 'training-dummy', 'wall-dummy'];
export const CH1 = ['long-way', 'tank', 'beat'];
export const CH2 = ['patrol', 'flank', 'flicker'];
export const CH3 = ['scout', 'twice', 'healer', 'sniper'];
export const CH4 = ['drill'];
export const CH5 = ['lanes'];
export const BEFORE_CHAPTER_3 = [...CH0, ...CH1, ...CH2];

import { ENEMIES } from '../web/src/robot/content/index.ts';

/** The reference solution of a challenge. */
export const solution = (id: string): string => ENEMIES.find((e) => e.id === id)!.solution;
