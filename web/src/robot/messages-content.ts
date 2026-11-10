/** Texts for the second half of Robot Battler: chapters 3-4, Practice Field II, rules. */
export const CONTENT_DE = {
  'robot.chapter.3': 'Kapitel 3: if / elif / else',
  'robot.chapter.4': 'Kapitel 4: while-Schleifen',
  'robot.outcome.damage': 'Zu viel Schaden: höchstens {max} Leben erlaubt.',
  'robot.outcome.waste': 'Gewonnen, aber du hast ins Schild geschossen: Schüsse auf ein gehobenes Schild sind verschwendet.',
  'robot.outcome.miss': 'Gewonnen, aber ein Schuss ging daneben oder ins Schild.',
  'robot.outcome.uses': 'Gewonnen, aber in dieser Aufgabe sollst du {words} benutzen.',
  'robot.outcome.without': 'Gewonnen, aber in dieser Aufgabe darfst du {words} nicht benutzen.',
  'robot.outcome.repeat': 'Gewonnen, aber eine Zahl steht zweimal im Code. Gib ihr einen Namen (eine Variable).',
} as const;

export const CONTENT_EN: Record<keyof typeof CONTENT_DE, string> = {
  'robot.chapter.3': 'Chapter 3: if / elif / else',
  'robot.chapter.4': 'Chapter 4: while loops',
  'robot.outcome.damage': 'Too much damage: at most {max} HP allowed.',
  'robot.outcome.waste': 'Won, but you shot into the shield: shots at a raised shield are wasted.',
  'robot.outcome.miss': 'Won, but a shot missed or hit the shield.',
  'robot.outcome.uses': 'Won, but in this task you are meant to use {words}.',
  'robot.outcome.without': 'Won, but in this task you must not use {words}.',
  'robot.outcome.repeat': 'Won, but a number is written twice in the code. Give it a name (a variable).',
};
