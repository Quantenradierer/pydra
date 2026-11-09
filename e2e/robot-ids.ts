/** The challenges of Robot Battler in play order, by chapter (the ids of web/src/robot/content). */
export const CH0 = ['first-contact', 'one-more-line', 'training-dummy', 'corner-dummy', 'u-turn', 'far-corner', 'wall-dummy'];
export const CH1 = ['hello-robot', 'far-dummy', 'counter', 'sign-dummy', 'name-tag', 'far-left', 'calibrator'];
export const CH2 = ['tank-dummy', 'dummy-right', 'after-the-loop', 'dummy-left', 'dummy-army'];
export const PG1 = ['pg1-a', 'pg1-b', 'pg1-c', 'pg1-d', 'drill-sergeant'];
export const CH3 = ['peekaboo', 'right-dummy', 'three-way', 'bubble', 'health-check'];
export const CH4 = ['far-far-dummy', 'regenerator', 'countdown', 'side-guard', 'break-out'];
export const PG2 = ['pg2-a', 'pg2-b', 'pg2-c', 'pg2-d', 'pg2-e', 'pg2-f', 'pg2-g', 'final-exam'];
export const BEFORE_CHAPTER_3 = [...CH0, ...CH1, ...CH2, ...PG1];

import { ENEMIES } from '../web/src/robot/content/index.ts';

/** The reference solution of a challenge. */
export const solution = (id: string): string => ENEMIES.find((e) => e.id === id)!.solution;
