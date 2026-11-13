/**
 * The challenges of Hydra Lift, in order, grouped by building (docs/elevator.md, "The challenges").
 * A challenge opens when the one before it is solved and starts with the
 * learner's passing code of the one before (unless it has its own `starter`).
 * Each building practises one idea in a few variations before the next one
 * comes. Everybody who appears is planned in advance with a fixed seed, so
 * every run of a challenge sees the same people.
 */
import { Rng } from '../robot/rng.ts';
import type { Goal, Handler } from './run.ts';
import { TICKS_PER_SECOND, type Spawn } from './sim.ts';

type Text = { de: string; en: string };

/** The buildings, in the order they come; each has its own look (`lift-theme-<id>`). */
export const BUILDINGS = ['house', 'school', 'highrise'] as const;
export type BuildingId = (typeof BUILDINGS)[number];

export const BUILDING_NAMES: Record<BuildingId, Text> = {
  house: { de: 'Das Gartenhaus', en: 'The cottage' },
  school: { de: 'Die Schule', en: 'The school' },
  highrise: { de: 'Das Hochhaus', en: 'The high-rise' },
};

/**
 * Who appears:
 * - random: on any floor, going to any other floor;
 * - lobby: on the ground floor (0), going up;
 * - down: on an upper floor, going down to 0;
 * - mixed: half of them lobby, half down (an office in the morning and the evening);
 * - upward: on any floor, going to a higher one; on the top floor, going to the lowest;
 * - downward: on any floor, going to a lower one; on the lowest floor, going to the top.
 * `stops` limits the floors people use (the others are never a start or a target).
 */
export type Pattern = 'random' | 'lobby' | 'down' | 'mixed' | 'upward' | 'downward';

/** A Python shape the editor offers as a snippet. */
export type Shape = 'for' | 'if' | '>';

export interface Challenge {
  /**
   * A fixed UUID, never changed or reused: progress, code and points are stored under it. The number shown is the
   * position in `CHALLENGES`, so a challenge added in between is new to everybody and the others keep their progress.
   */
  id: string;
  building: BuildingId;
  title: Text;
  /** What to do, for the task box. */
  task: Text;
  /** The word or idea the challenge is about, shown as a tag ("go_to_floor", "for", "on_call"). */
  newWord?: string;
  floors: number;
  cars: number;
  capacity?: number;
  pattern: Pattern;
  /** The floors people use (all of them when missing). */
  stops?: number[];
  /** Closed floors (building sites): nobody uses them, a car must not stop there. */
  closed?: number[];
  /** Somebody new appears about every this many seconds. */
  every: number;
  seed: number;
  goal: Goal;
  /** The editor's text the first time (else the passing code of the challenge before, else ''). */
  starter?: string;
  /** The Python shapes the editor offers (see `shapesOf`). */
  shapes?: Shape[];
  /** The car commands and handlers the toolbox shows. */
  toolbox: string[];
  /** The handlers the challenge uses (for the help). */
  handlers: Handler[];
  /** A solution that passes; the tests check it. */
  reference: string;
}

/** Everybody who appears in a challenge, planned with its seed up to its time limit. */
export function spawnsOf(c: Pick<Challenge, 'floors' | 'pattern' | 'stops' | 'closed' | 'every' | 'seed' | 'goal'>): Spawn[] {
  const rng = new Rng(c.seed);
  const out: Spawn[] = [];
  const end = c.goal.seconds * TICKS_PER_SECOND;
  const floors = (c.stops ?? Array.from({ length: c.floors }, (_, f) => f)).filter((f) => !c.closed?.includes(f));
  const upper = floors.filter((f) => f !== 0);
  for (let i = 0; ; i++) {
    // The first one after one second, then about every `every` seconds (a little earlier or later).
    const tick = Math.round((1 + i * c.every + (rng.next() - 0.5) * c.every * 0.6) * TICKS_PER_SECOND);
    if (tick > end) break;
    let from: number;
    let to: number;
    const pattern = c.pattern === 'mixed' ? (rng.chance(0.5) ? 'lobby' : 'down') : c.pattern;
    if (pattern === 'lobby') {
      from = 0;
      to = rng.pick(upper);
    } else if (pattern === 'down') {
      from = rng.pick(upper);
      to = 0;
    } else if (pattern === 'upward' || pattern === 'downward') {
      from = rng.pick(floors);
      const onward = floors.filter((f) => (pattern === 'upward' ? f > from : f < from));
      to = onward.length > 0 ? rng.pick(onward) : pattern === 'upward' ? floors[0]! : floors[floors.length - 1]!;
    } else {
      from = rng.pick(floors);
      to = rng.pick(floors.filter((f) => f !== from));
    }
    out.push({ tick: Math.max(1, tick), from, to });
  }
  return out.sort((a, b) => a.tick - b.tick);
}

const ONE = 'elevator.go_to_floor()';
const idleSweep = (floors: number[]) => floors.map((f) => `elevator.go_to_floor(${f})\n`).join('');

export const CHALLENGES: readonly Challenge[] = [
  // ---------------------------------------------------------------- the cottage: go_to_floor, one line per floor
  {
    id: '55803482-f298-47fe-b49a-ba0a32925db4',
    building: 'house',
    title: { de: 'Hoch und runter', en: 'Up and down' },
    task: {
      de: 'Zwei Etagen, ein Aufzug. Das Programm ist schon fertig: Es schickt den Aufzug ins Erdgeschoss (Etage 0) und dann nach oben in Etage 1. Immer wenn der Aufzug nichts zu tun hat, läuft es wieder von oben. Starte es und schau zu, wie der Aufzug alle ans Ziel bringt.',
      en: 'Two floors, one elevator. The program is already done: it sends the elevator to the ground floor (floor 0) and then up to floor 1. Whenever the elevator has nothing to do, it runs from the top again. Start it and watch the elevator take everybody where they want to go.',
    },
    newWord: 'go_to_floor',
    floors: 2,
    cars: 1,
    pattern: 'random',
    every: 5,
    seed: 11,
    goal: { people: 5, seconds: 60 },
    // The first challenge shows what the game is about: its program is already the solution.
    starter: idleSweep([0, 1]),
    toolbox: [ONE],
    handlers: [],
    reference: idleSweep([0, 1]),
  },
  {
    id: '2206ba32-46ed-466b-b5f3-1140f6a6a9f0',
    building: 'house',
    title: { de: 'Alle wohnen oben', en: 'Everybody lives upstairs' },
    task: {
      de: 'Jetzt wohnen alle oben und wollen runter. Der Aufzug fährt einmal hoch und holt sie ab, aber dann bleibt er oben. Bring sie auch nach unten.',
      en: 'Now everybody lives upstairs and wants to go down. The elevator goes up once and picks them up, but then it stays up there. Take them down as well.',
    },
    floors: 2,
    cars: 1,
    pattern: 'down',
    every: 4,
    seed: 12,
    goal: { people: 6, seconds: 60 },
    starter: 'elevator.go_to_floor(1)\n',
    toolbox: [ONE],
    handlers: [],
    reference: idleSweep([1, 0]),
  },
  {
    id: '8e91d45d-e697-4d41-9701-56213a743b90',
    building: 'house',
    title: { de: 'Das Dachgeschoss', en: 'The attic' },
    task: {
      de: 'Das Gartenhaus hat ein Dachgeschoss bekommen: Etage 2. Auch dort wohnt jetzt jemand.',
      en: 'The cottage got an attic: floor 2. Somebody lives up there now too.',
    },
    floors: 3,
    cars: 1,
    pattern: 'random',
    every: 4,
    seed: 13,
    goal: { people: 8, seconds: 70 },
    toolbox: [ONE],
    handlers: [],
    reference: idleSweep([0, 1, 2]),
  },
  // ---------------------------------------------------------------- the school: four floors, the order of the lines is the route
  {
    id: '0dcdd927-0f07-4f6f-8adf-3553c27ce8ef',
    building: 'school',
    title: { de: 'Vier Etagen', en: 'Four floors' },
    task: {
      de: 'Die Schule hat vier Etagen: 0 bis 3. Bring alle Schülerinnen und Schüler hin, wo sie hinwollen.',
      en: 'The school has four floors: 0 to 3. Get all the pupils where they want to go.',
    },
    floors: 4,
    cars: 1,
    pattern: 'random',
    every: 4,
    seed: 43,
    goal: { people: 8, seconds: 80 },
    toolbox: [ONE],
    handlers: [],
    reference: idleSweep([0, 1, 2, 3]),
  },
  {
    id: 'fe9808e4-545e-4f45-933e-caec815ec722',
    building: 'school',
    title: { de: 'Alle wollen runter', en: 'Everybody’s going down' },
    task: {
      de: 'Schulschluss: Alle wollen nach unten, egal wie weit, Hauptsache tiefer. Nur wer schon im Erdgeschoss ist, will ganz nach oben. Dein Aufzug fährt aber 0, 1, 2, 3, also nach oben: Wer unterwegs einsteigt, fährt erst einmal in die falsche Richtung. Niemand darf zu lange brauchen (siehe Ziel). Die Reihenfolge deiner Zeilen ist der Weg des Aufzugs.',
      en: 'End of school: everybody wants to go down, no matter how far, as long as it is lower. Only whoever is already on the ground floor wants to go right to the top. But your elevator goes 0, 1, 2, 3, so upwards: whoever gets in on the way first rides the wrong way. Nobody may take too long (see the goal). The order of your lines is the way the elevator goes.',
    },
    floors: 4,
    cars: 1,
    pattern: 'downward',
    every: 2.5,
    seed: 33,
    goal: { people: 10, seconds: 60, maxWait: 15 },
    toolbox: [ONE],
    handlers: [],
    reference: idleSweep([3, 2, 1, 0]),
  },
  {
    id: '888e237c-74c7-4dd0-9a72-492b09e65425',
    building: 'school',
    title: { de: 'Alle wollen hoch', en: 'Everybody’s going up' },
    task: {
      de: 'Am nächsten Morgen ist es umgekehrt: Alle wollen nach oben, nur wer schon ganz oben ist, will ins Erdgeschoss. Jetzt fährt dein Aufzug in die falsche Richtung.',
      en: 'The next morning it is the other way round: everybody wants to go up, only whoever is already at the top wants to go to the ground floor. Now your elevator goes the wrong way.',
    },
    floors: 4,
    cars: 1,
    pattern: 'upward',
    every: 2.5,
    seed: 32,
    goal: { people: 10, seconds: 60, maxWait: 15 },
    toolbox: [ONE],
    handlers: [],
    reference: idleSweep([0, 1, 2, 3]),
  },
  // ---------------------------------------------------------------- the high-rise: for, range, if, waiting
  {
    id: 'b6ba1c73-bef9-4665-b13b-52ae8db580c8',
    building: 'highrise',
    title: { de: 'Sechs Etagen', en: 'Six floors' },
    task: {
      de: 'Im Hochhaus fährt der Aufzug erst einmal nur in den unteren sechs Etagen, 0 bis 5. Du kannst sechs Zeilen schreiben, oder eine Schleife: for floor in range(6): geht floor = 0, 1, 2, 3, 4, 5 durch.',
      en: 'In the high-rise the elevator serves only the lower six floors for now, 0 to 5. You can write six lines, or a loop: for floor in range(6): goes through floor = 0, 1, 2, 3, 4, 5.',
    },
    newWord: 'for',
    shapes: ['for'],
    floors: 6,
    cars: 1,
    pattern: 'random',
    every: 4,
    seed: 23,
    goal: { people: 10, seconds: 110 },
    toolbox: [ONE],
    handlers: [],
    reference: 'for floor in range(6):\n    elevator.go_to_floor(floor)\n',
  },
  {
    id: '4b7a9276-8ac4-4311-8d8a-02cc5a7aa448',
    building: 'highrise',
    title: { de: 'Zwanzig Etagen', en: 'Twenty floors' },
    shapes: ['for'],
    task: {
      de: 'Jetzt fährt der Aufzug durchs ganze Hochhaus: 20 Etagen, 0 bis 19. Alle wollen nach oben, nur wer ganz oben ist, will ins Erdgeschoss.',
      en: 'Now the elevator serves the whole high-rise: 20 floors, 0 to 19. Everybody wants to go up; only whoever is at the very top wants to go to the ground floor.',
    },
    floors: 20,
    cars: 1,
    pattern: 'upward',
    every: 2,
    seed: 25,
    goal: { people: 20, seconds: 170 },
    toolbox: [ONE],
    handlers: [],
    reference: 'for floor in range(20):\n    elevator.go_to_floor(floor)\n',
  },
  {
    id: '3ad1408b-aabd-40d8-bc8c-0fa7aaaa9487',
    building: 'highrise',
    title: { de: 'Nur wo jemand wartet', en: 'Only where somebody waits' },
    task: {
      de: 'Abends im Hochhaus: Nur ab und zu wartet oben jemand und will runter ins Erdgeschoss. Hält der Aufzug auf jeder Etage, dauert eine Runde über eine Minute. waiting(floor) sagt dir, wie viele Leute auf einer Etage warten. Mit if führst du eine Zeile nur manchmal aus: if waiting(floor) > 0: heißt „wenn auf floor jemand wartet“. Und am Ende geht es ins Erdgeschoss.',
      en: 'Evening in the high-rise: only now and then somebody waits upstairs and wants to go down to the ground floor. If the elevator stops on every floor, one round takes over a minute. waiting(floor) tells you how many people wait on a floor. With if you run a line only sometimes: if waiting(floor) > 0: means “if somebody waits on floor”. And at the end it goes down to the ground floor.',
    },
    newWord: 'if',
    shapes: ['for', 'if', '>'],
    floors: 20,
    cars: 1,
    pattern: 'down',
    every: 10,
    seed: 84,
    goal: { people: 6, seconds: 170, maxWait: 90 },
    toolbox: [ONE, 'waiting()'],
    handlers: [],
    reference: 'for floor in range(20):\n    if waiting(floor) > 0:\n        elevator.go_to_floor(floor)\nelevator.go_to_floor(0)\n',
  },
];

export const CHALLENGE_IDS: readonly string[] = CHALLENGES.map((c) => c.id);

/** The number a challenge is shown with: its position, from 1. */
export function numberOf(id: string): number {
  return CHALLENGES.findIndex((c) => c.id === id) + 1;
}
export type ChallengeId = string;
export const isChallengeId = (v: unknown): v is ChallengeId => typeof v === 'string' && CHALLENGE_IDS.includes(v);

export function challengeById(id: string): Challenge | undefined {
  return CHALLENGES.find((c) => c.id === id);
}

/** The challenge before `id` (its passing code is where `id` starts), if any. */
export function previous(id: ChallengeId): Challenge | undefined {
  const i = CHALLENGES.findIndex((c) => c.id === id);
  return i > 0 ? CHALLENGES[i - 1] : undefined;
}
