/** The challenges of Robot Battler in play order, by chapter (the ids of web/src/robot/content). */
export const CH0 = ['first-contact', 'side-dummy', 'move-and-turn', 'circle-dummy', 'tough-walker'];
export const CH1 = ['roamer', 'ring-search', 'ring-shooter', 'four-spots', 'two-steps', 'far-dummy', 'sign-dummy'];
export const CH2 = ['tank-dummy', 'patrol-dummy', 'corner-dummy', 'dummy-army'];
export const CH3 = ['peekaboo', 'right-dummy', 'three-way', 'bubble', 'sniper'];
export const CH4 = ['far-far-dummy', 'regenerator', 'side-guard', 'patroller', 'flicker'];
export const BEFORE_CHAPTER_3 = [...CH0, ...CH1, ...CH2];

import { ENEMIES } from '../web/src/robot/content/index.ts';

/** The reference solution of a challenge. */
export const solution = (id: string): string => ENEMIES.find((e) => e.id === id)!.solution;
