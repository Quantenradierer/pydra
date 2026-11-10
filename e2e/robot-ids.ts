/** The challenges of Robot Battler in play order, by chapter (the ids of web/src/robot/content). */
export const CH0 = ['first-contact', 'one-more-line', 'training-dummy', 'wall-dummy'];
export const CH1 = ['status-report', 'far-dummy', 'sign-dummy', 'range-report'];
export const CH2 = ['tank-dummy', 'patrol-dummy', 'corner-dummy', 'dummy-army'];
export const CH3 = ['peekaboo', 'right-dummy', 'three-way', 'bubble', 'sniper'];
export const CH4 = ['far-far-dummy', 'regenerator', 'side-guard', 'patroller', 'flicker'];
export const BEFORE_CHAPTER_3 = [...CH0, ...CH1, ...CH2];

import { ENEMIES } from '../web/src/robot/content/index.ts';

/** The reference solution of a challenge. */
export const solution = (id: string): string => ENEMIES.find((e) => e.id === id)!.solution;
